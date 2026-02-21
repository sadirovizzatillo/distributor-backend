import { IsOptional, IsEnum } from "class-validator";

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(["today", "week", "month"])
  period?: string;
}
