// telegram/telegram.module.ts
import { Module } from "@nestjs/common";
import { TelegramBotService } from "./telegram.service";
import { ShopsService } from "../shops/shops.service";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [ShopsModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService]
})
export class TelegramModule {}