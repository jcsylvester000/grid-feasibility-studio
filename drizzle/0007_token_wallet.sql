CREATE TABLE "token_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"product" text,
	"report_id" uuid,
	"run_id" uuid,
	"report_title" text,
	"refund_of" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "charge_id" uuid;--> statement-breakpoint
ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_wallets" ADD CONSTRAINT "token_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_ledger_user_at_idx" ON "token_ledger" USING btree ("user_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "token_ledger_refund_once" ON "token_ledger" USING btree ("refund_of") WHERE refund_of is not null;