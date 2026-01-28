import { Module } from "@nestjs/common";
import { EmployeesService } from "./employees.service";
import { EmployeesController } from "./employees.controller";
import { UsersService } from "../users/users.service";

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, UsersService],
  exports: [EmployeesService]
})
export class EmployeeModule {}
