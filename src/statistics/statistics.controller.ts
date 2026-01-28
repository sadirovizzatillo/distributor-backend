import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Req
} from "@nestjs/common";
import { StatisticsService } from "./statistics.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("statistics")
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  // Get today's real-time statistics
  @Get("today")
  async getTodayStats(@Req() req: any) {
    const userId = Number(req.user.id);
    return this.statisticsService.getTodayStats(userId);
  }

  // Get statistics history (last N days)
  @Get("history")
  async getStatsHistory(@Req() req: any, @Query("days") days?: string) {
    const userId = Number(req.user.id);
    const numDays = days ? parseInt(days, 10) : 30;
    return this.statisticsService.getStatsHistory(userId, numDays);
  }

  // Get all shops with their debts
  @Get("debts")
  async getAllShopsDebt(@Req() req: any) {
    const userId = Number(req.user.id);
    return this.statisticsService.getAllShopsDebt(userId);
  }

  // Manually recalculate today's statistics
  @Post("recalculate")
  async recalculateStatistics(@Req() req: any) {
    const userId = Number(req.user.id);
    return this.statisticsService.recalculateStatistics(userId);
  }
}
