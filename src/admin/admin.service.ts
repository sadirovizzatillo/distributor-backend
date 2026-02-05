import { Injectable } from "@nestjs/common";
import { db } from "../db/db";
import { users, shops, orders, payments, products, employees } from "../db/schema";
import { eq, and, gte, lt, lte, sql, desc, SQL, count } from "drizzle-orm";

@Injectable()
export class AdminService {
  // Dashboard - System-wide metrics
  async getDashboard() {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Total distributors (users with role 'user')
    const totalDistributors = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "user"));

    // New distributors this month
    const newDistributorsThisMonth = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.role, "user"), gte(users.createdAt, startOfMonth)));

    // Total shops
    const totalShops = await db.select({ count: count() }).from(shops);

    // Shops with debt
    const shopsWithDebt = await db
      .select({ count: count() })
      .from(shops)
      .where(sql`${shops.totalDebt}::numeric > 0`);

    // Orders today
    const ordersToday = await db
      .select({ count: count() })
      .from(orders)
      .where(and(gte(orders.createdAt, startOfDay), lt(orders.createdAt, endOfDay)));

    // Orders this month
    const ordersThisMonth = await db
      .select({ count: count() })
      .from(orders)
      .where(gte(orders.createdAt, startOfMonth));

    // Sales today
    const salesToday = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(and(gte(orders.createdAt, startOfDay), lt(orders.createdAt, endOfDay)));

    // Sales this month
    const salesThisMonth = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(gte(orders.createdAt, startOfMonth));

    // Payments today (only positive amounts)
    const paymentsToday = await db
      .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)` })
      .from(payments)
      .where(and(gte(payments.createdAt, startOfDay), lt(payments.createdAt, endOfDay)));

    // Payments this month
    const paymentsThisMonth = await db
      .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount}::numeric > 0 THEN ${payments.amount}::numeric ELSE 0 END), 0)` })
      .from(payments)
      .where(gte(payments.createdAt, startOfMonth));

    // Total debt
    const totalDebt = await db
      .select({ total: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)` })
      .from(shops);

    return {
      distributors: {
        total: totalDistributors[0]?.count || 0,
        newThisMonth: newDistributorsThisMonth[0]?.count || 0
      },
      shops: {
        total: totalShops[0]?.count || 0,
        withDebt: shopsWithDebt[0]?.count || 0
      },
      orders: {
        today: ordersToday[0]?.count || 0,
        thisMonth: ordersThisMonth[0]?.count || 0
      },
      sales: {
        today: Number(salesToday[0]?.total || 0),
        thisMonth: Number(salesThisMonth[0]?.total || 0)
      },
      payments: {
        today: Number(paymentsToday[0]?.total || 0),
        thisMonth: Number(paymentsThisMonth[0]?.total || 0)
      },
      debt: {
        total: Number(totalDebt[0]?.total || 0)
      }
    };
  }

  // Get all distributors with stats
  async getDistributors(limit?: number, offset?: number) {
    const distributors = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.role, "user"))
      .orderBy(desc(users.createdAt))
      .limit(limit || 100)
      .offset(offset || 0);

    const distributorsWithStats = await Promise.all(
      distributors.map(async (distributor) => {
        // Shops count
        const shopsCount = await db
          .select({ count: count() })
          .from(shops)
          .where(eq(shops.userId, distributor.id));

        // Orders count
        const ordersCount = await db
          .select({ count: count() })
          .from(orders)
          .where(eq(orders.userId, distributor.id));

        // Total sales
        const totalSales = await db
          .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
          .from(orders)
          .where(eq(orders.userId, distributor.id));

        // Total debt (from shops belonging to this distributor)
        const totalDebt = await db
          .select({ total: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)` })
          .from(shops)
          .where(eq(shops.userId, distributor.id));

        // Employees count
        const employeesCount = await db
          .select({ count: count() })
          .from(employees)
          .where(eq(employees.distributorId, distributor.id));

        return {
          ...distributor,
          stats: {
            shopsCount: shopsCount[0]?.count || 0,
            ordersCount: ordersCount[0]?.count || 0,
            totalSales: Number(totalSales[0]?.total || 0),
            totalDebt: Number(totalDebt[0]?.total || 0),
            employeesCount: employeesCount[0]?.count || 0
          }
        };
      })
    );

    return distributorsWithStats;
  }

  // Get single distributor details
  async getDistributor(id: number) {
    const [distributor] = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, "user")));

    if (!distributor) {
      return null;
    }

    // Shops count
    const shopsCount = await db
      .select({ count: count() })
      .from(shops)
      .where(eq(shops.userId, id));

    // Orders count
    const ordersCount = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.userId, id));

    // Total sales
    const totalSales = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)` })
      .from(orders)
      .where(eq(orders.userId, id));

    // Total debt
    const totalDebt = await db
      .select({ total: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)` })
      .from(shops)
      .where(eq(shops.userId, id));

    // Employees count
    const employeesCount = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.distributorId, id));

    // Recent shops
    const recentShops = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        totalDebt: shops.totalDebt,
        createdAt: shops.createdAt
      })
      .from(shops)
      .where(eq(shops.userId, id))
      .orderBy(desc(shops.createdAt))
      .limit(5);

    // Recent orders
    const recentOrders = await db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        status: orders.status,
        createdAt: orders.createdAt,
        shop: {
          id: shops.id,
          name: shops.name
        }
      })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    return {
      ...distributor,
      stats: {
        shopsCount: shopsCount[0]?.count || 0,
        ordersCount: ordersCount[0]?.count || 0,
        totalSales: Number(totalSales[0]?.total || 0),
        totalDebt: Number(totalDebt[0]?.total || 0),
        employeesCount: employeesCount[0]?.count || 0
      },
      recentShops: recentShops.map((s) => ({
        ...s,
        totalDebt: Number(s.totalDebt)
      })),
      recentOrders: recentOrders.map((o) => ({
        ...o,
        totalPrice: Number(o.totalPrice)
      }))
    };
  }

  // Get all shops with optional distributor filter
  async getShops(distributorId?: number, limit?: number, offset?: number) {
    const conditions: SQL[] = [];

    if (distributorId) {
      conditions.push(eq(shops.userId, distributorId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const shopsList = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        address: shops.address,
        totalDebt: shops.totalDebt,
        createdAt: shops.createdAt,
        distributor: {
          id: users.id,
          name: users.name,
          phone: users.phone
        }
      })
      .from(shops)
      .leftJoin(users, eq(shops.userId, users.id))
      .where(whereClause)
      .orderBy(desc(shops.createdAt))
      .limit(limit || 100)
      .offset(offset || 0);

    return shopsList.map((s) => ({
      ...s,
      totalDebt: Number(s.totalDebt)
    }));
  }

  // Get all orders with filters
  async getOrders(
    distributorId?: number,
    startDate?: string,
    endDate?: string,
    status?: string,
    limit?: number,
    offset?: number
  ) {
    const conditions: SQL[] = [];

    if (distributorId) {
      conditions.push(eq(orders.userId, distributorId));
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(orders.createdAt, start));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(orders.createdAt, end));
    }

    if (status) {
      conditions.push(eq(orders.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const ordersList = await db
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
          ownerName: shops.ownerName
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
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit || 100)
      .offset(offset || 0);

    return ordersList.map((o) => ({
      ...o,
      totalPrice: Number(o.totalPrice),
      remainingAmount: Number(o.remainingAmount)
    }));
  }

  // Get all payments with filters
  async getPayments(
    distributorId?: number,
    startDate?: string,
    endDate?: string,
    limit?: number,
    offset?: number
  ) {
    const conditions: SQL[] = [];

    if (distributorId) {
      conditions.push(eq(payments.userId, distributorId));
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(payments.createdAt, start));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.createdAt, end));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const paymentsList = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
        createdAt: payments.createdAt,
        shop: {
          id: shops.id,
          name: shops.name,
          ownerName: shops.ownerName
        },
        distributor: {
          id: users.id,
          name: users.name,
          phone: users.phone
        }
      })
      .from(payments)
      .leftJoin(shops, eq(payments.shopId, shops.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(limit || 100)
      .offset(offset || 0);

    return paymentsList.map((p) => ({
      ...p,
      amount: Number(p.amount)
    }));
  }

  // Get all products with optional distributor filter
  async getProducts(distributorId?: number, limit?: number, offset?: number) {
    const conditions: SQL[] = [];

    if (distributorId) {
      conditions.push(eq(products.userId, distributorId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const productsList = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        createdAt: products.createdAt,
        distributor: {
          id: users.id,
          name: users.name,
          phone: users.phone
        }
      })
      .from(products)
      .leftJoin(users, eq(products.userId, users.id))
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit || 100)
      .offset(offset || 0);

    return productsList.map((p) => ({
      ...p,
      price: Number(p.price)
    }));
  }

  // Analytics - Sales trends
  async getSalesTrends(period: "day" | "week" | "month" = "day", days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let dateFormat: string;
    let groupBy: string;

    switch (period) {
      case "week":
        dateFormat = "YYYY-WW";
        groupBy = "TO_CHAR(created_at, 'YYYY-WW')";
        break;
      case "month":
        dateFormat = "YYYY-MM";
        groupBy = "TO_CHAR(created_at, 'YYYY-MM')";
        break;
      default:
        dateFormat = "YYYY-MM-DD";
        groupBy = "DATE(created_at)";
    }

    const salesData = await db.execute(sql`
      SELECT
        ${period === "day" ? sql`DATE(created_at)` : sql`TO_CHAR(created_at, ${dateFormat})`} as date,
        COALESCE(SUM(total_price::numeric), 0) as sales,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
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
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)));

    return {
      period,
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

  // Analytics - Top performing distributors
  async getTopDistributors(limit: number = 10) {
    const distributorsStats = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        totalSales: sql<string>`COALESCE(SUM(${orders.totalPrice}::numeric), 0)`,
        ordersCount: count()
      })
      .from(users)
      .leftJoin(orders, eq(users.id, orders.userId))
      .where(eq(users.role, "user"))
      .groupBy(users.id, users.name, users.phone)
      .orderBy(sql`SUM(${orders.totalPrice}::numeric) DESC NULLS LAST`)
      .limit(limit);

    return distributorsStats.map((d) => ({
      ...d,
      totalSales: Number(d.totalSales)
    }));
  }

  // Analytics - Debt overview
  async getDebtOverview() {
    // Total debt by distributor
    const debtByDistributor = await db
      .select({
        distributorId: shops.userId,
        distributorName: users.name,
        totalDebt: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)`,
        shopsCount: count()
      })
      .from(shops)
      .leftJoin(users, eq(shops.userId, users.id))
      .groupBy(shops.userId, users.name)
      .orderBy(sql`SUM(${shops.totalDebt}::numeric) DESC NULLS LAST`)
      .limit(20);

    // Overall stats
    const overallStats = await db
      .select({
        totalDebt: sql<string>`COALESCE(SUM(${shops.totalDebt}::numeric), 0)`,
        shopsWithDebt: sql<number>`COUNT(CASE WHEN ${shops.totalDebt}::numeric > 0 THEN 1 END)`,
        totalShops: count()
      })
      .from(shops);

    // Top shops with most debt
    const topDebtShops = await db
      .select({
        id: shops.id,
        name: shops.name,
        ownerName: shops.ownerName,
        phone: shops.phone,
        totalDebt: shops.totalDebt,
        distributor: {
          id: users.id,
          name: users.name
        }
      })
      .from(shops)
      .leftJoin(users, eq(shops.userId, users.id))
      .where(sql`${shops.totalDebt}::numeric > 0`)
      .orderBy(sql`${shops.totalDebt}::numeric DESC`)
      .limit(10);

    return {
      overview: {
        totalDebt: Number(overallStats[0]?.totalDebt || 0),
        shopsWithDebt: overallStats[0]?.shopsWithDebt || 0,
        totalShops: overallStats[0]?.totalShops || 0
      },
      byDistributor: debtByDistributor.map((d) => ({
        ...d,
        totalDebt: Number(d.totalDebt)
      })),
      topDebtShops: topDebtShops.map((s) => ({
        ...s,
        totalDebt: Number(s.totalDebt)
      }))
    };
  }
}
