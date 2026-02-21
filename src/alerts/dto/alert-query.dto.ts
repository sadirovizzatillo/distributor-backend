import { IsOptional, IsNumber, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AlertQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsEnum(['info', 'warning', 'critical'])
  severity?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isResolved?: boolean;
}
