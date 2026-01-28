import {
  IsNotEmpty,
  IsInt
} from "class-validator";

export class CreateEmployeeDto {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsNotEmpty()
  @IsInt()
  distributorId: number;
}
