import { IsOptional, IsString, IsNumberString, IsIn } from "class-validator";

export class AdminQueryDto {
  @IsOptional()
  @IsNumberString()
  distributorId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AnalyticsPeriodDto {
  @IsOptional()
  @IsIn(["day", "week", "month"])
  period?: "day" | "week" | "month";

  @IsOptional()
  @IsNumberString()
  days?: string;
}
