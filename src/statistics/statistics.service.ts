import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { db } from "../db/db";
import { dailyStatistics, orders, payments, shops } from "../db/schema";
import { eq, and, gte, lt, sql, gt } from "drizzle-orm";

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  // Run every day at midnight (00:00)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyStatisticsCron() {
    this.logger.log("Running daily statistics calculation...");
    try {
      await this.calculateAndStoreDailyStatistics();
      this.logger.log("Daily statistics calculation completed successfully");
    } catch (error) {
      this.logger.error("Failed to calculate daily statistics", error);
    }
  }

  async calculateAndStoreDailyStatistics(targetDate?: Date) {
    const date = targetDate || new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all unique user IDs (distributors) from shops
    const distributors = await db
      .selectDistinct({ userId: shops.userId })
      .from(shops);

    for (const distributor of distributors) {
      await this.calculateStatsForUser(distributor.userId, startOfDay, endOfDay);
    }
  }

  private async calculateStatsForUser(
    userId: number,
    startOfDay: Date,
    endOfDay: Date
  ) {
    // Calculate total sales for the day (from orders)
    const dailyOrders = await db
      .select({
        totalPrice: orders.totalPrice
      })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startOfDay),
          lt(orders.createdAt, endOfDay)
        )
      );

    const totalSales = dailyOrders.reduce(
      (sum, order) => sum + Number(order.totalPrice),
      0
    );
    const totalOrders = dailyOrders.length;

    // Calculate total payments received for the day
    const dailyPayments = await db
      .select({
        amount: payments.amount
      })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          gte(payments.createdAt, startOfDay),
          lt(payments.createdAt, endOfDay)
        )
      );

    // Only count positive amounts (actual payments, not debt additions)
    const totalPaymentsReceived = dailyPayments.reduce((sum, payment) => {
      const amount = Number(payment.amount);
      return amount > 0 ? sum + amount : sum;
    }, 0);

    // Calculate total debt from all shops
    const shopsData = await db
      .select({
        totalDebt: shops.totalDebt
      })
      .from(shops)
      .where(eq(shops.userId, userId));

    const totalDebt = shopsData.reduce(
      (sum, shop) => sum + Number(shop.totalDebt),
      0
    );
    const shopsWithDebt = shopsData.filter(
      (shop) => Number(shop.totalDebt) > 0
    ).length;

    // Check if stats already exist for this date and user
    const existingStats = await db
      .select()
      .from(dailyStatistics)
      .where(
        and(
          eq(dailyStatistics.userId, userId),
          gte(dailyStatistics.date, startOfDay),
          lt(dailyStatistics.date, endOfDay)
        )
      )
      .limit(1);

    if (existingStats.length > 0) {
      // Update existing record
      await db
        .update(dailyStatistics)
        .set({
          totalSales: totalSales.toFixed(2),
          totalOrders,
          totalPaymentsReceived: totalPaymentsReceived.toFixed(2),
          totalDebt: totalDebt.toFixed(2),
          shopsWithDebt,
          updatedAt: new Date()
        })
        .where(eq(dailyStatistics.id, existingStats[0].id));
    } else {
      // Insert new record
      await db.insert(dailyStatistics).values({
        userId,
        date: startOfDay,
        totalSales: totalSales.toFixed(2),
        totalOrders,
        totalPaymentsReceived: totalPaymentsReceived.toFixed(2),
        totalDebt: totalDebt.toFixed(2),
        shopsWithDebt
      });
    }
  }

  // Get today's statistics for a user
  async getTodayStats(userId: number) {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Calculate real-time stats for today
    const dailyOrders = await db
      .select({
        totalPrice: orders.totalPrice
      })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startOfDay),
          lt(orders.createdAt, endOfDay)
        )
      );

    const totalSales = dailyOrders.reduce(
      (sum, order) => sum + Number(order.totalPrice),
      0
    );

    const dailyPayments = await db
      .select({
        amount: payments.amount
      })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          gte(payments.createdAt, startOfDay),
          lt(payments.createdAt, endOfDay)
        )
      );

    const totalPaymentsReceived = dailyPayments.reduce((sum, payment) => {
      const amount = Number(payment.amount);
      return amount > 0 ? sum + amount : sum;
    }, 0);

    const shopsData = await db
      .select({
        id: shops.id,
        name: shops.name,
        totalDebt: shops.totalDebt
      })
      .from(shops)
      .where(eq(shops.userId, userId));

    const totalDebt = shopsData.reduce(
      (sum, shop) => sum + Number(shop.totalDebt),
      0
    );
    const shopsWithDebt = shopsData.filter(
      (shop) => Number(shop.totalDebt) > 0
    );

    return {
      date: startOfDay.toISOString().split("T")[0],
      totalSales,
      totalOrders: dailyOrders.length,
      totalPaymentsReceived,
      totalDebt,
      shopsWithDebtCount: shopsWithDebt.length,
      shopsWithDebt: shopsWithDebt.map((shop) => ({
        id: shop.id,
        name: shop.name,
        debt: Number(shop.totalDebt)
      }))
    };
  }

  // Get statistics history for a user
  async getStatsHistory(userId: number, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await db
      .select()
      .from(dailyStatistics)
      .where(
        and(
          eq(dailyStatistics.userId, userId),
          gte(dailyStatistics.date, startDate),
          lt(dailyStatistics.date, endDate)
        )
      )
      .orderBy(dailyStatistics.date);

    return history.map((stat) => ({
      date: stat.date.toISOString().split("T")[0],
      totalSales: Number(stat.totalSales),
      totalOrders: stat.totalOrders,
      totalPaymentsReceived: Number(stat.totalPaymentsReceived),
      totalDebt: Number(stat.totalDebt),
      shopsWithDebt: stat.shopsWithDebt
    }));
  }

  // Get all shops with their debts
  async getAllShopsDebt(userId: number) {
    const shopsData = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        address: shops.address,
        totalDebt: shops.totalDebt
      })
      .from(shops)
      .where(eq(shops.userId, userId))
      .orderBy(sql`${shops.totalDebt}::numeric DESC`);

    const totalDebt = shopsData.reduce(
      (sum, shop) => sum + Number(shop.totalDebt),
      0
    );

    return {
      totalDebt,
      shopsCount: shopsData.length,
      shopsWithDebtCount: shopsData.filter((s) => Number(s.totalDebt) > 0)
        .length,
      shops: shopsData.map((shop) => ({
        ...shop,
        totalDebt: Number(shop.totalDebt)
      }))
    };
  }

  // Manually trigger statistics calculation (useful for testing or admin)
  async recalculateStatistics(userId: number, date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    await this.calculateStatsForUser(userId, startOfDay, endOfDay);

    return { message: "Statistics recalculated successfully", date: startOfDay };
  }
}
