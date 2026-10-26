CREATE TABLE "agent_vm_sessions" (
	"agent_id" varchar PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"sandbox_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'paused' NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_vm_sessions_sandbox_id_unique" UNIQUE("sandbox_id"),
	CONSTRAINT "agent_vm_sessions_agent_id_agentConfig_agentId_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agentConfig"("agentId") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "agent_vm_sessions_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action
);
