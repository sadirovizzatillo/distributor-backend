import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
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
  getByOrder(@Param("orderId") orderId: number) {
    return this.service.getOrderTransactions(orderId);
  }
}
