// src/modules/admin/admin.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException
} from "@nestjs/common";
import {
  users,
  shops,
  orders,
  orderItems,
  payments,
  products,
  employees,
  dailyStatistics,
  transactions
} from "../db/schema";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  asc,
  sql,
  inArray,
  or,
  like,
  isNull,
  isNotNull
} from "drizzle-orm";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { AnalyticsQueryDto } from "./dto/analytics-query-dto";
import { PaginationDto } from "./dto/pagination.dto";

import { db } from "../db/db";

@Injectable()
export class AdminService {

  // ==================== ADMIN PROFILE ====================

  async getCurrentAdmin(userId: number) {
    const [admin] = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!admin) {
      throw new NotFoundException("Admin user not found");
    }

    return admin;
  }

  // ==================== DASHBOARD OVERVIEW ====================

  async getDashboardOverview(query: DashboardQueryDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's metrics
    const [todayStats] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        totalOrders: sql<number>`COUNT(DISTINCT ${orders.id})`,
        paymentsReceived: sql<number>`COALESCE(SUM(CASE WHEN ${payments.amount} > 0 THEN ${payments.amount} ELSE 0 END), 0)`
      })
      .from(orders)
      .leftJoin(payments, eq(orders.userId, payments.userId))
      .where(and(gte(orders.createdAt, today), gte(payments.createdAt, today)));

    // Yesterday's metrics for comparison
    const [yesterdayStats] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        totalOrders: sql<number>`COUNT(DISTINCT ${orders.id})`,
        paymentsReceived: sql<number>`COALESCE(SUM(CASE WHEN ${payments.amount} > 0 THEN ${payments.amount} ELSE 0 END), 0)`
      })
      .from(orders)
      .leftJoin(payments, eq(orders.userId, payments.userId))
      .where(
        and(gte(orders.createdAt, yesterday), lte(orders.createdAt, today))
      );

    // Total debt across platform
    const [debtStats] = await db
      .select({
        totalDebt: sql<number>`COALESCE(SUM(${shops.totalDebt}), 0)`
      })
      .from(shops);

    // Yesterday's total debt
    // Note: We'll calculate this from daily_statistics if available
    const [yesterdayDebt] = await db
      .select({
        totalDebt: sql<number>`COALESCE(SUM(${dailyStatistics.totalDebt}), 0)`
      })
      .from(dailyStatistics)
      .where(
        and(
          gte(dailyStatistics.date, yesterday),
          lte(dailyStatistics.date, today)
        )
      );

    // Counts
    const [counts] = await db
      .select({
        distributors: sql<number>`COUNT(DISTINCT CASE WHEN ${users.role} = 'user' THEN ${users.id} END)`,
        shops: sql<number>`COUNT(DISTINCT ${shops.id})`,
        products: sql<number>`COUNT(DISTINCT ${products.id})`,
        employees: sql<number>`COUNT(DISTINCT CASE WHEN ${users.role} = 'agent' THEN ${users.id} END)`
      })
      .from(users)
      .leftJoin(shops, eq(users.id, shops.userId))
      .leftJoin(products, eq(users.id, products.userId));

    // New signups
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [newSignups] = await db
      .select({
        newDistributorsThisWeek: sql<number>`COUNT(DISTINCT CASE WHEN ${users.role} = 'user' AND ${users.createdAt} >= ${weekAgo} THEN ${users.id} END)`,
        newShopsToday: sql<number>`COUNT(DISTINCT CASE WHEN ${shops.createdAt} >= ${today} THEN ${shops.id} END)`
      })
      .from(users)
      .leftJoin(shops, eq(users.id, shops.userId));

    // Low stock products (stock < 10)
    const [lowStockCount] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(products)
      .where(sql`${products.stock} < 10`);

    // Calculate percentage changes
    const calculatePercentageChange = (
      current: number,
      previous: number
    ): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      today: {
        totalSales: Number(todayStats.totalSales) || 0,
        totalOrders: Number(todayStats.totalOrders) || 0,
        paymentsReceived: Number(todayStats.paymentsReceived) || 0,
        totalDebt: Number(debtStats.totalDebt) || 0,
        distributorsCount: Number(counts.distributors) || 0,
        shopsCount: Number(counts.shops) || 0,
        productsCount: Number(counts.products) || 0,
        employeesCount: Number(counts.employees) || 0,
        newDistributorsThisWeek:
          Number(newSignups.newDistributorsThisWeek) || 0,
        newShopsToday: Number(newSignups.newShopsToday) || 0,
        lowStockProducts: Number(lowStockCount.count) || 0
      },
      comparison: {
        salesVsYesterday: calculatePercentageChange(
          Number(todayStats.totalSales),
          Number(yesterdayStats.totalSales)
        ),
        ordersVsYesterday: calculatePercentageChange(
          Number(todayStats.totalOrders),
          Number(yesterdayStats.totalOrders)
        ),
        paymentsVsYesterday: calculatePercentageChange(
          Number(todayStats.paymentsReceived),
          Number(yesterdayStats.paymentsReceived)
        ),
        debtVsYesterday: calculatePercentageChange(
          Number(debtStats.totalDebt),
          Number(yesterdayDebt.totalDebt)
        )
      }
    };
  }

  // ==================== DISTRIBUTORS ====================

  async getDistributors(query: PaginationDto) {
    const {
      limit = 20,
      offset = 0,
      search,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = query;

    // Build where conditions
    const whereConditions = [eq(users.role, "user")];

    if (search) {
      whereConditions.push(
        or(like(users.name, `%${search}%`), like(users.phone, `%${search}%`))
      );
    }

    // Get distributors with stats
    const distributorsQuery = db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        createdAt: users.createdAt,
        totalSales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        totalDebt: sql<number>`COALESCE(SUM(${shops.totalDebt}), 0)`,
        shopsCount: sql<number>`COUNT(DISTINCT ${shops.id})`,
        ordersCount: sql<number>`COUNT(DISTINCT ${orders.id})`,
        productsCount: sql<number>`COUNT(DISTINCT ${products.id})`,
        employeesCount: sql<number>`COUNT(DISTINCT ${employees.id})`
      })
      .from(users)
      .leftJoin(shops, eq(users.id, shops.userId))
      .leftJoin(orders, eq(users.id, orders.userId))
      .leftJoin(products, eq(users.id, products.userId))
      .leftJoin(employees, eq(users.id, employees.distributorId))
      .where(and(...whereConditions))
      .groupBy(users.id, users.name, users.phone, users.createdAt);

    // Apply sorting
    let orderByClause;
    switch (sortBy) {
      case "sales":
        orderByClause =
          sortOrder === "asc"
            ? asc(sql`COALESCE(SUM(${orders.totalPrice}), 0)`)
            : desc(sql`COALESCE(SUM(${orders.totalPrice}), 0)`);
        break;
      case "debt":
        orderByClause =
          sortOrder === "asc"
            ? asc(sql`COALESCE(SUM(${shops.totalDebt}), 0)`)
            : desc(sql`COALESCE(SUM(${shops.totalDebt}), 0)`);
        break;
      case "shops":
        orderByClause =
          sortOrder === "asc"
            ? asc(sql`COUNT(DISTINCT ${shops.id})`)
            : desc(sql`COUNT(DISTINCT ${shops.id})`);
        break;
      default:
        orderByClause =
          sortOrder === "asc" ? asc(users.createdAt) : desc(users.createdAt);
    }

    const data = await distributorsQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(...whereConditions));

    return {
      data: data.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        createdAt: d.createdAt,
        stats: {
          totalSales: Number(d.totalSales) || 0,
          totalDebt: Number(d.totalDebt) || 0,
          shopsCount: Number(d.shopsCount) || 0,
          ordersCount: Number(d.ordersCount) || 0,
          productsCount: Number(d.productsCount) || 0,
          employeesCount: Number(d.employeesCount) || 0
        }
      })),
      total: Number(count),
      limit,
      offset
    };
  }

  async getDistributorDetails(id: number) {

    // Get distributor
    const [distributor] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, "user")));

    if (!distributor) {
      throw new NotFoundException("Distributor not found");
    }

    // Get lifetime stats
    const [stats] = await db
      .select({
        lifetimeSales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        currentDebt: sql<number>`COALESCE(SUM(${shops.totalDebt}), 0)`,
        shopsCount: sql<number>`COUNT(DISTINCT ${shops.id})`,
        productsCount: sql<number>`COUNT(DISTINCT ${products.id})`,
        employeesCount: sql<number>`COUNT(DISTINCT ${employees.id})`,
        ordersCount: sql<number>`COUNT(DISTINCT ${orders.id})`
      })
      .from(users)
      .leftJoin(shops, eq(users.id, shops.userId))
      .leftJoin(orders, eq(users.id, orders.userId))
      .leftJoin(products, eq(users.id, products.userId))
      .leftJoin(employees, eq(users.id, employees.distributorId))
      .where(eq(users.id, id))
      .groupBy(users.id);

    // Recent orders (last 20)
    const recentOrders = await db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt,
        shop: {
          id: shops.id,
          name: shops.name
        }
      })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt))
      .limit(20);

    // Recent payments (last 20)
    const recentPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        shop: {
          id: shops.id,
          name: shops.name
        }
      })
      .from(payments)
      .leftJoin(shops, eq(payments.shopId, shops.id))
      .where(eq(payments.userId, id))
      .orderBy(desc(payments.createdAt))
      .limit(20);

    // Top shops by sales
    const topShops = await db
      .select({
        id: shops.id,
        name: shops.name,
        totalSales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        ordersCount: sql<number>`COUNT(${orders.id})`,
        totalDebt: shops.totalDebt
      })
      .from(shops)
      .leftJoin(orders, eq(shops.id, orders.shopId))
      .where(eq(shops.userId, id))
      .groupBy(shops.id, shops.name, shops.totalDebt)
      .orderBy(desc(sql`COALESCE(SUM(${orders.totalPrice}), 0)`))
      .limit(10);

    // Top products
    const topProducts = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        stock: products.stock,
        totalSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`
      })
      .from(products)
      .leftJoin(orderItems, eq(products.id, orderItems.productId))
      .where(eq(products.userId, id))
      .groupBy(products.id, products.name, products.price, products.stock)
      .orderBy(desc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`))
      .limit(10);

    return {
      distributor: {
        id: distributor.id,
        name: distributor.name,
        phone: distributor.phone,
        role: distributor.role,
        createdAt: distributor.createdAt
      },
      stats: {
        lifetimeSales: Number(stats.lifetimeSales) || 0,
        currentDebt: Number(stats.currentDebt) || 0,
        shopsCount: Number(stats.shopsCount) || 0,
        productsCount: Number(stats.productsCount) || 0,
        employeesCount: Number(stats.employeesCount) || 0,
        ordersCount: Number(stats.ordersCount) || 0
      },
      recentOrders,
      recentPayments,
      topShops: topShops.map((shop) => ({
        ...shop,
        totalSales: Number(shop.totalSales) || 0,
        ordersCount: Number(shop.ordersCount) || 0
      })),
      topProducts: topProducts.map((product) => ({
        ...product,
        totalSold: Number(product.totalSold) || 0
      }))
    };
  }

  // ==================== SHOPS ====================

  async getShops(query: PaginationDto) {
    const {
      limit = 20,
      offset = 0,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      distributorId,
      minDebt,
      maxDebt,
      hasTelegram
    } = query;

    // Build where conditions
    const whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(shops.name, `%${search}%`),
          like(shops.ownerName, `%${search}%`),
          like(shops.phone, `%${search}%`)
        )
      );
    }

    if (distributorId) {
      whereConditions.push(eq(shops.userId, distributorId));
    }

    if (minDebt !== undefined) {
      whereConditions.push(gte(shops.totalDebt, minDebt.toString()));
    }

    if (maxDebt !== undefined) {
      whereConditions.push(lte(shops.totalDebt, maxDebt.toString()));
    }

    if (hasTelegram !== undefined) {
      whereConditions.push(
        hasTelegram ? isNotNull(shops.chatId) : isNull(shops.chatId)
      );
    }

    // Get shops with stats
    const shopsQuery = db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        address: shops.address,
        totalDebt: shops.totalDebt,
        chatId: shops.chatId,
        createdAt: shops.createdAt,
        distributorId: users.id,
        distributorName: users.name,
        ordersCount: sql<number>`COUNT(${orders.id})`,
        lastOrderDate: sql<Date>`MAX(${orders.createdAt})`
      })
      .from(shops)
      .leftJoin(users, eq(shops.userId, users.id))
      .leftJoin(orders, eq(shops.id, orders.shopId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(shops.id, users.id, users.name);

    // Apply sorting
    let orderByClause;
    switch (sortBy) {
      case "debt":
        orderByClause =
          sortOrder === "asc" ? asc(shops.totalDebt) : desc(shops.totalDebt);
        break;
      case "lastOrder":
        orderByClause =
          sortOrder === "asc"
            ? asc(sql`MAX(${orders.createdAt})`)
            : desc(sql`MAX(${orders.createdAt})`);
        break;
      default:
        orderByClause =
          sortOrder === "asc" ? asc(shops.createdAt) : desc(shops.createdAt);
    }

    const data = await shopsQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(shops)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data: data.map((shop) => ({
        id: shop.id,
        name: shop.name,
        ownerName: shop.ownerName,
        phone: shop.phone,
        address: shop.address,
        totalDebt: Number(shop.totalDebt) || 0,
        chatId: shop.chatId,
        telegramConnected: !!shop.chatId,
        distributor: {
          id: shop.distributorId,
          name: shop.distributorName
        },
        lastOrder: shop.lastOrderDate,
        ordersCount: Number(shop.ordersCount) || 0,
        createdAt: shop.createdAt
      })),
      total: Number(count),
      limit,
      offset
    };
  }

  async getShopDetails(id: number) {

    // Get shop with distributor
    const [shop] = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        address: shops.address,
        totalDebt: shops.totalDebt,
        chatId: shops.chatId,
        telegramBotLink: shops.telegramBotLink,
        latitude: shops.latitude,
        longitude: shops.longitude,
        createdAt: shops.createdAt,
        distributor: {
          id: users.id,
          name: users.name,
          phone: users.phone
        }
      })
      .from(shops)
      .leftJoin(users, eq(shops.userId, users.id))
      .where(eq(shops.id, id));

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    // Order history
    const orderHistory = await db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt
      })
      .from(orders)
      .where(eq(orders.shopId, id))
      .orderBy(desc(orders.createdAt))
      .limit(50);

    // Payment history
    const paymentHistory = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        receivedBy: {
          id: users.id,
          name: users.name
        }
      })
      .from(payments)
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .where(eq(payments.shopId, id))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    return {
      shop,
      orderHistory,
      paymentHistory
    };
  }

  // ==================== ORDERS ====================

  async getOrders(query: PaginationDto) {
    const {
      limit = 20,
      offset = 0,
      distributorId,
      shopId,
      status,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = query;

    // Build where conditions
    const whereConditions = [];

    if (distributorId) {
      whereConditions.push(eq(orders.userId, distributorId));
    }

    if (shopId) {
      whereConditions.push(eq(orders.shopId, shopId));
    }

    if (status) {
      whereConditions.push(eq(orders.status, status));
    }

    if (dateFrom) {
      whereConditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      whereConditions.push(lte(orders.createdAt, new Date(dateTo)));
    }

    if (minAmount !== undefined) {
      whereConditions.push(gte(orders.totalPrice, minAmount.toString()));
    }

    if (maxAmount !== undefined) {
      whereConditions.push(lte(orders.totalPrice, maxAmount.toString()));
    }

    // Get orders
    const ordersQuery = db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt,
        shop: {
          id: shops.id,
          name: shops.name
        },
        distributor: {
          id: users.id,
          name: users.name
        },
        itemsCount: sql<number>`COUNT(${orderItems.id})`
      })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(orders.id, shops.id, shops.name, users.id, users.name);

    // Apply sorting
    const orderByClause =
      sortOrder === "asc" ? asc(orders.createdAt) : desc(orders.createdAt);

    const data = await ordersQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get summary
    const [summary] = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        totalRemaining: sql<number>`COALESCE(SUM(${orders.remainingAmount}), 0)`,
        pendingOrders: sql<number>`COUNT(CASE WHEN ${orders.status} = 'pending' THEN 1 END)`,
        deliveredOrders: sql<number>`COUNT(CASE WHEN ${orders.status} = 'delivered' THEN 1 END)`
      })
      .from(orders)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data: data.map((order) => ({
        ...order,
        itemsCount: Number(order.itemsCount) || 0
      })),
      total: Number(count),
      summary: {
        totalAmount: Number(summary.totalAmount) || 0,
        totalRemaining: Number(summary.totalRemaining) || 0,
        pendingOrders: Number(summary.pendingOrders) || 0,
        deliveredOrders: Number(summary.deliveredOrders) || 0
      },
      limit,
      offset
    };
  }

  async getOrderDetails(id: number) {

    // Get order with items
    const [order] = await db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt,
        shop: {
          id: shops.id,
          name: shops.name,
          ownerName: shops.ownerName,
          phone: shops.phone
        },
        distributor: {
          id: users.id,
          name: users.name,
          phone: users.phone
        }
      })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, id));

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Get order items
    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        priceAtTime: orderItems.priceAtTime,
        product: {
          id: products.id,
          name: products.name
        }
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    return {
      ...order,
      items
    };
  }

  // ==================== PAYMENTS ====================

  async getPayments(query: PaginationDto) {
    const {
      limit = 20,
      offset = 0,
      distributorId,
      shopId,
      paymentMethod,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      type // 'payment' or 'debt'
    } = query;

    // Build where conditions
    const whereConditions = [];

    if (distributorId) {
      whereConditions.push(eq(payments.userId, distributorId));
    }

    if (shopId) {
      whereConditions.push(eq(payments.shopId, shopId));
    }

    if (paymentMethod) {
      whereConditions.push(eq(payments.paymentMethod, paymentMethod));
    }

    if (dateFrom) {
      whereConditions.push(gte(payments.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      whereConditions.push(lte(payments.createdAt, new Date(dateTo)));
    }

    if (minAmount !== undefined) {
      whereConditions.push(gte(payments.amount, minAmount.toString()));
    }

    if (maxAmount !== undefined) {
      whereConditions.push(lte(payments.amount, maxAmount.toString()));
    }

    if (type === "payment") {
      whereConditions.push(sql`${payments.amount} > 0`);
    } else if (type === "debt") {
      whereConditions.push(sql`${payments.amount} < 0`);
    }

    // Get payments
    const data = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        shop: {
          id: shops.id,
          name: shops.name
        },
        distributor: {
          id: users.id,
          name: users.name
        },
        receivedBy: {
          id: sql<number>`received_by_user.id`,
          name: sql<string>`received_by_user.name`
        }
      })
      .from(payments)
      .leftJoin(shops, eq(payments.shopId, shops.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(
        sql`${users} as received_by_user`,
        sql`${payments.receivedBy} = received_by_user.id`
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    // Get summary
    const [summary] = await db
      .select({
        totalPayments: sql<number>`COALESCE(SUM(CASE WHEN ${payments.amount} > 0 THEN ${payments.amount} ELSE 0 END), 0)`,
        totalDebts: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${payments.amount} < 0 THEN ${payments.amount} ELSE 0 END)), 0)`,
        cashPayments: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' AND ${payments.amount} > 0 THEN ${payments.amount} ELSE 0 END), 0)`,
        cardPayments: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'card' AND ${payments.amount} > 0 THEN ${payments.amount} ELSE 0 END), 0)`
      })
      .from(payments)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(payments)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data,
      total: Number(count),
      summary: {
        totalPayments: Number(summary.totalPayments) || 0,
        totalDebts: Number(summary.totalDebts) || 0,
        cashPayments: Number(summary.cashPayments) || 0,
        cardPayments: Number(summary.cardPayments) || 0
      },
      limit,
      offset
    };
  }

  // ==================== PRODUCTS ====================

  async getProducts(query: PaginationDto) {
    const {
      limit = 20,
      offset = 0,
      distributorId,
      search,
      lowStock,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = query;

    // Build where conditions
    const whereConditions = [];

    if (distributorId) {
      whereConditions.push(eq(products.userId, distributorId));
    }

    if (search) {
      whereConditions.push(like(products.name, `%${search}%`));
    }

    if (lowStock) {
      whereConditions.push(sql`${products.stock} < 10`);
    }

    if (minPrice !== undefined) {
      whereConditions.push(gte(products.price, minPrice.toString()));
    }

    if (maxPrice !== undefined) {
      whereConditions.push(lte(products.price, maxPrice.toString()));
    }

    // Get products with sales data
    const productsQuery = db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        createdAt: products.createdAt,
        distributor: {
          id: users.id,
          name: users.name
        },
        totalSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`
      })
      .from(products)
      .leftJoin(users, eq(products.userId, users.id))
      .leftJoin(orderItems, eq(products.id, orderItems.productId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(products.id, users.id, users.name);

    // Apply sorting
    let orderByClause;
    switch (sortBy) {
      case "stock":
        orderByClause =
          sortOrder === "asc" ? asc(products.stock) : desc(products.stock);
        break;
      case "price":
        orderByClause =
          sortOrder === "asc" ? asc(products.price) : desc(products.price);
        break;
      case "sales":
        orderByClause =
          sortOrder === "asc"
            ? asc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`)
            : desc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`);
        break;
      default:
        orderByClause =
          sortOrder === "asc"
            ? asc(products.createdAt)
            : desc(products.createdAt);
    }

    const data = await productsQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get summary
    const [summary] = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        lowStockCount: sql<number>`COUNT(CASE WHEN ${products.stock} < 10 THEN 1 END)`,
        totalValue: sql<number>`COALESCE(SUM(${products.price} * ${products.stock}), 0)`
      })
      .from(products)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(products)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data: data.map((product) => ({
        ...product,
        totalSold: Number(product.totalSold) || 0
      })),
      total: Number(count),
      summary: {
        totalProducts: Number(summary.totalProducts) || 0,
        lowStockCount: Number(summary.lowStockCount) || 0,
        totalValue: Number(summary.totalValue) || 0
      },
      limit,
      offset
    };
  }

  // ==================== ANALYTICS ====================

  async getSalesAnalytics(query: AnalyticsQueryDto) {
    const { period = "day", days = 30, distributorId } = query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where conditions
    const whereConditions = [gte(dailyStatistics.date, startDate)];

    if (distributorId) {
      whereConditions.push(eq(dailyStatistics.userId, distributorId));
    }

    // Get daily statistics
    const data = await db
      .select({
        date: sql<string>`DATE(${dailyStatistics.date})`,
        sales: sql<number>`SUM(${dailyStatistics.totalSales})`,
        orders: sql<number>`SUM(${dailyStatistics.totalOrders})`,
        payments: sql<number>`SUM(${dailyStatistics.totalPaymentsReceived})`
      })
      .from(dailyStatistics)
      .where(and(...whereConditions))
      .groupBy(sql`DATE(${dailyStatistics.date})`)
      .orderBy(sql`DATE(${dailyStatistics.date})`);

    // Calculate summary
    const totalSales = data.reduce((sum, row) => sum + Number(row.sales), 0);
    const totalOrders = data.reduce((sum, row) => sum + Number(row.orders), 0);
    const totalPayments = data.reduce(
      (sum, row) => sum + Number(row.payments),
      0
    );
    const averageDailySales = totalSales / (data.length || 1);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
      period,
      days,
      data: data.map((row) => ({
        date: row.date,
        sales: Number(row.sales) || 0,
        orders: Number(row.orders) || 0,
        payments: Number(row.payments) || 0
      })),
      summary: {
        totalSales,
        totalOrders,
        totalPayments,
        averageDailySales,
        averageOrderValue
      }
    };
  }

  async getTopDistributors(query: AnalyticsQueryDto) {
    const { limit = 10, days = 30, sortBy = "sales" } = query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get distributors with stats
    const data = await db
      .select({
        distributor: {
          id: users.id,
          name: users.name,
          phone: users.phone
        },
        sales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${orders.id})`,
        payments: sql<number>`COALESCE(SUM(CASE WHEN ${payments.amount} > 0 THEN ${payments.amount} ELSE 0 END), 0)`,
        debt: sql<number>`COALESCE(SUM(${shops.totalDebt}), 0)`,
        shopsCount: sql<number>`COUNT(DISTINCT ${shops.id})`
      })
      .from(users)
      .leftJoin(
        orders,
        and(eq(users.id, orders.userId), gte(orders.createdAt, startDate))
      )
      .leftJoin(
        payments,
        and(eq(users.id, payments.userId), gte(payments.createdAt, startDate))
      )
      .leftJoin(shops, eq(users.id, shops.userId))
      .where(eq(users.role, "user"))
      .groupBy(users.id, users.name, users.phone)
      .orderBy(desc(sql`COALESCE(SUM(${orders.totalPrice}), 0)`))
      .limit(limit);

    return {
      data: data.map((row, index) => ({
        rank: index + 1,
        distributor: row.distributor,
        sales: Number(row.sales) || 0,
        orders: Number(row.orders) || 0,
        payments: Number(row.payments) || 0,
        debt: Number(row.debt) || 0,
        shopsCount: Number(row.shopsCount) || 0,
        averageOrderValue:
          Number(row.orders) > 0 ? Number(row.sales) / Number(row.orders) : 0
      }))
    };
  }

  async getDebtOverview() {
    // Total debt
    const [totalDebtResult] = await db
      .select({
        totalDebt: sql<number>`COALESCE(SUM(${shops.totalDebt}), 0)`,
        shopsWithDebt: sql<number>`COUNT(CASE WHEN ${shops.totalDebt} > 0 THEN 1 END)`
      })
      .from(shops);

    // Debt aging
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [agingResult] = await db
      .select({
        current: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= ${thirtyDaysAgo} AND ${orders.remainingAmount} > 0 THEN ${orders.remainingAmount} ELSE 0 END), 0)`,
        currentCount: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= ${thirtyDaysAgo} AND ${orders.remainingAmount} > 0 THEN 1 END)`,
        overdue30: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= ${sixtyDaysAgo} AND ${orders.createdAt} < ${thirtyDaysAgo} AND ${orders.remainingAmount} > 0 THEN ${orders.remainingAmount} ELSE 0 END), 0)`,
        overdue30Count: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= ${sixtyDaysAgo} AND ${orders.createdAt} < ${thirtyDaysAgo} AND ${orders.remainingAmount} > 0 THEN 1 END)`,
        overdue60: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} < ${sixtyDaysAgo} AND ${orders.remainingAmount} > 0 THEN ${orders.remainingAmount} ELSE 0 END), 0)`,
        overdue60Count: sql<number>`COUNT(CASE WHEN ${orders.createdAt} < ${sixtyDaysAgo} AND ${orders.remainingAmount} > 0 THEN 1 END)`
      })
      .from(orders);

    // Top debtors
    const topDebtors = await db
      .select({
        shopId: shops.id,
        shopName: shops.name,
        distributorId: users.id,
        distributorName: users.name,
        debt: shops.totalDebt,
        daysSinceLastPayment: sql<number>`COALESCE(EXTRACT(DAY FROM (NOW() - MAX(${payments.createdAt}))), 999)`,
        oldestUnpaidOrder: sql<Date>`MIN(CASE WHEN ${orders.remainingAmount} > 0 THEN ${orders.createdAt} END)`
      })
      .from(shops)
      .leftJoin(users, eq(shops.userId, users.id))
      .leftJoin(payments, eq(shops.id, payments.shopId))
      .leftJoin(orders, eq(shops.id, orders.shopId))
      .where(sql`${shops.totalDebt} > 0`)
      .groupBy(shops.id, shops.name, shops.totalDebt, users.id, users.name)
      .orderBy(desc(shops.totalDebt))
      .limit(10);

    return {
      totalDebt: Number(totalDebtResult.totalDebt) || 0,
      shopsWithDebt: Number(totalDebtResult.shopsWithDebt) || 0,
      aging: {
        current: {
          amount: Number(agingResult.current) || 0,
          count: Number(agingResult.currentCount) || 0
        },
        overdue30: {
          amount: Number(agingResult.overdue30) || 0,
          count: Number(agingResult.overdue30Count) || 0
        },
        overdue60: {
          amount: Number(agingResult.overdue60) || 0,
          count: Number(agingResult.overdue60Count) || 0
        }
      },
      topDebtors: topDebtors.map((debtor) => ({
        shop: {
          id: debtor.shopId,
          name: debtor.shopName,
          distributor: {
            id: debtor.distributorId,
            name: debtor.distributorName
          }
        },
        debt: Number(debtor.debt) || 0,
        daysSinceLastPayment: Number(debtor.daysSinceLastPayment) || 0,
        oldestUnpaidOrder: debtor.oldestUnpaidOrder
      }))
    };
  }

  async getPaymentMethodsAnalytics(query: AnalyticsQueryDto) {
    const { days = 30 } = query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await db
      .select({
        method: payments.paymentMethod,
        amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(payments)
      .where(
        and(
          gte(payments.createdAt, startDate),
          sql`${payments.amount} > 0` // Only actual payments, not debt additions
        )
      )
      .groupBy(payments.paymentMethod);

    const total = results.reduce((sum, row) => sum + Number(row.amount), 0);

    return {
      total,
      breakdown: results.map((row) => ({
        method: row.method,
        amount: Number(row.amount) || 0,
        count: Number(row.count) || 0,
        percentage:
          total > 0 ? Math.round((Number(row.amount) / total) * 100) : 0
      }))
    };
  }

  // ==================== USERS ====================

  async getUsers(query: PaginationDto) {
    const { limit = 20, offset = 0, role, search, distributorId } = query;

    // Build where conditions
    const whereConditions = [];

    if (role) {
      whereConditions.push(eq(users.role, role));
    }

    if (search) {
      whereConditions.push(
        or(like(users.name, `%${search}%`), like(users.phone, `%${search}%`))
      );
    }

    if (distributorId && role === "agent") {
      whereConditions.push(eq(employees.distributorId, distributorId));
    }

    // Get users with stats
    const usersQuery = db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
        shopsCount: sql<number>`COUNT(DISTINCT ${shops.id})`,
        ordersCount: sql<number>`COUNT(DISTINCT ${orders.id})`,
        totalSales: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)`
      })
      .from(users)
      .leftJoin(employees, eq(users.id, employees.userId))
      .leftJoin(shops, eq(users.id, shops.userId))
      .leftJoin(orders, eq(users.id, orders.userId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(users.id, users.name, users.phone, users.role, users.createdAt);

    const data = await usersQuery
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Get counts by role
    const [summary] = await db
      .select({
        distributors: sql<number>`COUNT(CASE WHEN ${users.role} = 'user' THEN 1 END)`,
        agents: sql<number>`COUNT(CASE WHEN ${users.role} = 'agent' THEN 1 END)`,
        admins: sql<number>`COUNT(CASE WHEN ${users.role} = 'admin' THEN 1 END)`
      })
      .from(users);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data: data.map((user) => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        stats:
          user.role === "user"
            ? {
                shopsCount: Number(user.shopsCount) || 0,
                ordersCount: Number(user.ordersCount) || 0,
                totalSales: Number(user.totalSales) || 0
              }
            : undefined
      })),
      total: Number(count),
      summary: {
        distributors: Number(summary.distributors) || 0,
        agents: Number(summary.agents) || 0,
        admins: Number(summary.admins) || 0
      },
      limit,
      offset
    };
  }

  // ==================== TELEGRAM ====================

  async getTelegramStatus() {

    // Get shop connection stats
    const [stats] = await db
      .select({
        totalShops: sql<number>`COUNT(*)`,
        connectedShops: sql<number>`COUNT(CASE WHEN ${shops.chatId} IS NOT NULL THEN 1 END)`,
        notConnectedShops: sql<number>`COUNT(CASE WHEN ${shops.chatId} IS NULL THEN 1 END)`
      })
      .from(shops);

    // Get today's notification stats (you'll need to import notificationLogs)
    // For now, we'll return mock data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      botOnline: true, // You can add actual bot health check here
      botUsername: "teztarqatbot", // From your config
      stats: {
        totalShops: Number(stats.totalShops) || 0,
        connectedShops: Number(stats.connectedShops) || 0,
        notConnectedShops: Number(stats.notConnectedShops) || 0,
        notificationsSentToday: 0, // Implement with notificationLogs
        failedNotificationsToday: 0 // Implement with notificationLogs
      }
    };
  }

  async getNotificationLogs(query: PaginationDto) {
    // This requires the notificationLogs table to be implemented
    // Return mock data for now
    return {
      data: [],
      total: 0,
      limit: query.limit || 20,
      offset: query.offset || 0
    };
  }
}
