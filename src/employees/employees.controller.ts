import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  ForbiddenException,
  ValidationPipe,
  UseGuards
} from "@nestjs/common";
import { EmployeesService } from "./employees.service";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Req() req: any) {
    const user = req.user;
    if (user.role === "admin") {
      return this.employeesService.findAll();
    }
    return this.employeesService.findByDistributorId(user.id);
  }

  @Get("distributor/:id")
  findByDistributorId(@Req() req: any, @Param("id") id: number) {
    const user = req.user;
    if (user.role !== "admin" && user.id !== Number(id)) {
      return this.employeesService.findByDistributorId(user.id);
    }
    return this.employeesService.findByDistributorId(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.employeesService.findOne(+id);
  }

  @Post()
  create(@Req() req: any, @Body(new ValidationPipe()) body: CreateUserDto) {
    const user = req.user;
    if (user.role !== "admin") {
      body.distributorId = user.id;
      body.role = "agent";
    }
    return this.employeesService.create(body);
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.employeesService.verifyOwnership(+id, user.id);
    }
    return this.employeesService.update(+id, body);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const user = req.user;
    if (user.role !== "admin") {
      await this.employeesService.verifyOwnership(+id, user.id);
    }
    return this.employeesService.remove(+id);
  }
}
