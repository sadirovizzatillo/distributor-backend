export class CreateAuditLogDto {
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: number;
  entityName?: string;
  oldValues?: any;
  newValues?: any;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  distributorId?: number;
  severity?: string;
}
