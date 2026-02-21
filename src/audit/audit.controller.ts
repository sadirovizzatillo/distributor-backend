// src/modules/audit/audit.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";

@Controller("audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit/logs
   * Get audit trail with filters
   */
  @Get("logs")
  async getAuditLogs(@Query() query: AuditQueryDto) {
    return this.auditService.getAuditLogs(query);
  }

  /**
   * Query params:
   * - userId: filter by user
   * - action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | etc.
   * - entityType: 'order' | 'product' | 'shop' | 'payment' | 'user'
   * - entityId: specific entity
   * - distributorId: filter by distributor
   * - severity: 'info' | 'warning' | 'critical'
   * - dateFrom, dateTo
   * - limit, offset
   *
   * Response:
   * {
   *   data: [
   *     {
   *       id: 1,
   *       user: { id: 5, name: "Ahmed Ali", role: "user" },
   *       action: "CREATE",
   *       entityType: "order",
   *       entityId: 123,
   *       entityName: "Order #123 - SuperMart",
   *       description: "Created new order for SuperMart",
   *       oldValues: null,
   *       newValues: { totalPrice: 15000, items: [...] },
   *       ipAddress: "95.142.xxx.xxx",
   *       severity: "info",
   *       createdAt: "2024-02-10T10:30:00Z"
   *     },
   *     {
   *       id: 2,
   *       user: { id: 10, name: "Admin User", role: "admin" },
   *       action: "DELETE",
   *       entityType: "product",
   *       entityId: 45,
   *       entityName: "Coca Cola 1.5L",
   *       description: "Deleted product",
   *       oldValues: { name: "Coca Cola 1.5L", price: 8000, stock: 0 },
   *       newValues: null,
   *       severity: "warning",
   *       createdAt: "2024-02-10T09:15:00Z"
   *     },
   *     ...
   *   ],
   *   total: 12567
   * }
   */

  /**
   * GET /audit/summary
   * Audit activity summary
   */
  @Get("summary")
  async getAuditSummary(@Query() query: AuditQueryDto) {
    return this.auditService.getAuditSummary(query);
  }

  /**
   * Response:
   * {
   *   totalActions: 12567,
   *   byAction: {
   *     CREATE: 5678,
   *     UPDATE: 4567,
   *     DELETE: 234,
   *     LOGIN: 2088
   *   },
   *   byEntityType: {
   *     order: 4567,
   *     payment: 3456,
   *     product: 2345,
   *     shop: 1234,
   *     user: 965
   *   },
   *   bySeverity: {
   *     info: 11000,
   *     warning: 1200,
   *     critical: 367
   *   },
   *   topUsers: [
   *     { userId: 5, userName: "Ahmed Ali", actionsCount: 456 },
   *     ...
   *   ]
   * }
   */
}
