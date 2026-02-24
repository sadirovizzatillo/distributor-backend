// payment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException
} from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { payments, shops, users } from "../db/schema";
import { db } from "../db/db";
import { TelegramBotService } from "../telegram/telegram.service";

@Injectable()
export class PaymentService {
  constructor(private readonly telegramBotService: TelegramBotService) {}
  // Add manual debt for historical debt before using app
  async addManualDebt(
    distributorId: number,
    shopId: number,
    debtAmount: number,
    notes?: string
  ) {
    // Validate amount
    if (debtAmount <= 0) {
      throw new BadRequestException("Debt amount must be greater than 0");
    }

    // Check if shop belongs to this distributor
    const shop = await db
      .select()
      .from(shops)
      .where(and(eq(shops.id, shopId), eq(shops.userId, distributorId)))
      .limit(1);

    if (!shop || shop.length === 0) {
      throw new NotFoundException("Shop not found or does not belong to you");
    }

    // Get distributor details
    const distributor = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, distributorId))
      .limit(1);

    if (!distributor || distributor.length === 0) {
      throw new NotFoundException("Distributor not found");
    }

    const currentDebt = Number(shop[0].totalDebt);
    const newDebt = currentDebt + debtAmount;

    // Create a record in payments table (negative amount = debt added)
    const [debtRecord] = await db
      .insert(payments)
      .values({
        userId: distributorId,
        shopId: shopId,
        amount: (-debtAmount).toString(), // Negative = debt added
        paymentMethod: "manual_debt",
        receivedBy: distributorId,
        notes: notes || "Oldingi qarz qo'shildi"
      })
      .returning();

    // Update debt in shops table
    await db
      .update(shops)
      .set({
        totalDebt: newDebt.toString()
      })
      .where(eq(shops.id, shopId));

    // Prepare response data
    const responseData = {
      debtRecord,
      user: distributor[0],
      previousDebt: currentDebt,
      newDebt: newDebt,
      addedAmount: debtAmount,
      message: "Manual debt added successfully"
    };

    // Send Telegram notification if shop has chatId
    if (shop[0].chatId) {
      try {
        await this.telegramBotService.sendManualDebtNotification(
          shop[0].chatId,
          responseData
        );
        console.log(`✅ Manual debt notification sent to shop: ${shop[0].name}`);
      } catch (error) {
        console.error(`❌ Failed to send manual debt notification:`, error);
        // Don't throw - debt should be added even if notification fails
      }
    } else {
      console.warn(`⚠️ Shop ${shop[0].name} does not have chatId configured`);
    }

    return responseData;
  }

  // Set exact debt amount (replaces current debt)
  async setExactDebt(
    distributorId: number,
    shopId: number,
    debtAmount: number,
    notes?: string
  ) {
    // Validate amount
    if (debtAmount < 0) {
      throw new BadRequestException("Debt amount cannot be negative");
    }

    // Check if shop belongs to this distributor
    const shop = await db
      .select()
      .from(shops)
      .where(and(eq(shops.id, shopId), eq(shops.userId, distributorId)))
      .limit(1);

    if (!shop || shop.length === 0) {
      throw new NotFoundException("Shop not found or does not belong to you");
    }

    // Get distributor details
    const distributor = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, distributorId))
      .limit(1);

    if (!distributor || distributor.length === 0) {
      throw new NotFoundException("Distributor not found");
    }

    const currentDebt = Number(shop[0].totalDebt);
    const difference = debtAmount - currentDebt;

    // Create audit record
    const [debtRecord] = await db
      .insert(payments)
      .values({
        userId: distributorId,
        shopId: shopId,
        amount: (-difference).toString(),
        paymentMethod: "debt_adjustment",
        receivedBy: distributorId,
        notes: notes || `Qarz to'g'rilandi: ${currentDebt} → ${debtAmount}`
      })
      .returning();

    // Set exact debt
    await db
      .update(shops)
      .set({
        totalDebt: debtAmount.toString()
      })
      .where(eq(shops.id, shopId));

    return {
      debtRecord,
      user: distributor[0],
      previousDebt: currentDebt,
      newDebt: debtAmount,
      adjustment: difference,
      message: "Debt amount set successfully"
    };
  }

  // Get debt history including manual adjustments
  async getDebtHistory(
    distributorId: number,
    shopId: number,
    limit: number = 50
  ) {
    // Verify shop belongs to distributor
    const shop = await db
      .select()
      .from(shops)
      .where(and(eq(shops.id, shopId), eq(shops.userId, distributorId)))
      .limit(1);

    if (!shop || shop.length === 0) {
      throw new NotFoundException("Shop not found or does not belong to you");
    }

    // Get all payment records
    const history = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        receivedByName: users.name
      })
      .from(payments)
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .where(
        and(eq(payments.shopId, shopId), eq(payments.userId, distributorId))
      )
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return {
      shopId,
      shopName: shop[0].name,
      currentDebt: Number(shop[0].totalDebt),
      history: history.map((record) => ({
        ...record,
        amount: Number(record.amount),
        type: Number(record.amount) < 0 ? "debt_added" : "payment_received",
        displayAmount: Math.abs(Number(record.amount))
      }))
    };
  }

  async createPayment(
    distributorId: number,
    shopId: number,
    amount: number,
    paymentMethod: string = "cash",
    receivedBy?: number,
    notes?: string
  ) {
    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException("Payment amount must be greater than 0");
    }

    // Check if shop belongs to this distributor
    const shop = await db
      .select()
      .from(shops)
      .where(and(eq(shops.id, shopId), eq(shops.userId, distributorId)))
      .limit(1);

    if (!shop || shop.length === 0) {
      throw new NotFoundException("Shop not found or does not belong to you");
    }

    // Get distributor details
    const distributor = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, distributorId))
      .limit(1);

    if (!distributor || distributor.length === 0) {
      throw new NotFoundException("Distributor not found");
    }

    const currentDebt = Number(shop[0].totalDebt);

    // Check if payment exceeds debt
    if (amount > currentDebt) {
      throw new BadRequestException(
        `Payment amount (${amount}) exceeds total debt (${currentDebt})`
      );
    }

    // Create payment record
    const newPayment = await db
      .insert(payments)
      .values({
        userId: distributorId,
        shopId: shopId,
        amount: amount.toString(),
        paymentMethod: paymentMethod,
        receivedBy: receivedBy,
        notes: notes
      })
      .returning();

    // Update debt in shops table
    const newDebt = currentDebt - amount;
    await db
      .update(shops)
      .set({
        totalDebt: newDebt.toString()
      })
      .where(eq(shops.id, shopId));

    // Prepare response data
    const responseData = {
      payment: newPayment[0],
      user: distributor[0],
      previousDebt: currentDebt,
      newDebt: newDebt,
      message: "Payment received successfully"
    };

    // Send Telegram notification if shop has chatId
    if (shop[0].chatId) {
      try {
        await this.telegramBotService.sendPaymentNotification(
          shop[0].chatId,
          responseData
        );
        console.log(`✅ Payment notification sent to shop: ${shop[0].name}`);
      } catch (error) {
        console.error(`❌ Failed to send payment notification:`, error);
        // Don't throw - payment should complete even if notification fails
      }
    } else {
      console.warn(`⚠️ Shop ${shop[0].name} does not have chatId configured`);
    }

    return responseData;
  }

  async getShopDebt(distributorId: number, shopId: number) {
    const shop = await db
      .select({
        id: shops.id,
        name: shops.name,
        totalDebt: shops.totalDebt,
        ownerName: shops.ownerName,
        phone: shops.phone,
        address: shops.address
      })
      .from(shops)
      .where(and(eq(shops.id, shopId), eq(shops.userId, distributorId)))
      .limit(1);

    if (!shop || shop.length === 0) {
      throw new NotFoundException("Shop not found or does not belong to you");
    }

    return shop[0];
  }

  async getPaymentHistory(
    distributorId: number,
    shopId: number,
    limit: number = 50
  ) {
    // First verify shop belongs to distributor
    await this.getShopDebt(distributorId, shopId);

    const paymentHistory = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        receivedBy: payments.receivedBy,
        receiverName: users.name
      })
      .from(payments)
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .where(
        and(eq(payments.userId, distributorId), eq(payments.shopId, shopId))
      )
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return paymentHistory;
  }

  async getAllPaymentsForDistributor(
    distributorId: number,
    limit: number = 100
  ) {
    const allPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        shopId: payments.shopId,
        shopName: shops.name,
        receivedBy: payments.receivedBy,
        receiverName: users.name
      })
      .from(payments)
      .leftJoin(shops, eq(payments.shopId, shops.id))
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .where(eq(payments.userId, distributorId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return allPayments;
  }

  async getAllPayments(limit: number = 100) {
    const receiver = alias(users, "receiver");
    const agent = alias(users, "agent");

    const result = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        shop: {
          id: shops.id,
          name: shops.name,
          ownerName: shops.ownerName,
          phone: shops.phone,
        },
        receivedBy: {
          id: receiver.id,
          name: receiver.name,
          phone: receiver.phone,
        },
        agentId: agent.id,
        agentName: agent.name,
        agentPhone: agent.phone,
      })
      .from(payments)
      .leftJoin(shops, eq(payments.shopId, shops.id))
      .leftJoin(receiver, eq(payments.receivedBy, receiver.id))
      .leftJoin(agent, eq(payments.userId, agent.id))
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return result.map(({ agentId, agentName, agentPhone, ...payment }) => ({
      ...payment,
      agent: agentId ? { id: agentId, name: agentName, phone: agentPhone } : null,
    }));
  }

  async getPaymentStats(distributorId: number, shopId: number) {
    // Verify shop belongs to distributor
    await this.getShopDebt(distributorId, shopId);

    // Get total payments
    const allPayments = await db
      .select({
        amount: payments.amount
      })
      .from(payments)
      .where(
        and(eq(payments.userId, distributorId), eq(payments.shopId, shopId))
      );

    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Get current debt
    const shop = await this.getShopDebt(distributorId, shopId);

    return {
      totalPaid: totalPaid,
      currentDebt: Number(shop.totalDebt),
      totalCount: allPayments.length,
      shopName: shop.name
    };
  }

  async getAllShopsWithDebt(distributorId: number) {
    const shopsWithDebt = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        totalDebt: shops.totalDebt,
        address: shops.address
      })
      .from(shops)
      .where(eq(shops.userId, distributorId))
      .orderBy(desc(shops.totalDebt));

    return shopsWithDebt;
  }
}
