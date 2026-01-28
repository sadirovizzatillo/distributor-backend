// payment.dto.ts - ADD these DTOs

import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class AddManualDebtDto {
  @IsInt()
  shopId: number;

  @IsNumber()
  @Min(0.01)
  debtAmount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SetExactDebtDto {
  @IsInt()
  shopId: number;

  @IsNumber()
  @Min(0)
  debtAmount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}