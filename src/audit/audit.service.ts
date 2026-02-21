// src/modules/audit/audit.service.ts
import { Injectable } from "@nestjs/common";
import { db } from "../db/db";
import { auditLogs } from "../db/schema";
import { eq, and, gte, lte, desc, sql, like, or } from "drizzle-orm";
import { AuditQueryDto, CreateAuditLogDto } from "./dto";

@Injectable()
export class AuditService {
  async createLog(dto: CreateAuditLogDto) {

    const [log] = await db
      .insert(auditLogs)
      .values({
        userId: dto.userId,
        userName: dto.userName,
        userRole: dto.userRole,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        entityName: dto.entityName,
        oldValues: dto.oldValues,
        newValues: dto.newValues,
        description: dto.description,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        distributorId: dto.distributorId,
        severity: dto.severity || "info"
      })
      .returning();

    return log;
  }

  async getAuditLogs(query: AuditQueryDto) {
    const {
      limit = 50,
      offset = 0,
      userId,
      action,
      entityType,
      entityId,
      distributorId,
      severity,
      dateFrom,
      dateTo
    } = query;

    // Build where conditions
    const whereConditions = [];

    if (userId) {
      whereConditions.push(eq(auditLogs.userId, userId));
    }

    if (action) {
      whereConditions.push(eq(auditLogs.action, action));
    }

    if (entityType) {
      whereConditions.push(eq(auditLogs.entityType, entityType));
    }

    if (entityId) {
      whereConditions.push(eq(auditLogs.entityId, entityId));
    }

    if (distributorId) {
      whereConditions.push(eq(auditLogs.distributorId, distributorId));
    }

    if (severity) {
      whereConditions.push(eq(auditLogs.severity, severity));
    }

    if (dateFrom) {
      whereConditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      whereConditions.push(lte(auditLogs.createdAt, new Date(dateTo)));
    }

    // Get logs
    const data = await db
      .select()
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data: data.map((log) => ({
        id: log.id,
        user: log.userId
          ? {
              id: log.userId,
              name: log.userName,
              role: log.userRole
            }
          : null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityName: log.entityName,
        description: log.description,
        oldValues: log.oldValues,
        newValues: log.newValues,
        ipAddress: log.ipAddress,
        severity: log.severity,
        createdAt: log.createdAt
      })),
      total: Number(count),
      limit,
      offset
    };
  }

  async getAuditSummary(query: AuditQueryDto) {
    const { dateFrom, dateTo, distributorId } = query;

    // Build where conditions
    const whereConditions = [];

    if (dateFrom) {
      whereConditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      whereConditions.push(lte(auditLogs.createdAt, new Date(dateTo)));
    }

    if (distributorId) {
      whereConditions.push(eq(auditLogs.distributorId, distributorId));
    }

    // Get counts by action
    const byAction = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`COUNT(*)`
      })
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(auditLogs.action);

    // Get counts by entity type
    const byEntityType = await db
      .select({
        entityType: auditLogs.entityType,
        count: sql<number>`COUNT(*)`
      })
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(auditLogs.entityType);

    // Get counts by severity
    const bySeverity = await db
      .select({
        severity: auditLogs.severity,
        count: sql<number>`COUNT(*)`
      })
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(auditLogs.severity);

    // Get top users
    const topUsers = await db
      .select({
        userId: auditLogs.userId,
        userName: auditLogs.userName,
        actionsCount: sql<number>`COUNT(*)`
      })
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(auditLogs.userId, auditLogs.userName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // Get total count
    const [{ totalActions }] = await db
      .select({ totalActions: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      totalActions: Number(totalActions) || 0,
      byAction: byAction.reduce((acc, row) => {
        acc[row.action] = Number(row.count);
        return acc;
      }, {}),
      byEntityType: byEntityType.reduce((acc, row) => {
        acc[row.entityType] = Number(row.count);
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc, row) => {
        acc[row.severity] = Number(row.count);
        return acc;
      }, {}),
      topUsers: topUsers.map((user) => ({
        userId: user.userId,
        userName: user.userName,
        actionsCount: Number(user.actionsCount)
      }))
    };
  }
}
