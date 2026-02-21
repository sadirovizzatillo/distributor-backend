// src/modules/alerts/alerts.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AlertsService } from "./alerts.service";
import { AlertQueryDto } from "./dto/alert-query.dto";
import { GetUser } from "../auth/decorators/get-user.decorator";

@Controller("alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * GET /alerts
   * Get system alerts
   */
  @Get()
  async getAlerts(@Query() query: AlertQueryDto) {
    return this.alertsService.getAlerts(query);
  }

  /**
   * Query params:
   * - type: 'LOW_STOCK' | 'OVERDUE_DEBT' | 'TELEGRAM_FAILED' | etc.
   * - severity: 'info' | 'warning' | 'critical'
   * - isRead: boolean
   * - isResolved: boolean
   * - limit, offset
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       type: "OVERDUE_DEBT",
   *       severity: "critical",
   *       title: "5 shops with debt over 60 days",
   *       message: "The following shops have outstanding debt...",
   *       distributor: { id: 5, name: "Ahmed Distribution" },
   *       shop: { id: 15, name: "SuperMart" },
   *       metadata: { debtAmount: 50000, daysPastDue: 75 },
   *       isRead: false,
   *       isResolved: false,
   *       createdAt: "2024-02-10T08:00:00Z"
   *     },
   *     {
   *       id: 2,
   *       type: "LOW_STOCK",
   *       severity: "warning",
   *       title: "Product stock critically low",
   *       message: "Coca Cola 1.5L stock is down to 3 units",
   *       distributor: { id: 5, name: "Ahmed Distribution" },
   *       metadata: { productId: 45, currentStock: 3, threshold: 10 },
   *       isRead: true,
   *       isResolved: false,
   *       createdAt: "2024-02-10T07:30:00Z"
   *     },
   *     ...
   *   ],
   *   total: 45,
   *   unreadCount: 12,
   *   criticalCount: 5
   * }
   */

  /**
   * PATCH /alerts/:id/read
   * Mark alert as read
   */
  @Patch(":id/read")
  async markAsRead(@Param("id") id: number) {
    return this.alertsService.markAsRead(id);
  }

  /**
   * PATCH /alerts/:id/resolve
   * Mark alert as resolved
   */
  @Patch(":id/resolve")
  async markAsResolved(@Param("id") id: number, @GetUser("id") userId: number) {
    return this.alertsService.markAsResolved(id, userId);
  }

  /**
   * GET /alerts/stats
   * Alert statistics
   */
  @Get("stats")
  async getAlertStats() {
    return this.alertsService.getAlertStats();
  }

  /**
   * Response:
   * {
   *   total: 45,
   *   unread: 12,
   *   resolved: 23,
   *   byType: {
   *     LOW_STOCK: 15,
   *     OVERDUE_DEBT: 10,
   *     TELEGRAM_FAILED: 8,
   *     UNUSUAL_ACTIVITY: 7,
   *     SYSTEM_ERROR: 5
   *   },
   *   bySeverity: {
   *     critical: 5,
   *     warning: 20,
   *     info: 20
   *   }
   * }
   */
}
