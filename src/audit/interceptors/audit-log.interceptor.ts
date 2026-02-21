// src/modules/audit/interceptors/audit-log.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import { AuditService } from "../audit.service";
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata
} from "../decorators/audit-log.decorator";

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler()
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ipAddress = request.ip;
    const userAgent = request.headers["user-agent"];

    return next.handle().pipe(
      tap(async (response) => {
        // Extract entity info from response
        const entityId = response?.id || response?.data?.id;
        const entityName = this.getEntityName(response, metadata.entityType);

        await this.auditService.createLog({
          userId: user?.id,
          userName: user?.name,
          userRole: user?.role,
          action: metadata.action,
          entityType: metadata.entityType,
          entityId,
          entityName,
          newValues: metadata.action === "CREATE" ? response : undefined,
          description: `${metadata.action} ${metadata.entityType}`,
          ipAddress,
          userAgent,
          distributorId: this.extractDistributorId(user, response),
          severity: metadata.severity || "info"
        });
      })
    );
  }

  private getEntityName(response: any, entityType: string): string {
    if (response?.name) return response.name;
    if (response?.data?.name) return response.data.name;
    return `${entityType} #${response?.id || ""}`;
  }

  private extractDistributorId(user: any, response: any): number | null {
    if (user?.role === "user") return user.id;
    return response?.userId || response?.distributorId || null;
  }
}

// ## **6. COMPLETE ENDPOINT LIST**
// ADMIN DASHBOARD ENDPOINTS
// ========================
//
// Dashboard Overview:
//   GET  /admin/dashboard
//
// Distributors:
//   GET  /admin/distributors
// GET  /admin/distributors/:id
//
// Shops:
//   GET  /admin/shops
// GET  /admin/shops/:id
//
// Orders:
//   GET  /admin/orders
// GET  /admin/orders/:id
//
// Payments:
//   GET  /admin/payments
//
// Products:
//   GET  /admin/products
//
// Analytics:
//   GET  /admin/analytics/sales
// GET  /admin/analytics/top-distributors
// GET  /admin/analytics/debt-overview
// GET  /admin/analytics/payment-methods
//
// Users:
//   GET  /admin/users
//
// Telegram:
//   GET  /admin/telegram/status
// GET  /admin/telegram/notifications
//
// AUDIT LOGS
// ==========
//   GET  /audit/logs
// GET  /audit/summary
//
// ALERTS
// ======
// GET    /alerts
// GET    /alerts/stats
// PATCH  /alerts/:id/read
// PATCH  /alerts/:id/resolve
//
// SETTINGS
// ========
// GET    /settings
// GET    /settings/:key
// PATCH  /settings/:key
