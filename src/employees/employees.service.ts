import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/db";
import { employees, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { UsersService } from "../users/users.service";

@Injectable()
export class EmployeesService {
  constructor(
    private readonly userService: UsersService // inject it
  ) {}
  async findAll() {
    return db
      .select({
        id: employees.id,
        distributorId: employees.distributorId,
        userId: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role
      })
      .from(employees)
      .leftJoin(users, eq(users.id, employees.userId));
  }

  // async findByPhone(phone: string) {
  //   const [user] = await db.select().from(employees)
  //     .where(eq(users.phone, phone));
  //   console.log(user);
  //   return user;
  // }

  async findByDistributorId(distributorId: number) {
    return db
      .select({
        id: employees.id,
        distributorId: employees.distributorId,
        userId: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role
      })
      .from(employees)
      .where(eq(employees.distributorId, distributorId)).leftJoin(users, eq(users.id, employees.userId));
  }

  async findOne(id: number) {
    const [employee] = await db
      .select({
        id: employees.id,
        distributorId: employees.distributorId,
        userId: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        password: users.password
      })
      .from(employees)
      .where(eq(employees.id, id)).leftJoin(users, eq(users.id, employees.userId));
    return employee;
  }

  async verifyOwnership(employeeId: number, distributorId: number) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId));
    if (!employee) throw new NotFoundException("Employee not found");
    if (employee.distributorId !== distributorId) {
      throw new ForbiddenException("Access denied");
    }
    return employee;
  }

  async create(data: CreateUserDto) {
    const newUser = await this.userService.create(data);
    await db.insert(employees).values({
      userId: newUser.id,
      distributorId: data.distributorId
    });
    return newUser;
  }

  async update(id: number, data:any) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .leftJoin(users, eq(users.id, employees.userId));
    const updated  = await this.userService.update(employee.users.id, data);
    console.log(id, updated);
    return updated;
  }

  async remove(id: number) {
    await db.delete(employees).where(eq(employees.id, id));
    return { message: "Employee deleted" };
  }
}
