import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  ParseIntPipe
} from "@nestjs/common";
import { DistributorService } from "./distributor.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  DistributorQueryDto,
  AnalyticsPeriodDto,
  LowStockQueryDto
} from "./dto/distributor-query.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("user", "admin")
@Controller("distributor")
export class DistributorController {
  constructor(private readonly distributorService: DistributorService) {}

  // Dashboard - Personal overview
  @Get("dashboard")
  getDashboard(@Req() req: any) {
    return this.distributorService.getDashboard(req.user.id);
  }

  // Analytics - Sales trends
  @Get("analytics/sales")
  getSalesAnalytics(@Req() req: any, @Query() query: AnalyticsPeriodDto) {
    return this.distributorService.getSalesTrends(
      req.user.id,
      query.period || "day",
      query.days ? Number(query.days) : 30
    );
  }

  // Analytics - Product performance
  @Get("analytics/products")
  getProductAnalytics(@Req() req: any, @Query("days") days?: string) {
    return this.distributorService.getProductAnalytics(
      req.user.id,
      days ? Number(days) : 30
    );
  }

  // Analytics - Shop performance
  @Get("analytics/shops")
  getShopAnalytics(@Req() req: any, @Query("days") days?: string) {
    return this.distributorService.getShopAnalytics(
      req.user.id,
      days ? Number(days) : 30
    );
  }

  // Shop Insights - Performance ranking
  @Get("shops/performance")
  getShopsPerformance(@Req() req: any, @Query("limit") limit?: string) {
    return this.distributorService.getShopsPerformance(
      req.user.id,
      limit ? Number(limit) : 20
    );
  }

  // Shop Insights - Debt ranking
  @Get("shops/debt-ranking")
  getShopsDebtRanking(@Req() req: any, @Query("limit") limit?: string) {
    return this.distributorService.getShopsDebtRanking(
      req.user.id,
      limit ? Number(limit) : 20
    );
  }

  // Shop Insights - Shop activity
  @Get("shops/:shopId/activity")
  async getShopActivity(
    @Req() req: any,
    @Param("shopId", ParseIntPipe) shopId: number,
    @Query("limit") limit?: string
  ) {
    const activity = await this.distributorService.getShopActivity(
      req.user.id,
      shopId,
      limit ? Number(limit) : 20
    );
    if (!activity) {
      throw new NotFoundException(
        `Shop with ID ${shopId} not found or does not belong to you`
      );
    }
    return activity;
  }

  // Inventory - Low stock products
  @Get("products/low-stock")
  getLowStockProducts(@Req() req: any, @Query() query: LowStockQueryDto) {
    return this.distributorService.getLowStockProducts(
      req.user.id,
      query.threshold ? Number(query.threshold) : 10
    );
  }

  // Inventory - Best sellers
  @Get("products/best-sellers")
  getBestSellingProducts(
    @Req() req: any,
    @Query("days") days?: string,
    @Query("limit") limit?: string
  ) {
    return this.distributorService.getBestSellingProducts(
      req.user.id,
      days ? Number(days) : 30,
      limit ? Number(limit) : 10
    );
  }

  // Debt & Collections - Summary
  @Get("debt/summary")
  getDebtSummary(@Req() req: any) {
    return this.distributorService.getDebtSummary(req.user.id);
  }

  // Debt & Collections - Aging report
  @Get("debt/aging")
  getDebtAging(@Req() req: any) {
    return this.distributorService.getDebtAging(req.user.id);
  }

  // Debt & Collections - Top debtors
  @Get("debt/top-debtors")
  getTopDebtors(@Req() req: any, @Query("limit") limit?: string) {
    return this.distributorService.getTopDebtors(
      req.user.id,
      limit ? Number(limit) : 10
    );
  }

  // Employee Performance
  @Get("employees/performance")
  getEmployeePerformance(@Req() req: any, @Query("days") days?: string) {
    return this.distributorService.getEmployeePerformance(
      req.user.id,
      days ? Number(days) : 30
    );
  }
}
