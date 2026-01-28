// payment.module.ts
import { Module } from "@nestjs/common";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { ShopsModule } from "../shops/shops.module";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [TelegramModule, ShopsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}