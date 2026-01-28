// dto/create-payment.dto.ts
import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsIn
} from "class-validator";

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsInt()
  shopId: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @IsIn(["cash", "card", "transfer"])
  paymentMethod?: string = "cash";

  @IsOptional()
  @IsInt()
  receivedBy?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
