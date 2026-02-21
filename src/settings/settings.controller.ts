// src/modules/settings/settings.controller.ts
import { Controller, Get, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { SettingsService } from "./settings.service";
import { UpdateSettingDto } from "./dto/update-settings.dto";
import { GetUser } from "../auth/decorators/get-user.decorator";

@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings
   * Get all platform settings
   */
  @Get()
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * Response:
   * {
   *   general: [
   *     {
   *       key: "default_currency",
   *       value: "USD",
   *       dataType: "string",
   *       description: "Default currency symbol",
   *       isEditable: true
   *     },
   *     ...
   *   ],
   *   inventory: [
   *     {
   *       key: "low_stock_threshold",
   *       value: "10",
   *       dataType: "number",
   *       description: "Alert when product stock falls below this value",
   *       isEditable: true
   *     },
   *     ...
   *   ],
   *   financial: [...],
   *   integrations: [...]
   * }
   */

  /**
   * GET /settings/:key
   * Get specific setting
   */
  @Get(":key")
  async getSetting(@Param("key") key: string) {
    return this.settingsService.getSetting(key);
  }

  /**
   * PATCH /settings/:key
   * Update setting value
   */
  @Patch(":key")
  async updateSetting(
    @Param("key") key: string,
    @Body() dto: UpdateSettingDto,
    @GetUser("id") userId: number
  ) {
    return this.settingsService.updateSetting(key, dto.value, userId);
  }

  /**
   * Body: { value: "20" }
   *
   * Response:
   * {
   *   key: "low_stock_threshold",
   *   value: "20",
   *   updatedBy: { id: 1, name: "Admin User" },
   *   updatedAt: "2024-02-10T10:30:00Z"
   * }
   */
}
