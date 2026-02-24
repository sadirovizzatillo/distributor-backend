// payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  ValidationPipe,
  Req,
  UseGuards
} from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AddManualDebtDto, SetExactDebtDto } from "./dto/payment-all.dto";

@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ADD MANUAL DEBT - POST /api/payments/debt/add
  @Post("debt/add")
  async addManualDebt(
    @Req() req: any,
    @Body(ValidationPipe) addDebtDto: AddManualDebtDto
  ) {
    const distributorId = Number(req.user.id); // From JWT token

    return await this.paymentService.addManualDebt(
      distributorId,
      addDebtDto.shopId,
      addDebtDto.debtAmount,
      addDebtDto.notes
    );
  }

  // SET EXACT DEBT - POST /api/payments/debt/set
  @Post("debt/set")
  async setExactDebt(
    @Req() req: any,
    @Body(ValidationPipe) setDebtDto: SetExactDebtDto
  ) {
    const distributorId = Number(req.user.id); // From JWT token

    return await this.paymentService.setExactDebt(
      distributorId,
      setDebtDto.shopId,
      setDebtDto.debtAmount,
      setDebtDto.notes
    );
  }

  // GET DEBT HISTORY - GET /api/payments/debt/history/:shopId
  @Get("debt/history/:shopId")
  async getDebtHistory(
    @Req() req: any,
    @Param("shopId", ParseIntPipe) shopId: number,
    @Query("limit") limit?: string
  ) {
    const distributorId = Number(req.user.id);
    const parsedLimit = limit ? parseInt(limit) : 50;

    return await this.paymentService.getDebtHistory(
      distributorId,
      shopId,
      parsedLimit
    );
  }

  // Create new payment
  @Post()
  async createPayment(
    @Req() req: any,
    @Body(ValidationPipe) createPaymentDto: CreatePaymentDto
  ) {
    const distributorId = Number(req.user.id); // From JWT token

    return await this.paymentService.createPayment(
      distributorId,
      createPaymentDto.shopId,
      createPaymentDto.amount,
      createPaymentDto.paymentMethod,
      createPaymentDto.receivedBy,
      createPaymentDto.notes
    );
  }

  // Get shop's debt
  @Get("debt/:shopId")
  async getShopDebt(
    @Req() req: any,
    @Param("shopId", ParseIntPipe) shopId: number
  ) {
    const distributorId = Number(req.user.id);
    return await this.paymentService.getShopDebt(distributorId, shopId);
  }

  // Get payment history for specific shop
  @Get("history/:shopId")
  async getPaymentHistory(
    @Req() req: any,
    @Param("shopId", ParseIntPipe) shopId: number,
    @Query("limit") limit?: string
  ) {
    const distributorId = Number(req.user.id);
    const parsedLimit = limit ? parseInt(limit) : 50;
    return await this.paymentService.getPaymentHistory(
      distributorId,
      shopId,
      parsedLimit
    );
  }

  // Get all payments for current distributor (or all if admin)
  @Get()
  async getAllPayments(@Req() req: any, @Query("limit") limit?: string) {
    const parsedLimit = limit ? parseInt(limit) : 100;
    if (req.user.role === "admin") {
      return await this.paymentService.getAllPayments(parsedLimit);
    }
    return await this.paymentService.getAllPaymentsForDistributor(
      Number(req.user.id),
      parsedLimit
    );
  }

  // Get payment statistics for a shop
  @Get("stats/:shopId")
  async getPaymentStats(
    @Req() req: any,
    @Param("shopId", ParseIntPipe) shopId: number
  ) {
    const distributorId = Number(req.user.id);
    return await this.paymentService.getPaymentStats(distributorId, shopId);
  }

  // Get all shops with their debt summary
  @Get("shops/debt-summary")
  async getShopsDebtSummary(@Req() req: any) {
    const distributorId = Number(req.user.id);
    return await this.paymentService.getAllShopsWithDebt(distributorId);
  }
}
