// src/modules/alerts/alerts.module.ts
import { Module } from "@nestjs/common";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
// import { AlertsScheduler } from "./alerts.scheduler";

@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    // AlertsScheduler // For automated alert generation
  ],
  exports: [AlertsService]
})
export class AlertsModule {}
