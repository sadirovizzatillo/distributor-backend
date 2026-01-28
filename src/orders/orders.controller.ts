import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { db } from "../db/db";
import { orders } from "../db/schema";
import { eq } from "drizzle-orm";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  findAll(
    @Query("userId") userId?: string,
    @Query("shopId") shopId?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    if (userId || shopId || status || startDate || endDate) {
      return this.ordersService.findAllByUserId({
        userId: userId ? Number(userId) : undefined,
        shopId: shopId ? Number(shopId) : undefined,
        status,
        startDate,
        endDate
      });
    }
    return this.ordersService.findAll();
  }

  @Patch(":id/deliver")
  markAsDelivered(@Param("id", ParseIntPipe) id: number) {
    return this.ordersService.markAsDelivered(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findOne(Number(id));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(Number(id), dto);
  }

  @Get("shop/:shopId")
  getOrdersByShop(@Param("shopId") shopId: number) {
    return db.query.orders.findMany({
      where: eq(orders.shopId, shopId)
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.ordersService.remove(Number(id));
  }
}
