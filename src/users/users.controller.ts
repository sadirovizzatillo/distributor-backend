import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ForbiddenException,
  ValidationPipe,
  UseGuards,
  Req
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "user")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Req() req: any) {
    const user = req.user;
    if (user.role === "admin") {
      return this.usersService.findAll();
    }
    return this.usersService.findOne(user.id);
  }

  @Get("/me/p")
  findCurrentUser(@Req() req: any) {
    return this.usersService.findCurrentUser(req.user.id);
  }

  @Get(":id")
  findOne(@Req() req: any, @Param("id") id: string) {
    const user = req.user;
    if (user.role !== "admin" && user.id !== +id) {
      throw new ForbiddenException("Access denied");
    }
    return this.usersService.findOne(+id);
  }

  @Post()
  @Roles("admin")
  create(@Body(new ValidationPipe()) body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Patch(":id")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: UpdateUserDto
  ) {
    const user = req.user;
    if (user.role !== "admin" && user.id !== +id) {
      throw new ForbiddenException("Access denied");
    }
    if (user.role !== "admin") {
      delete (body as any).role;
    }
    return this.usersService.update(+id, body);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.usersService.remove(+id);
  }
}
