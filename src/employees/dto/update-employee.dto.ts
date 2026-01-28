import {
  IsNotEmpty,
  IsInt
} from "class-validator";

export class UpdateEmployeeDto {

  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsNotEmpty()
  @IsInt()
  distributorId: number;
}
