// src/modules/audit/decorators/audit-log.decorator.ts
import { SetMetadata } from "@nestjs/common";

export interface AuditLogMetadata {
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | string;
  entityType: string;
  severity?: "info" | "warning" | "critical";
}

export const AUDIT_LOG_KEY = "audit_log";
export const AuditLog = (metadata: AuditLogMetadata) =>
  SetMetadata(AUDIT_LOG_KEY, metadata);

// Usage example in controllers:
// @Post()
// @AuditLog({ action: 'CREATE', entityType: 'order', severity: 'info' })
// async createOrder(@Body() dto: CreateOrderDto) {
//   return this.ordersService.create(dto);
// }
