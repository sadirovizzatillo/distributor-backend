import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { db } from "../db/db";
import { orders, orderItems, products, users, shops, transactions } from "../db/schema";
import { eq, inArray, and, gte, lte, SQL } from "drizzle-orm";

export interface OrderFilters {
  userId?: number;
  shopId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { TelegramBotService } from "../telegram/telegram.service";

@Injectable()
export class OrdersService {
  constructor(private readonly telegramService: TelegramBotService) {}
  // Create order — fully transactional
  async create(createDto: CreateOrderDto) {
    const { userId, shopId, items } = createDto;

    if (!items || items.length === 0) {
      throw new BadRequestException("Order must contain at least one item");
    }

    return db.transaction(async (tx) => {
      // 1) Validate user exists
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user) throw new BadRequestException("User not found");

      // 2) Fetch all referenced products
      const productIds = Array.from(new Set(items.map((i) => i.productId)));

      const fetchedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds)); // <- FIXED

      // Map products by ID
      const productMap = new Map<number, any>();
      for (const p of fetchedProducts) productMap.set(p.id, p);

      // 3) Validate product existence & build order_items rows
      let totalCents = 0;
      const itemsToInsert = [];

      for (const it of items) {
        const product = productMap.get(it.productId);
        if (!product) throw new BadRequestException(`Product not found: ${it.productId}`);
        if (it.quantity < 1) throw new BadRequestException("Quantity must be at least 1");

        if (product.stock !== null && product.stock !== undefined) {
          if (it.quantity > product.stock) {
            throw new BadRequestException(
              `Not enough stock for product ${product.id}. Available: ${product.stock}`
            );
          }
        }

        // price stored as string in DB for NUMERIC
        const priceNumber = Number(product.price);
        if (Number.isNaN(priceNumber)) {
          throw new BadRequestException(`Invalid price for product ${it.productId}`);
        }

        const subtotal = priceNumber * it.quantity;
        totalCents += Math.round(subtotal * 100);

        itemsToInsert.push({
          productId: it.productId,
          quantity: it.quantity,
          priceAtTime: priceNumber.toFixed(2),
        });

        const newStock = product.stock - it.quantity;

        await tx
          .update(products)
          .set({ stock: newStock })
          .where(eq(products.id, it.productId));
      }

      // 4) Insert order
      const totalPriceStr = (totalCents / 100).toFixed(2);

      const [createdOrder] = await tx
        .insert(orders)
        .values({
          userId,
          shopId,
          totalPrice: totalPriceStr,
          remainingAmount: totalPriceStr
        })
        .returning();

      // 5) Insert order_items
      await tx.insert(orderItems).values(
        itemsToInsert.map((it) => ({
          ...it,
          orderId: createdOrder.id,
        }))
      );

      // 6) Fetch final order with items
      const [orderRow] = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
          shopId: orders.shopId,
          totalPrice: orders.totalPrice,
          remainingAmount: orders.remainingAmount,
          status: orders.status,
          user: {
            id: users.id,
            name: users.name,
            phone: users.phone,
            role: users.role,
          }
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.id, createdOrder.id));

      const orderItemsList = await tx
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          product: products,
          quantity: orderItems.quantity,
          price: orderItems.priceAtTime
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, createdOrder.id))
        .leftJoin(products, eq(orderItems.productId, products.id))

      // Get shop owner's chatId
      const [shop] = await tx
        .select()
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1);

      if (shop) {
        const currentDebt = Number(shop.totalDebt || 0);
        const remainingAmount = Number(totalPriceStr);
        const newDebt = currentDebt + remainingAmount;

        await tx
          .update(shops)
          .set({
            totalDebt: newDebt.toString()
          })
          .where(eq(shops.id, shopId));
      }

      if (shop?.chatId) {
        await this.telegramService.sendOrderNotification(shop.chatId, {
          ...orderRow,
          items: orderItemsList
        });
      }

      return { ...orderRow, items: orderItemsList };
    });
  }

  async verifyOwnership(orderId: number, userId: number) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new NotFoundException("Order not found");
    if (order.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }
    return order;
  }

  async findAllByUserId(filters: OrderFilters) {
    const conditions: SQL[] = [];

    if (filters.userId) {
      conditions.push(eq(orders.userId, filters.userId));
    }

    if (filters.shopId) {
      conditions.push(eq(orders.shopId, filters.shopId));
    }

    if (filters.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (filters.startDate) {
      const startOfDay = new Date(filters.startDate);
      startOfDay.setHours(0, 0, 0, 0);
      conditions.push(gte(orders.createdAt, startOfDay));
    }

    if (filters.endDate) {
      const endOfDay = new Date(filters.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(orders.createdAt, endOfDay));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select({
        id: orders.id,
        userId: orders.userId,
        shopId: orders.shopId,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        user: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          role: users.role,
          createdAt: users.createdAt
        },
        shop: {
          id: shops.id,
          name: shops.name,
          phone: shops.phone,
          ownerName: shops.ownerName,
          createdAt: users.createdAt
        }
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(whereClause);
  }

  async findAll() {
    return db
      .select({
        id: orders.id,
        userId: orders.userId,
        shopId: orders.shopId,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt,
        user: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          role: users.role,
        },
        shop: {
          id: shops.id,
          name: shops.name,
          phone: shops.phone,
          ownerName: shops.ownerName,
        },
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(shops, eq(orders.shopId, shops.id));
  }

  async markAsDelivered(orderId: number) {
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!existingOrder || existingOrder.length === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    console.log(existingOrder);

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Get full order details with items, user, and products for notification
    const fullOrderData = await this.getOrderWithDetails(orderId);

    // Send Telegram notification to shop's chat ID
    if (fullOrderData.shop?.telegramChatId) {
      await this.telegramService.sendDeliveryNotification(
        fullOrderData.shop.telegramChatId,
        fullOrderData,
      );
    }

    return updatedOrder;
  }

  private async getOrderWithDetails(orderId: number) {
    // Get order with user and shop
    const order = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        shopId: orders.shopId,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        user: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        },
        shop: {
          id: shops.id,
          name: shops.name,
          telegramChatId: shops.chatId,
        },
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.length === 0) {
      return null;
    }

    // Get order items with products
    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.priceAtTime,
        product: {
          id: products.id,
          name: products.name,
        },
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return {
      ...order[0],
      items
    };
  }
  async findOne(id: number) {
    const [orderRow] = await db
      .select({
        id: orders.id,
        shop:{
          id: shops.id,
          name: shops.name,
          address: shops.address,
          latitude: shops.latitude,
          longitude: shops.longitude,
        },
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt,
        user: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          role: users.role,
        },
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(eq(orders.id, id));
    if (!orderRow) throw new NotFoundException("Order not found");

    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        priceAtTime: orderItems.priceAtTime,
        product: {
          id: products.id,
          name: products.name,
          price: products.price,
        },
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    return {
      ...orderRow,
      items,
    };
  }

  async update(id: number, dto: UpdateOrderDto) {
    const updateData: any = { ...dto };
    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    if (!updated) throw new NotFoundException("Order not found");
    return updated;
  }

  async remove(id: number) {
    await db.delete(transactions).where(eq(transactions.orderId, id));
    const [deleted] = await db
      .delete(orders)
      .where(eq(orders.id, id))
      .returning();
    if (!deleted) throw new NotFoundException("Order not found");
    return deleted;
  }
}
