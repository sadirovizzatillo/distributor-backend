import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { ShopsService } from "../shops/shops.service";
import { TelegramBotService } from "../telegram/telegram.service";
import { TelegramModule } from "../telegram/telegram.module";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [TelegramModule, ShopsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
