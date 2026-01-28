import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateTransactionDto {
  @IsNumber()
  orderId: number;

  @IsNumber()
  amount: number;

  @IsEnum(["CASH", "CARD"])
  paymentType: "CASH" | "CARD";

  @IsString()
  comment: string;

  @IsNumber()
  userId: number;
}
