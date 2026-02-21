import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { UpdateShopDto } from "./dto/update-shop.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("shops")
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateShopDto) {
    const user = req.user;
    if (user.role !== "admin") {
      dto.userId = user.id;
    }
    return this.shopsService.create(dto);
  }

  @Get()
  findAllByUserId(@Req() req: any, @Query("userId") userId: string) {
    const user = req.user;
    if (user.role === "admin") {
      return userId
        ? this.shopsService.findAllByUserId(userId)
        : this.shopsService.findAll();
    }
    return this.shopsService.findAllByUserId(String(user.id));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.shopsService.findOne(Number(id));
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateShopDto) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.shopsService.verifyOwnership(Number(id), user.id);
    }
    return this.shopsService.update(Number(id), dto);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.shopsService.verifyOwnership(Number(id), user.id);
    }
    return this.shopsService.remove(Number(id));
  }
}
