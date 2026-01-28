import { Injectable } from "@nestjs/common";
import { db } from "../db/db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  async findAll() {
    return db.select().from(users);
  }

  async findByPhone(phone: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.phone, phone));
    console.log(user);
    return user;
  }

  async findOne(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async findCurrentUser(userId) {
    const [user] = await db
      .select({
        id: users.id,
      name: users.name,
      phone: users.phone,
      role: users.role
    })
      .from(users)
      .where(eq(users.id, userId));
    return user;
  }

  async create(data: CreateUserDto) {
    const [newUser] = await db.insert(users).values(data).returning();
    return newUser;
  }

  async update(id: number, data: UpdateUserDto) {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async remove(id: number) {
    await db.delete(users).where(eq(users.id, id));
    return { message: "User deleted" };
  }
}
