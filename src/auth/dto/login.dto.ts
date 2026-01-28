import {
  IsNotEmpty,
  IsString,
  Length
} from "class-validator";

export class LoginDto {
  @IsNotEmpty({ message: "Phone is required" })
  @IsString()
  phone: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @Length(6, 255, { message: "Password must be at least 6 characters" })
  password: string;
}
