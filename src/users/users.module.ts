import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { IsPhoneUnique } from "../utils/validators/is-phone-unique.validator";

@Module({
  controllers: [UsersController],
  providers: [UsersService, IsPhoneUnique],
  exports: [UsersService, IsPhoneUnique]
})
export class UsersModule {}
