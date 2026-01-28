import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { Injectable } from "@nestjs/common";
import { db } from "../../db/db"; // adjust path
import { users } from "../../db/schema"; // adjust path
import { eq } from "drizzle-orm";

@ValidatorConstraint({ async: true })
@Injectable()
export class IsPhoneUnique implements ValidatorConstraintInterface {
  async validate(phone: string, args: ValidationArguments) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone));

    return existing.length === 0; // true = valid
  }

  defaultMessage(args: ValidationArguments) {
    return "Phone number already exists";
  }
}
