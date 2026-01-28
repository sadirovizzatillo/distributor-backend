import { IsInt, IsNotEmpty, Min } from "class-validator";

export class OrderItemDto {
  @IsNotEmpty()
  @IsInt()
  productId: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;
}
