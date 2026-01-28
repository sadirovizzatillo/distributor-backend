import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
  IsNumber,
  Validate
} from "class-validator";
import { IsPhoneUnique } from "../../utils/validators/is-phone-unique.validator";

export enum UserRole {
  DISTRIBUTOR = "distributor",
  AGENT = "agent"
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  @Length(2, 100, { message: "Name must be between 2 and 100 characters" })
  name: string;

  @IsString()
  role: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @Length(6, 255, { message: "Password must be at least 6 characters" })
  password: string;

  @IsString()
  @IsNotEmpty({ message: "Phone number is required" })
  @Matches(/^\+?\d{9,13}$/, {
    message: "Phone must be a valid number with 9-13 digits"
  })
  @Validate(IsPhoneUnique)
  phone: string;

  @IsNumber()
  @IsOptional() // distributorId IS optional, because distributors themselves have no parent
  distributorId?: number;
}
