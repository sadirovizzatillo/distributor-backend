// src/modules/audit/audit.module.ts
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuditLogInterceptor } from "./interceptors/audit-log.interceptor";

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor
    }
  ],
  exports: [AuditService]
})
export class AuditModule {}
