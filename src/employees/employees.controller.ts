import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ValidationPipe,
  UseGuards
} from "@nestjs/common";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { CreateUserDto } from "../users/dto/create-user.dto";
// import { JwtAuthGuard } from "../auth/jwt-auth.guard";
// import { RolesGuard } from "../auth/roles.guard";
// import { Roles } from "../auth/decorators/roles.decorator";

// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles("user")
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.employeesService.findOne(+id);
  }

  @Get("distributor/:id")
  findByDistributorId(@Param("id") id: number) {
    return this.employeesService.findByDistributorId(id);
  }

  @Post()
  create(@Body(new ValidationPipe()) body: CreateUserDto) {
    return this.employeesService.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    console.log(body, id);
    return this.employeesService.update(+id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.employeesService.remove(+id);
  }
}
