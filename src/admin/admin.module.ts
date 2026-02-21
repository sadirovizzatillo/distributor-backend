// src/modules/admin/admin.module.ts
import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    AuditModule // For audit logging
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminModule {}
