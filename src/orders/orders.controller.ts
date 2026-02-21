import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    const user = req.user;
    if (user.role !== "admin") {
      dto.userId = user.id;
    }
    return this.ordersService.create(dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query("userId") userId?: string,
    @Query("shopId") shopId?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    const user = req.user;
    const effectiveUserId =
      user.role === "admin"
        ? userId
          ? Number(userId)
          : undefined
        : user.id;

    if (effectiveUserId || shopId || status || startDate || endDate) {
      return this.ordersService.findAllByUserId({
        userId: effectiveUserId,
        shopId: shopId ? Number(shopId) : undefined,
        status,
        startDate,
        endDate
      });
    }
    return this.ordersService.findAll();
  }

  @Patch(":id/deliver")
  async markAsDelivered(@Req() req: any, @Param("id", ParseIntPipe) id: number) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.ordersService.verifyOwnership(id, user.id);
    }
    return this.ordersService.markAsDelivered(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findOne(Number(id));
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateOrderDto) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.ordersService.verifyOwnership(Number(id), user.id);
    }
    return this.ordersService.update(Number(id), dto);
  }

  @Get("shop/:shopId")
  getOrdersByShop(@Req() req: any, @Param("shopId") shopId: number) {
    const user = req.user;
    return this.ordersService.findAllByUserId({
      userId: user.role === "admin" ? undefined : user.id,
      shopId: Number(shopId)
    });
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.ordersService.verifyOwnership(Number(id), user.id);
    }
    return this.ordersService.remove(Number(id));
  }
}
