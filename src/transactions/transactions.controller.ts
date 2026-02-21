import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import { TransactionService } from "./transactions.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly service: TransactionService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.service.create(dto);
  }

  @Get("order/:orderId")
  async getByOrder(@Req() req: any, @Param("orderId") orderId: number) {
    const user = req.user;
    if (user.role !== "admin") {
      const order = await this.service.getOrderWithOwner(orderId);
      if (!order || order.userId !== user.id) {
        throw new ForbiddenException("Access denied");
      }
    }
    return this.service.getOrderTransactions(orderId);
  }
}
