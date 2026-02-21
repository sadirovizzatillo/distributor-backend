import { Injectable } from "@nestjs/common";
import { db } from "../db/db";
import {
  users,
  shops,
  orders,
  payments,
  products,
  employees,
  orderItems
} from "../db/schema";
import { eq, and, gte, lt, lte, sql, desc, asc, count } from "drizzle-orm";

@Injectable()
export class DistributorService {
  // Statistics - Unified endpoint for Statistics page
  async getStatistics(userId: number, days: number = 30) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);

    // Debt aging date boundaries
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [
      salesToday,
      ordersToday,
      paymentsToday,
      newShopsToday,
      newEmployeesToday,
      salesYesterday,
      ordersYesterday,
      paymentsYesterday,
      periodOrders,
      periodPayments,
      periodActiveShops,
      periodNewShops,
      dailyDataResult,
      topProductsResult,
      topShopsResult,
      paymentMethodsResult,
      shopsWithDebt
    ] = await Promise.all([
      // Today's sales
      db
        .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
        .from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfDay), lt(orders.createdAt, endOfDay))),
      // Today's orders count
      db
        .select({ count: count() })
        .from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfDay), lt(orders.createdAt, endOfDay))),
      // Today's payments
      db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)` })
        .from(payments)
        .where(and(eq(payments.userId, userId), gte(payments.createdAt, startOfDay), lt(payments.createdAt, endOfDay))),
      // New shops today
      db
        .select({ count: count() })
        .from(shops)
        .where(and(eq(shops.userId, userId), gte(shops.createdAt, startOfDay))),
      // New employees today
      db
        .select({ count: count() })
        .from(employees)
        .where(and(eq(employees.distributorId, userId), gte(employees.id, 0))),
      // Yesterday's sales
      db
        .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
        .from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfYesterday), lt(orders.createdAt, endOfYesterday))),
      // Yesterday's orders count
      db
        .select({ count: count() })
        .from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfYesterday), lt(orders.createdAt, endOfYesterday))),
      // Yesterday's payments
      db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)` })
        .from(payments)
        .where(and(eq(payments.userId, userId), gte(payments.createdAt, startOfYesterday), lt(payments.createdAt, endOfYesterday))),
      // Period: total orders + sales
      db
        .select({
          totalSales: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)`,
          totalOrders: count()
        })
        .from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, periodStart))),
      // Period: total payments
      db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)` })
        .from(payments)
        .where(and(eq(payments.userId, userId), gte(payments.createdAt, periodStart))),
      // Period: active shops (distinct shops with orders)
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${orders.shopId})` })
        .from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, periodStart))),
      // Period: new shops
      db
        .select({ count: count() })
        .from(shops)
        .where(and(eq(shops.userId, userId), gte(shops.createdAt, periodStart))),
      // Daily data (sales, orders, payments per day)
      db.execute(sql`
        SELECT
          d.date,
          COALESCE(o.sales, 0) as sales,
          COALESCE(o.orders, 0) as orders,
          COALESCE(p.payments, 0) as payments
        FROM (
          SELECT generate_series(
            ${periodStart}::date,
            ${now}::date,
            '1 day'::interval
          )::date as date
        ) d
        LEFT JOIN (
          SELECT DATE(created_at) as date,
            SUM(total_price::numeric) as sales,
            COUNT(*) as orders
          FROM orders
          WHERE user_id = ${userId} AND created_at >= ${periodStart}
          GROUP BY DATE(created_at)
        ) o ON d.date = o.date
        LEFT JOIN (
          SELECT DATE(created_at) as date,
            SUM(CASE WHEN amount::numeric > 0 THEN amount::numeric ELSE 0 END) as payments
          FROM payments
          WHERE user_id = ${userId} AND created_at >= ${periodStart}
          GROUP BY DATE(created_at)
        ) p ON d.date = p.date
        ORDER BY d.date ASC
      `),
      // Top 5 products
      db.execute(sql`
        SELECT
          p.id,
          p.name,
          p.price::numeric as price,
          COALESCE(SUM(oi.quantity), 0) as total_sold,
          COALESCE(SUM(oi.quantity * oi.price_at_time::numeric), 0) as total_revenue
        FROM products p
        INNER JOIN order_items oi ON p.id = oi.product_id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE p.user_id = ${userId}
          AND o.created_at >= ${periodStart}
        GROUP BY p.id, p.name, p.price
        ORDER BY total_sold DESC
        LIMIT 5
      `),
      // Top 5 shops
      db.execute(sql`
        SELECT
          s.id,
          s.name,
          s.owner_name,
          s.total_debt::numeric as total_debt,
          COALESCE(SUM(o.total_price::numeric), 0) as total_sales,
          COUNT(o.id) as order_count,
          (SELECT EXTRACT(DAY FROM NOW() - MAX(p.created_at))
           FROM payments p WHERE p.shop_id = s.id AND p.amount::numeric > 0
          ) as days_since_last_payment,
          (SELECT MAX(o2.created_at)
           FROM orders o2 WHERE o2.shop_id = s.id
          ) as last_order_date
        FROM shops s
        LEFT JOIN orders o ON s.id = o.shop_id AND o.created_at >= ${periodStart}
        WHERE s.user_id = ${userId}
        GROUP BY s.id, s.name, s.owner_name, s.total_debt
        ORDER BY total_sales DESC
        LIMIT 5
      `),
      // Payment methods breakdown
      db.execute(sql`
        SELECT
          payment_method,
          COALESCE(SUM(CASE WHEN amount::numeric > 0 THEN amount::numeric ELSE 0 END), 0) as total
        FROM payments
        WHERE user_id = ${userId}
          AND created_at >= ${periodStart}
        GROUP BY payment_method
      `),
      // Shops with debt (for aging)
      db
        .select({
          id: shops.id,
          totalDebt: shops.totalDebt,
          createdAt: shops.createdAt
        })
        .from(shops)
        .where(and(eq(shops.userId, userId), sql`${shops.totalDebt}::numeric > 0`))
    ]);

    // Calculate % change helpers
    const calcChange = (today: number, yesterday: number): number => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Number((((today - yesterday) / yesterday) * 100).toFixed(1));
    };

    const todaySalesNum = Number(salesToday[0]?.total || 0);
    const todayOrdersNum = ordersToday[0]?.count || 0;
    const todayPaymentsNum = Number(paymentsToday[0]?.total || 0);
    const yesterdaySalesNum = Number(salesYesterday[0]?.total || 0);
    const yesterdayOrdersNum = ordersYesterday[0]?.count || 0;
    const yesterdayPaymentsNum = Number(paymentsYesterday[0]?.total || 0);

    const periodTotalSales = Number(periodOrders[0]?.totalSales || 0);
    const periodTotalOrders = periodOrders[0]?.totalOrders || 0;

    // Debt aging: categorize shops
    const debtAgingTotals = { current: 0, overdue7: 0, overdue30: 0, overdue60: 0 };

    // For each shop with debt, find oldest unpaid order
    const agingPromises = shopsWithDebt.map(async (shop) => {
      const [oldestOrder] = await db
        .select({ createdAt: orders.createdAt })
        .from(orders)
        .where(and(eq(orders.shopId, shop.id), sql`${orders.remainingAmount}::numeric > 0`))
        .orderBy(asc(orders.createdAt))
        .limit(1);

      const ageDate = oldestOrder?.createdAt || shop.createdAt;
      const debtAmount = Number(shop.totalDebt);

      if (ageDate >= sevenDaysAgo) {
        debtAgingTotals.current += debtAmount;
      } else if (ageDate >= thirtyDaysAgo) {
        debtAgingTotals.overdue7 += debtAmount;
      } else if (ageDate >= sixtyDaysAgo) {
        debtAgingTotals.overdue30 += debtAmount;
      } else {
        debtAgingTotals.overdue60 += debtAmount;
      }
    });

    await Promise.all(agingPromises);

    return {
      today: {
        sales: todaySalesNum,
        salesChange: calcChange(todaySalesNum, yesterdaySalesNum),
        orders: todayOrdersNum,
        ordersChange: calcChange(todayOrdersNum, yesterdayOrdersNum),
        paymentsReceived: todayPaymentsNum,
        paymentsChange: calcChange(todayPaymentsNum, yesterdayPaymentsNum),
        newShops: newShopsToday[0]?.count || 0,
        newEmployees: newEmployeesToday[0]?.count || 0
      },
      period: {
        days,
        totalSales: periodTotalSales,
        totalOrders: periodTotalOrders,
        totalPayments: Number(periodPayments[0]?.total || 0),
        activeShops: periodActiveShops[0]?.count || 0,
        newShops: periodNewShops[0]?.count || 0,
        averageOrderValue: periodTotalOrders > 0
          ? Number((periodTotalSales / periodTotalOrders).toFixed(2))
          : 0
      },
      dailyData: dailyDataResult.rows.map((row: any) => ({
        date: row.date,
        sales: Number(row.sales),
        orders: Number(row.orders),
        payments: Number(row.payments)
      })),
      topProducts: topProductsResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        totalSold: Number(row.total_sold),
        totalRevenue: Number(row.total_revenue)
      })),
      topShops: topShopsResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        ownerName: row.owner_name,
        totalDebt: Number(row.total_debt),
        totalSales: Number(row.total_sales),
        orderCount: Number(row.order_count),
        daysSinceLastPayment: row.days_since_last_payment != null ? Number(row.days_since_last_payment) : null,
        lastOrderDate: row.last_order_date || null
      })),
      paymentMethods: paymentMethodsResult.rows.map((row: any) => ({
        method: row.payment_method,
        total: Number(row.total)
      })),
      debtAging: {
        current: Number(debtAgingTotals.current.toFixed(2)),
        overdue7: Number(debtAgingTotals.overdue7.toFixed(2)),
        overdue30: Number(debtAgingTotals.overdue30.toFixed(2)),
        overdue60: Number(debtAgingTotals.overdue60.toFixed(2))
      }
    };
  }

  // Dashboard - Personal metrics overview
  async getDashboard(userId: number) {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Today's metrics
    const salesToday = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startOfDay),
          lt(orders.createdAt, endOfDay)
        )
      );

    const ordersToday = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startOfDay),
          lt(orders.createdAt, endOfDay)
        )
      );

    const paymentsToday = await db
      .select({
        total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)`
      })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          gte(payments.createdAt, startOfDay),
          lt(payments.createdAt, endOfDay)
        )
      );

    // Yesterday's metrics for comparison
    const salesYesterday = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startOfYesterday),
          lt(orders.createdAt, endOfYesterday)
        )
      );

    const ordersYesterday = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startOfYesterday),
          lt(orders.createdAt, endOfYesterday)
        )
      );

    // This week metrics
    const salesThisWeek = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfWeek)));

    const ordersThisWeek = await db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfWeek)));

    // This month metrics
    const salesThisMonth = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfMonth)));

    const ordersThisMonth = await db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.userId, userId), gte(orders.createdAt, startOfMonth)));

    // Total counts
    const totalShops = await db
      .select({ count: count() })
      .from(shops)
      .where(eq(shops.userId, userId));

    const totalProducts = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.userId, userId));

    const totalEmployees = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.distributorId, userId));

    // Debt metrics
    const debtStats = await db
      .select({
        totalDebt: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)`,
        shopsWithDebt: sql<number>`COUNT(CASE WHEN ${shops.totalDebt}::numeric > 0 THEN 1 END)`
      })
      .from(shops)
      .where(eq(shops.userId, userId));

    // Low stock products count
    const lowStockCount = await db
      .select({ count: count() })
      .from(products)
      .where(and(eq(products.userId, userId), lte(products.stock, 10)));

    // Pending orders count
    const pendingOrders = await db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "pending")));

    return {
      today: {
        sales: Number(salesToday[0]?.total || 0),
        orders: ordersToday[0]?.count || 0,
        paymentsReceived: Number(paymentsToday[0]?.total || 0)
      },
      yesterday: {
        sales: Number(salesYesterday[0]?.total || 0),
        orders: ordersYesterday[0]?.count || 0
      },
      thisWeek: {
        sales: Number(salesThisWeek[0]?.total || 0),
        orders: ordersThisWeek[0]?.count || 0
      },
      thisMonth: {
        sales: Number(salesThisMonth[0]?.total || 0),
        orders: ordersThisMonth[0]?.count || 0
      },
      totals: {
        shops: totalShops[0]?.count || 0,
        products: totalProducts[0]?.count || 0,
        employees: totalEmployees[0]?.count || 0
      },
      debt: {
        total: Number(debtStats[0]?.totalDebt || 0),
        shopsWithDebt: debtStats[0]?.shopsWithDebt || 0
      },
      alerts: {
        lowStockProducts: lowStockCount[0]?.count || 0,
        pendingOrders: pendingOrders[0]?.count || 0
      }
    };
  }

  // Analytics - Sales trends
  async getSalesTrends(
    userId: number,
    period: "day" | "week" | "month" = "day",
    days: number = 30
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let dateFormat: string;

    switch (period) {
      case "week":
        dateFormat = "YYYY-WW";
        break;
      case "month":
        dateFormat = "YYYY-MM";
        break;
      default:
        dateFormat = "YYYY-MM-DD";
    }

    const salesData = await db.execute(sql`
      SELECT
        ${period === "day" ? sql`DATE(created_at)` : sql`TO_CHAR(created_at, ${dateFormat})`} as date,
        COALESCE(SUM(total_price::numeric), 0) as sales,
        COUNT(*) as orders
      FROM orders
      WHERE user_id = ${userId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY ${period === "day" ? sql`DATE(created_at)` : sql`TO_CHAR(created_at, ${dateFormat})`}
      ORDER BY date DESC
    `);

    // Calculate totals
    const totals = await db
      .select({
        sales: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)`,
        orders: count()
      })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        )
      );

    return {
      period,
      days,
      data: salesData.rows.map((row: any) => ({
        date: row.date,
        sales: Number(row.sales),
        orders: Number(row.orders)
      })),
      totals: {
        sales: Number(totals[0]?.sales || 0),
        orders: totals[0]?.orders || 0
      }
    };
  }

  // Analytics - Product performance
  async getProductAnalytics(userId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const productStats = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.price::numeric as price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.quantity * oi.price_at_time::numeric), 0) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.created_at >= ${startDate}
      WHERE p.user_id = ${userId}
      GROUP BY p.id, p.name, p.price, p.stock
      ORDER BY total_revenue DESC
      LIMIT 20
    `);

    return {
      period: `${days} days`,
      products: productStats.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        stock: row.stock,
        totalSold: Number(row.total_sold),
        totalRevenue: Number(row.total_revenue),
        orderCount: Number(row.order_count)
      }))
    };
  }

  // Analytics - Shop performance
  async getShopAnalytics(userId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const shopStats = await db.execute(sql`
      SELECT
        s.id,
        s.name,
        s.owner_name,
        s.phone,
        s.total_debt::numeric as total_debt,
        COALESCE(SUM(o.total_price::numeric), 0) as total_sales,
        COUNT(o.id) as order_count,
        COALESCE(SUM(CASE WHEN p.amount::numeric > 0 THEN p.amount::numeric ELSE 0 END), 0) as payments_received
      FROM shops s
      LEFT JOIN orders o ON s.id = o.shop_id AND o.created_at >= ${startDate}
      LEFT JOIN payments p ON s.id = p.shop_id AND p.created_at >= ${startDate}
      WHERE s.user_id = ${userId}
      GROUP BY s.id, s.name, s.owner_name, s.phone, s.total_debt
      ORDER BY total_sales DESC
    `);

    return {
      period: `${days} days`,
      shops: shopStats.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        ownerName: row.owner_name,
        phone: row.phone,
        totalDebt: Number(row.total_debt),
        totalSales: Number(row.total_sales),
        orderCount: Number(row.order_count),
        paymentsReceived: Number(row.payments_received)
      }))
    };
  }

  // Shop performance ranking
  async getShopsPerformance(userId: number, limit: number = 20) {
    const shopStats = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        totalDebt: shops.totalDebt,
        totalSales: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)`,
        orderCount: count()
      })
      .from(shops)
      .leftJoin(orders, eq(shops.id, orders.shopId))
      .where(eq(shops.userId, userId))
      .groupBy(shops.id, shops.name, shops.ownerName, shops.phone, shops.totalDebt)
      .orderBy(sql`SUM(${orders.totalPrice}::numeric) DESC NULLS LAST`)
      .limit(limit);

    return shopStats.map((shop) => ({
      ...shop,
      totalDebt: Number(shop.totalDebt),
      totalSales: Number(shop.totalSales)
    }));
  }

  // Shop debt ranking
  async getShopsDebtRanking(userId: number, limit: number = 20) {
    const shopsWithDebt = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        address: shops.address,
        totalDebt: shops.totalDebt,
        createdAt: shops.createdAt
      })
      .from(shops)
      .where(and(eq(shops.userId, userId), sql`${shops.totalDebt}::numeric > 0`))
      .orderBy(sql`${shops.totalDebt}::numeric DESC`)
      .limit(limit);

    return shopsWithDebt.map((shop) => ({
      ...shop,
      totalDebt: Number(shop.totalDebt)
    }));
  }

  // Shop activity (recent orders & payments)
  async getShopActivity(userId: number, shopId: number, limit: number = 20) {
    // Verify shop belongs to user
    const [shop] = await db
      .select()
      .from(shops)
      .where(and(eq(shops.id, shopId), eq(shops.userId, userId)));

    if (!shop) {
      return null;
    }

    // Recent orders
    const recentOrders = await db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        createdAt: orders.createdAt
      })
      .from(orders)
      .where(eq(orders.shopId, shopId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    // Recent payments
    const recentPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt
      })
      .from(payments)
      .where(eq(payments.shopId, shopId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return {
      shop: {
        id: shop.id,
        name: shop.name,
        ownerName: shop.ownerName,
        phone: shop.phone,
        address: shop.address,
        totalDebt: Number(shop.totalDebt)
      },
      recentOrders: recentOrders.map((o) => ({
        ...o,
        totalPrice: Number(o.totalPrice),
        remainingAmount: Number(o.remainingAmount)
      })),
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amount: Number(p.amount)
      }))
    };
  }

  // Low stock products
  async getLowStockProducts(userId: number, threshold: number = 10) {
    const lowStock = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        createdAt: products.createdAt
      })
      .from(products)
      .where(and(eq(products.userId, userId), lte(products.stock, threshold)))
      .orderBy(asc(products.stock));

    return lowStock.map((p) => ({
      ...p,
      price: Number(p.price)
    }));
  }

  // Best selling products
  async getBestSellingProducts(userId: number, days: number = 30, limit: number = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bestSellers = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.price::numeric as price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.quantity * oi.price_at_time::numeric), 0) as total_revenue
      FROM products p
      INNER JOIN order_items oi ON p.id = oi.product_id
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE p.user_id = ${userId}
        AND o.created_at >= ${startDate}
      GROUP BY p.id, p.name, p.price, p.stock
      ORDER BY total_sold DESC
      LIMIT ${limit}
    `);

    return {
      period: `${days} days`,
      products: bestSellers.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        stock: row.stock,
        totalSold: Number(row.total_sold),
        totalRevenue: Number(row.total_revenue)
      }))
    };
  }

  // Debt summary
  async getDebtSummary(userId: number) {
    // Total debt
    const totalDebt = await db
      .select({
        total: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)`,
        shopsCount: count(),
        shopsWithDebt: sql<number>`COUNT(CASE WHEN ${shops.totalDebt}::numeric > 0 THEN 1 END)`
      })
      .from(shops)
      .where(eq(shops.userId, userId));

    // Total payments received (all time)
    const totalPayments = await db
      .select({
        total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)`
      })
      .from(payments)
      .where(eq(payments.userId, userId));

    // Total sales (all time)
    const totalSales = await db
      .select({
        total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)`
      })
      .from(orders)
      .where(eq(orders.userId, userId));

    const totalSalesNum = Number(totalSales[0]?.total || 0);
    const totalPaymentsNum = Number(totalPayments[0]?.total || 0);
    const collectionRate =
      totalSalesNum > 0 ? ((totalPaymentsNum / totalSalesNum) * 100).toFixed(1) : "0";

    return {
      totalDebt: Number(totalDebt[0]?.total || 0),
      totalShops: totalDebt[0]?.shopsCount || 0,
      shopsWithDebt: totalDebt[0]?.shopsWithDebt || 0,
      totalSales: totalSalesNum,
      totalPaymentsReceived: totalPaymentsNum,
      collectionRate: Number(collectionRate)
    };
  }

  // Debt aging report
  async getDebtAging(userId: number) {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get all shops with debt and their oldest unpaid order date
    const shopsWithDebt = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        totalDebt: shops.totalDebt,
        createdAt: shops.createdAt
      })
      .from(shops)
      .where(and(eq(shops.userId, userId), sql`${shops.totalDebt}::numeric > 0`));

    // Categorize by age based on shop creation (simplified aging)
    const aging = {
      current: [] as any[], // 0-7 days
      days7to30: [] as any[], // 7-30 days
      days30to60: [] as any[], // 30-60 days
      over60: [] as any[] // 60+ days
    };

    for (const shop of shopsWithDebt) {
      const shopData = {
        id: shop.id,
        name: shop.name,
        ownerName: shop.ownerName,
        phone: shop.phone,
        totalDebt: Number(shop.totalDebt)
      };

      // Get oldest unpaid order for this shop
      const [oldestOrder] = await db
        .select({ createdAt: orders.createdAt })
        .from(orders)
        .where(
          and(eq(orders.shopId, shop.id), sql`${orders.remainingAmount}::numeric > 0`)
        )
        .orderBy(asc(orders.createdAt))
        .limit(1);

      const ageDate = oldestOrder?.createdAt || shop.createdAt;

      if (ageDate >= sevenDaysAgo) {
        aging.current.push(shopData);
      } else if (ageDate >= thirtyDaysAgo) {
        aging.days7to30.push(shopData);
      } else if (ageDate >= sixtyDaysAgo) {
        aging.days30to60.push(shopData);
      } else {
        aging.over60.push(shopData);
      }
    }

    return {
      summary: {
        current: {
          count: aging.current.length,
          total: aging.current.reduce((sum, s) => sum + s.totalDebt, 0)
        },
        days7to30: {
          count: aging.days7to30.length,
          total: aging.days7to30.reduce((sum, s) => sum + s.totalDebt, 0)
        },
        days30to60: {
          count: aging.days30to60.length,
          total: aging.days30to60.reduce((sum, s) => sum + s.totalDebt, 0)
        },
        over60: {
          count: aging.over60.length,
          total: aging.over60.reduce((sum, s) => sum + s.totalDebt, 0)
        }
      },
      details: aging
    };
  }

  // Top debtors
  async getTopDebtors(userId: number, limit: number = 10) {
    return this.getShopsDebtRanking(userId, limit);
  }

  // Employee performance
  async getEmployeePerformance(userId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get employees for this distributor
    const employeesList = await db
      .select({
        id: employees.id,
        userId: employees.userId,
        name: users.name,
        phone: users.phone
      })
      .from(employees)
      .leftJoin(users, eq(employees.userId, users.id))
      .where(eq(employees.distributorId, userId));

    // Get performance stats for each employee
    const employeesWithStats = await Promise.all(
      employeesList.map(async (emp) => {
        // Orders created by this employee (assuming they use their own userId when creating orders)
        const orderStats = await db
          .select({
            orderCount: count(),
            totalSales: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)`
          })
          .from(orders)
          .where(
            and(eq(orders.userId, emp.userId), gte(orders.createdAt, startDate))
          );

        // Payments received by this employee
        const paymentStats = await db
          .select({
            paymentCount: count(),
            totalReceived: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)`
          })
          .from(payments)
          .where(
            and(eq(payments.receivedBy, emp.userId), gte(payments.createdAt, startDate))
          );

        return {
          id: emp.id,
          userId: emp.userId,
          name: emp.name,
          phone: emp.phone,
          stats: {
            ordersCreated: orderStats[0]?.orderCount || 0,
            totalSales: Number(orderStats[0]?.totalSales || 0),
            paymentsCollected: paymentStats[0]?.paymentCount || 0,
            totalCollected: Number(paymentStats[0]?.totalReceived || 0)
          }
        };
      })
    );

    return {
      period: `${days} days`,
      employees: employeesWithStats.sort(
        (a, b) => b.stats.totalSales - a.stats.totalSales
      )
    };
  }
}
