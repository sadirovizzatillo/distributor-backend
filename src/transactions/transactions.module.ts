import { Module } from "@nestjs/common";
import { TransactionService } from "./transactions.service";
import { TransactionsController } from "./transactions.controller";

@Module({
  controllers: [TransactionsController],
  providers: [TransactionService]
})
export class TransactionsModule {}
