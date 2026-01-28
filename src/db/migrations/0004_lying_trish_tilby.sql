ALTER TABLE "agents" RENAME TO "employees";--> statement-breakpoint
ALTER TABLE "employees" DROP CONSTRAINT "agents_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "employees" DROP CONSTRAINT "agents_distributor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_distributor_id_users_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;