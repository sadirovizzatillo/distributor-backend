import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { ShopsModule } from "./shops/shops.module";
import { OrdersModule } from "./orders/orders.module";
import { AuthModule } from "./auth/auth.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { EmployeeModule } from "./employees/employees.module";
// import { TelegramModule } from "./telegram/telegram.module";
import { PaymentModule } from "./payments/payment.module";
import { StatisticsModule } from "./statistics/statistics.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ProductsModule,
    ShopsModule,
    OrdersModule,
    TransactionsModule,
    EmployeeModule,
    PaymentModule,
    StatisticsModule
    // TelegramModule
  ]
})
export class AppModule {}
