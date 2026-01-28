import {
  IsArray,
  IsInt,
  IsNotEmpty,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { OrderItemDto } from "./order-item.dto";

export class CreateOrderDto {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsNotEmpty()
  @IsInt()
  shopId: number;

  // // @IsNotEmpty()
  // @isNumber()
  // @Min(0)
  // remainingAmount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
