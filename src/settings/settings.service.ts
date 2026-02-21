// src/modules/settings/settings.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../db/db';
import { platformSettings } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class SettingsService {
  async getAllSettings() {

    const settings = await db
      .select()
      .from(platformSettings)
      .orderBy(platformSettings.category, platformSettings.key);

    // Group by category
    const grouped = settings.reduce((acc, setting) => {
      const category = setting.category || 'general';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        key: setting.key,
        value: setting.value,
        dataType: setting.dataType,
        description: setting.description,
        isEditable: setting.isEditable,
      });
      return acc;
    }, {});

    return grouped;
  }

  async getSetting(key: string) {
    const [setting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key));

    if (!setting) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    return setting;
  }

  async updateSetting(key: string, value: string, userId: number) {
    // Check if setting exists and is editable
    const [existing] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key));

    if (!existing) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    if (!existing.isEditable) {
      throw new BadRequestException(`Setting '${key}' is not editable`);
    }

    // Validate value based on dataType
    this.validateValue(value, existing.dataType);

    // Update setting
    const [updated] = await db
      .update(platformSettings)
      .set({
        value,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.key, key))
      .returning();

    return updated;
  }

  private validateValue(value: string, dataType: string) {
    switch (dataType) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new BadRequestException('Value must be a number');
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException('Value must be true or false');
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch (e) {
          throw new BadRequestException('Value must be valid JSON');
        }
        break;
    }
  }
}