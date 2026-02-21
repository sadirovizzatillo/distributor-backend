// src/modules/admin/admin.controller.ts
import { Controller, Get, Param, Query, UseGuards, Req } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminService } from "./admin.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { AnalyticsQueryDto } from "./dto/analytics-query-dto";
import { PaginationDto } from "./dto/pagination.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "user")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== ADMIN PROFILE ====================

  /**
   * GET /admin/me
   * Get current admin user profile
   */
  @Get("me")
  async getCurrentAdmin(@Req() req: any) {
    return this.adminService.getCurrentAdmin(req.user.id);
  }

  // ==================== DASHBOARD OVERVIEW ====================

  /**
   * GET /admin/dashboard
   * Main dashboard with KPIs and overview
   */
  @Get("dashboard")
  async getDashboard(@Query() query: DashboardQueryDto) {
    return this.adminService.getDashboardOverview(query);
  }

  /**
   * Response:
   * {
   *   today: {
   *     totalSales: 45678.50,
   *     totalOrders: 234,
   *     paymentsReceived: 32150.00,
   *     totalDebt: 13528.50,
   *     distributorsCount: 127,
   *     shopsCount: 1845,
   *     productsCount: 3456,
   *     employeesCount: 89,
   *     newDistributorsThisWeek: 3,
   *     newShopsToday: 12,
   *     lowStockProducts: 45
   *   },
   *   comparison: {
   *     salesVsYesterday: 12,  // percentage
   *     ordersVsYesterday: 8,
   *     paymentsVsYesterday: 15,
   *     debtVsYesterday: -5
   *   }
   * }
   */

  // ==================== DISTRIBUTORS ====================

  /**
   * GET /admin/distributors
   * List all distributors with pagination and filters
   */
  @Get("distributors")
  async getDistributors(@Query() query: PaginationDto) {
    return this.adminService.getDistributors(query);
  }

  /**
   * Query params:
   * - limit: number (default 20)
   * - offset: number (default 0)
   * - search: string (name or phone)
   * - sortBy: 'sales' | 'debt' | 'shops' | 'createdAt'
   * - sortOrder: 'asc' | 'desc'
   * - dateFrom: ISO date
   * - dateTo: ISO date
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       name: "Ahmed Distribution",
   *       phone: "+998901234567",
   *       createdAt: "2024-01-15T10:30:00Z",
   *       stats: {
   *         totalSales: 125000.00,
   *         totalDebt: 15000.00,
   *         shopsCount: 45,
   *         ordersCount: 567,
   *         productsCount: 89,
   *         employeesCount: 5
   *       }
   *     },
   *     ...
   *   ],
   *   total: 127,
   *   limit: 20,
   *   offset: 0
   * }
   */

  /**
   * GET /admin/distributors/:id
   * Get detailed distributor information
   */
  @Get("distributors/:id")
  async getDistributorDetails(@Param("id") id: number) {
    return this.adminService.getDistributorDetails(id);
  }

  /**
   * Response:
   * {
   *   distributor: {
   *     id: 1,
   *     name: "Ahmed Distribution",
   *     phone: "+998901234567",
   *     role: "user",
   *     createdAt: "2024-01-15T10:30:00Z"
   *   },
   *   stats: {
   *     lifetimeSales: 250000.00,
   *     currentDebt: 25000.00,
   *     shopsCount: 45,
   *     productsCount: 89,
   *     employeesCount: 5,
   *     ordersCount: 1234
   *   },
   *   recentOrders: [...],  // Last 20 orders
   *   recentPayments: [...], // Last 20 payments
   *   topShops: [...],       // Top 10 shops by sales
   *   topProducts: [...]     // Top 10 products
   * }
   */

  // ==================== SHOPS ====================

  /**
   * GET /admin/shops
   * List all shops across platform
   */
  @Get("shops")
  async getShops(@Query() query: PaginationDto) {
    return this.adminService.getShops(query);
  }

  /**
   * Query params:
   * - limit, offset, search
   * - distributorId: filter by distributor
   * - minDebt, maxDebt: debt range filter
   * - hasTelegram: boolean (connected to bot)
   * - sortBy: 'debt' | 'lastOrder' | 'createdAt'
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       name: "SuperMart Downtown",
   *       ownerName: "Ali Karimov",
   *       phone: "+998901111111",
   *       address: "Tashkent, Chilanzar",
   *       totalDebt: 5000.00,
   *       chatId: "123456789",
   *       telegramConnected: true,
   *       distributor: {
   *         id: 5,
   *         name: "Ahmed Distribution"
   *       },
   *       lastOrder: "2024-02-09T14:30:00Z",
   *       ordersCount: 45,
   *       createdAt: "2023-11-10T08:00:00Z"
   *     },
   *     ...
   *   ],
   *   total: 1845
   * }
   */

  /**
   * GET /admin/shops/:id
   * Get shop details
   */
  @Get("shops/:id")
  async getShopDetails(@Param("id") id: number) {
    return this.adminService.getShopDetails(id);
  }

  // ==================== ORDERS ====================

  /**
   * GET /admin/orders
   * All orders across platform
   */
  @Get("orders")
  async getOrders(@Query() query: PaginationDto) {
    return this.adminService.getOrders(query);
  }

  /**
   * Query params:
   * - distributorId, shopId, status
   * - dateFrom, dateTo
   * - minAmount, maxAmount
   * - limit, offset
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       totalPrice: 15000.00,
   *       remainingAmount: 5000.00,
   *       status: "delivered",
   *       createdAt: "2024-02-08T10:00:00Z",
   *       deliveredAt: "2024-02-08T15:30:00Z",
   *       shop: { id: 1, name: "SuperMart" },
   *       distributor: { id: 5, name: "Ahmed Distribution" },
   *       itemsCount: 5
   *     },
   *     ...
   *   ],
   *   total: 12567,
   *   summary: {
   *     totalAmount: 2500000.00,
   *     totalRemaining: 350000.00,
   *     pendingOrders: 45,
   *     deliveredOrders: 12522
   *   }
   * }
   */

  /**
   * GET /admin/orders/:id
   * Order details with items
   */
  @Get("orders/:id")
  async getOrderDetails(@Param("id") id: number) {
    return this.adminService.getOrderDetails(id);
  }

  // ==================== PAYMENTS ====================

  /**
   * GET /admin/payments
   * All payments/transactions
   */
  @Get("payments")
  async getPayments(@Query() query: PaginationDto) {
    return this.adminService.getPayments(query);
  }

  /**
   * Query params:
   * - distributorId, shopId
   * - paymentMethod: 'cash' | 'card' | 'manual_debt' | 'debt_adjustment'
   * - dateFrom, dateTo
   * - minAmount, maxAmount
   * - type: 'payment' | 'debt' (positive or negative amounts)
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       amount: 5000.00,
   *       paymentMethod: "cash",
   *       notes: "Partial payment",
   *       receivedBy: { id: 10, name: "Salesman Ali" },
   *       shop: { id: 1, name: "SuperMart" },
   *       distributor: { id: 5, name: "Ahmed Distribution" },
   *       createdAt: "2024-02-09T14:00:00Z"
   *     },
   *     ...
   *   ],
   *   total: 45678,
   *   summary: {
   *     totalPayments: 1500000.00,
   *     totalDebts: 250000.00,
   *     cashPayments: 1020000.00,
   *     cardPayments: 480000.00
   *   }
   * }
   */

  // ==================== PRODUCTS ====================

  /**
   * GET /admin/products
   * All products in system
   */
  @Get("products")
  async getProducts(@Query() query: PaginationDto) {
    return this.adminService.getProducts(query);
  }

  /**
   * Query params:
   * - distributorId
   * - search: product name
   * - lowStock: boolean (stock < threshold)
   * - minPrice, maxPrice
   * - sortBy: 'stock' | 'price' | 'sales'
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       name: "Coca Cola 1.5L",
   *       description: "Soft drink",
   *       price: 8000.00,
   *       stock: 150,
   *       distributor: { id: 5, name: "Ahmed Distribution" },
   *       totalSold: 500,  // lifetime
   *       createdAt: "2024-01-01T00:00:00Z"
   *     },
   *     ...
   *   ],
   *   total: 3456,
   *   summary: {
   *     totalProducts: 3456,
   *     lowStockCount: 45,
   *     totalValue: 45000000.00
   *   }
   * }
   */

  // ==================== ANALYTICS ====================

  /**
   * GET /admin/analytics/sales
   * Platform-wide sales trends
   */
  @Get("analytics/sales")
  async getSalesAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getSalesAnalytics(query);
  }

  /**
   * Query params:
   * - period: 'day' | 'week' | 'month'
   * - days: number (e.g., 30)
   * - distributorId: optional filter
   *
   * Response:
   * {
   *   period: "day",
   *   days: 30,
   *   data: [
   *     { date: "2024-02-10", sales: 45678.50, orders: 234, payments: 32150.00 },
   *     { date: "2024-02-09", sales: 42000.00, orders: 220, payments: 28000.00 },
   *     ...
   *   ],
   *   summary: {
   *     totalSales: 1250000.00,
   *     totalOrders: 6800,
   *     totalPayments: 980000.00,
   *     averageDailySales: 41666.67,
   *     averageOrderValue: 183.82
   *   }
   * }
   */

  /**
   * GET /admin/analytics/top-distributors
   * Leaderboard of distributors
   */
  @Get("analytics/top-distributors")
  async getTopDistributors(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getTopDistributors(query);
  }

  /**
   * Query params:
   * - limit: number (default 10)
   * - days: number (time period, default 30)
   * - sortBy: 'sales' | 'orders' | 'payments'
   *
   * Response:
   * {
   *   data: [
   *     {
   *       rank: 1,
   *       distributor: { id: 5, name: "Ahmed Distribution", phone: "+998..." },
   *       sales: 125000.00,
   *       orders: 567,
   *       payments: 98000.00,
   *       debt: 27000.00,
   *       shopsCount: 45,
   *       averageOrderValue: 220.46
   *     },
   *     ...
   *   ]
   * }
   */

  /**
   * GET /admin/analytics/debt-overview
   * System-wide debt metrics
   */
  @Get("analytics/debt-overview")
  async getDebtOverview() {
    return this.adminService.getDebtOverview();
  }

  /**
   * Response:
   * {
   *   totalDebt: 1250000.00,
   *   shopsWithDebt: 456,
   *   aging: {
   *     current: { amount: 450000.00, count: 180 },      // 0-30 days
   *     overdue30: { amount: 350000.00, count: 150 },    // 31-60 days
   *     overdue60: { amount: 450000.00, count: 126 }     // 60+ days (critical)
   *   },
   *   topDebtors: [
   *     {
   *       shop: { id: 1, name: "SuperMart", distributor: {...} },
   *       debt: 50000.00,
   *       daysSinceLastPayment: 75,
   *       oldestUnpaidOrder: "2023-11-28T10:00:00Z"
   *     },
   *     ...
   *   ]
   * }
   */

  /**
   * GET /admin/analytics/payment-methods
   * Breakdown by payment method
   */
  @Get("analytics/payment-methods")
  async getPaymentMethodsAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getPaymentMethodsAnalytics(query);
  }

  /**
   * Response:
   * {
   *   total: 1500000.00,
   *   breakdown: [
   *     { method: "cash", amount: 1020000.00, count: 3456, percentage: 68 },
   *     { method: "card", amount: 480000.00, count: 1234, percentage: 32 }
   *   ]
   * }
   */

  // ==================== USERS ====================

  /**
   * GET /admin/users
   * All users (distributors, agents, admins)
   */
  @Get("users")
  async getUsers(@Query() query: PaginationDto) {
    return this.adminService.getUsers(query);
  }

  /**
   * Query params:
   * - role: 'user' | 'agent' | 'admin'
   * - search: name or phone
   * - distributorId: for agents
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       name: "Ahmed Ali",
   *       phone: "+998901234567",
   *       role: "user",
   *       createdAt: "2024-01-15T10:30:00Z",
   *       stats: {
   *         shopsCount: 45,
   *         ordersCount: 567,
   *         totalSales: 125000.00
   *       }
   *     },
   *     ...
   *   ],
   *   total: 216,
   *   summary: {
   *     distributors: 127,
   *     agents: 89,
   *     admins: 3
   *   }
   * }
   */

  // ==================== TELEGRAM ====================

  /**
   * GET /admin/telegram/status
   * Telegram bot health and connection status
   */
  @Get("telegram/status")
  async getTelegramStatus() {
    return this.adminService.getTelegramStatus();
  }

  /**
   * Response:
   * {
   *   botOnline: true,
   *   botUsername: "teztarqatbot",
   *   stats: {
   *     totalShops: 1845,
   *     connectedShops: 1833,
   *     notConnectedShops: 12,
   *     notificationsSentToday: 456,
   *     failedNotificationsToday: 3
   *   }
   * }
   */

  /**
   * GET /admin/telegram/notifications
   * Notification logs
   */
  @Get("telegram/notifications")
  async getNotificationLogs(@Query() query: PaginationDto) {
    return this.adminService.getNotificationLogs(query);
  }

  /**
   * Query params:
   * - shopId, type, status
   * - dateFrom, dateTo
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       shop: { id: 1, name: "SuperMart" },
   *       type: "ORDER_CREATED",
   *       message: "New order #123...",
   *       status: "sent",
   *       createdAt: "2024-02-10T10:00:00Z"
   *     },
   *     {
   *       id: 2,
   *       shop: { id: 5, name: "MiniMart" },
   *       type: "PAYMENT_RECEIVED",
   *       message: "Payment received...",
   *       status: "failed",
   *       errorMessage: "Chat not found",
   *       createdAt: "2024-02-10T09:45:00Z"
   *     },
   *     ...
   *   ],
   *   total: 4567
   * }
   */
}
