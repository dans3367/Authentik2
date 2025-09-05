-- Add better-auth tables for the new authentication system

-- Better Auth User table
CREATE TABLE IF NOT EXISTS "better_auth_user" (
    "id" text PRIMARY KEY,
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE,
    "email_verified" boolean NOT NULL,
    "image" text,
    "created_at" timestamp NOT NULL,
    "updated_at" timestamp NOT NULL,
    "role" text DEFAULT 'Employee' NOT NULL,
    "tenant_id" varchar NOT NULL
);

-- Better Auth Session table
CREATE TABLE IF NOT EXISTS "better_auth_session" (
    "id" text PRIMARY KEY,
    "expires_at" timestamp NOT NULL,
    "token" text NOT NULL UNIQUE,
    "created_at" timestamp NOT NULL,
    "updated_at" timestamp NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "user_id" text NOT NULL REFERENCES "better_auth_user"("id") ON DELETE CASCADE
);

-- Better Auth Account table
CREATE TABLE IF NOT EXISTS "better_auth_account" (
    "id" text PRIMARY KEY,
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "user_id" text NOT NULL REFERENCES "better_auth_user"("id") ON DELETE CASCADE,
    "access_token" text,
    "refresh_token" text,
    "id_token" text,
    "access_token_expires_at" timestamp,
    "refresh_token_expires_at" timestamp,
    "scope" text,
    "password" text,
    "created_at" timestamp NOT NULL,
    "updated_at" timestamp NOT NULL
);

-- Better Auth Verification table
CREATE TABLE IF NOT EXISTS "better_auth_verification" (
    "id" text PRIMARY KEY,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp NOT NULL,
    "updated_at" timestamp NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "better_auth_user_email_idx" ON "better_auth_user"("email");
CREATE INDEX IF NOT EXISTS "better_auth_session_token_idx" ON "better_auth_session"("token");
CREATE INDEX IF NOT EXISTS "better_auth_session_user_id_idx" ON "better_auth_session"("user_id");
CREATE INDEX IF NOT EXISTS "better_auth_account_user_id_idx" ON "better_auth_account"("user_id");
CREATE INDEX IF NOT EXISTS "better_auth_verification_identifier_idx" ON "better_auth_verification"("identifier");

