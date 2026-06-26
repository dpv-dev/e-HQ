CREATE TABLE "api_idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
