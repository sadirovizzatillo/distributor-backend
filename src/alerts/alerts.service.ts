// src/modules/alerts/alerts.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/db";
import { systemAlerts } from "../db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { AlertQueryDto, CreateAlertDto } from "./dto";

@Injectable()
export class AlertsService {
  async createAlert(dto: CreateAlertDto) {

    const [alert] = await db
      .insert(systemAlerts)
      .values({
        type: dto.type,
        severity: dto.severity || "info",
        title: dto.title,
        message: dto.message,
        distributorId: dto.distributorId,
        shopId: dto.shopId,
        orderId: dto.orderId,
        metadata: dto.metadata
      })
      .returning();

    return alert;
  }

  async getAlerts(query: AlertQueryDto) {
    const {
      limit = 50,
      offset = 0,
      type,
      severity,
      isRead,
      isResolved
    } = query;

    // Build where conditions
    const whereConditions = [];

    if (type) {
      whereConditions.push(eq(systemAlerts.type, type));
    }

    if (severity) {
      whereConditions.push(eq(systemAlerts.severity, severity));
    }

    if (isRead !== undefined) {
      whereConditions.push(eq(systemAlerts.isRead, isRead));
    }

    if (isResolved !== undefined) {
      whereConditions.push(eq(systemAlerts.isResolved, isResolved));
    }

    // Get alerts
    const data = await db
      .select()
      .from(systemAlerts)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(systemAlerts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get counts
    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        unreadCount: sql<number>`COUNT(CASE WHEN ${systemAlerts.isRead} = false THEN 1 END)`,
        criticalCount: sql<number>`COUNT(CASE WHEN ${systemAlerts.severity} = 'critical' AND ${systemAlerts.isResolved} = false THEN 1 END)`
      })
      .from(systemAlerts)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      data,
      total: Number(counts.total) || 0,
      unreadCount: Number(counts.unreadCount) || 0,
      criticalCount: Number(counts.criticalCount) || 0,
      limit,
      offset
    };
  }

  async markAsRead(id: number) {
    const [alert] = await db
      .update(systemAlerts)
      .set({
        isRead: true,
        updatedAt: new Date()
      })
      .where(eq(systemAlerts.id, id))
      .returning();

    if (!alert) {
      throw new NotFoundException("Alert not found");
    }

    return alert;
  }

  async markAsResolved(id: number, userId: number) {
    const [alert] = await db
      .update(systemAlerts)
      .set({
        isResolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(systemAlerts.id, id))
      .returning();

    if (!alert) {
      throw new NotFoundException("Alert not found");
    }

    return alert;
  }

  async getAlertStats() {
    // Get counts
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        unread: sql<number>`COUNT(CASE WHEN ${systemAlerts.isRead} = false THEN 1 END)`,
        resolved: sql<number>`COUNT(CASE WHEN ${systemAlerts.isResolved} = true THEN 1 END)`
      })
      .from(systemAlerts);

    // Get counts by type
    const byType = await db
      .select({
        type: systemAlerts.type,
        count: sql<number>`COUNT(*)`
      })
      .from(systemAlerts)
      .where(eq(systemAlerts.isResolved, false))
      .groupBy(systemAlerts.type);

    // Get counts by severity
    const bySeverity = await db
      .select({
        severity: systemAlerts.severity,
        count: sql<number>`COUNT(*)`
      })
      .from(systemAlerts)
      .where(eq(systemAlerts.isResolved, false))
      .groupBy(systemAlerts.severity);

    return {
      total: Number(stats.total) || 0,
      unread: Number(stats.unread) || 0,
      resolved: Number(stats.resolved) || 0,
      byType: byType.reduce((acc, row) => {
        acc[row.type] = Number(row.count);
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc, row) => {
        acc[row.severity] = Number(row.count);
        return acc;
      }, {})
    };
  }
}
