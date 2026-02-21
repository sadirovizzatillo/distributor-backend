CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"userName" varchar(100),
	"userRole" varchar(20),
	"action" varchar(50) NOT NULL,
	"entityType" varchar(50) NOT NULL,
	"entityId" integer,
	"entityName" varchar(200),
	"oldValues" jsonb,
	"newValues" jsonb,
	"description" text,
	"ipAddress" varchar(45),
	"userAgent" text,
	"distributorId" integer,
	"severity" varchar(20) DEFAULT 'info',
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopId" integer,
	"chatId" text,
	"type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'sent',
	"errorMessage" text,
	"orderId" integer,
	"paymentId" integer,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"dataType" varchar(20) DEFAULT 'string',
	"description" text,
	"category" varchar(50),
	"isEditable" boolean DEFAULT true,
	"updatedBy" integer,
	"updatedAt" timestamp DEFAULT now(),
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'info',
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"distributorId" integer,
	"shopId" integer,
	"orderId" integer,
	"metadata" jsonb,
	"isRead" boolean DEFAULT false,
	"isResolved" boolean DEFAULT false,
	"resolvedBy" integer,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_distributorId_users_id_fk" FOREIGN KEY ("distributorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_shopId_shops_id_fk" FOREIGN KEY ("shopId") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_paymentId_payments_id_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_distributorId_users_id_fk" FOREIGN KEY ("distributorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_shopId_shops_id_fk" FOREIGN KEY ("shopId") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_resolvedBy_users_id_fk" FOREIGN KEY ("resolvedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_userId" ON "audit_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entityType" ON "audit_logs" USING btree ("entityType");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_createdAt" ON "audit_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_distributorId" ON "audit_logs" USING btree ("distributorId");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_severity" ON "audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_shopId" ON "notification_logs" USING btree ("shopId");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_status" ON "notification_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_type" ON "notification_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_createdAt" ON "notification_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_type" ON "system_alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_severity" ON "system_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_isRead" ON "system_alerts" USING btree ("isRead");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_isResolved" ON "system_alerts" USING btree ("isResolved");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_createdAt" ON "system_alerts" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_distributorId" ON "system_alerts" USING btree ("distributorId");