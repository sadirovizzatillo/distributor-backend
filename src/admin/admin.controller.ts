import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ParseIntPipe
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminQueryDto, AnalyticsPeriodDto } from "./dto/admin-query.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Dashboard & Overview
  @Get("dashboard")
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get("distributors")
  getDistributors(@Query() query: AdminQueryDto) {
    return this.adminService.getDistributors(
      query.limit ? Number(query.limit) : undefined,
      query.offset ? Number(query.offset) : undefined
    );
  }

  @Get("distributors/:id")
  async getDistributor(@Param("id", ParseIntPipe) id: number) {
    const distributor = await this.adminService.getDistributor(id);
    if (!distributor) {
      throw new NotFoundException(`Distributor with ID ${id} not found`);
    }
    return distributor;
  }

  // System-wide Data Access
  @Get("shops")
  getShops(@Query() query: AdminQueryDto) {
    return this.adminService.getShops(
      query.distributorId ? Number(query.distributorId) : undefined,
      query.limit ? Number(query.limit) : undefined,
      query.offset ? Number(query.offset) : undefined
    );
  }

  @Get("orders")
  getOrders(@Query() query: AdminQueryDto) {
    return this.adminService.getOrders(
      query.distributorId ? Number(query.distributorId) : undefined,
      query.startDate,
      query.endDate,
      query.status,
      query.limit ? Number(query.limit) : undefined,
      query.offset ? Number(query.offset) : undefined
    );
  }

  @Get("payments")
  getPayments(@Query() query: AdminQueryDto) {
    return this.adminService.getPayments(
      query.distributorId ? Number(query.distributorId) : undefined,
      query.startDate,
      query.endDate,
      query.limit ? Number(query.limit) : undefined,
      query.offset ? Number(query.offset) : undefined
    );
  }

  @Get("products")
  getProducts(@Query() query: AdminQueryDto) {
    return this.adminService.getProducts(
      query.distributorId ? Number(query.distributorId) : undefined,
      query.limit ? Number(query.limit) : undefined,
      query.offset ? Number(query.offset) : undefined
    );
  }

  // Analytics
  @Get("analytics/sales")
  getSalesAnalytics(@Query() query: AnalyticsPeriodDto) {
    return this.adminService.getSalesTrends(
      query.period || "day",
      query.days ? Number(query.days) : 30
    );
  }

  @Get("analytics/top-distributors")
  getTopDistributors(@Query("limit") limit?: string) {
    return this.adminService.getTopDistributors(limit ? Number(limit) : 10);
  }

  @Get("analytics/debt-overview")
  getDebtOverview() {
    return this.adminService.getDebtOverview();
  }
}
