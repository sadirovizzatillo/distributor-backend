import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(@Req() req: any, @Query("userId") userId: string) {
    const user = req.user;
    if (user.role === "admin") {
      return userId
        ? this.productsService.findAllByUserId(userId)
        : this.productsService.findAll();
    }
    return this.productsService.findAllByUserId(String(user.id));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(+id);
  }

  @Post()
  async create(@Req() req: any, @Body(new ValidationPipe()) body: CreateProductDto) {
    const user = req.user;
    if (user.role !== "admin") {
      body.userId = user.id;
    }
    return this.productsService.create(body);
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.productsService.verifyOwnership(+id, user.id);
    }
    return this.productsService.update(+id, dto);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.productsService.verifyOwnership(+id, user.id);
    }
    return this.productsService.remove(+id);
  }
}
