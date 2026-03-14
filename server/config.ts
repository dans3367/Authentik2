import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
// This must be called before any other modules that use process.env
dotenv.config();

// Re-export dotenv for convenience
export { dotenv };

// Environment variable validation schema
const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),

  // Server
  PORT: z.string().default("5002"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BASE_URL: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  APP_NAME: z.string().default("Zendwise"),

  // Email
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),
  USE_ENHANCED_EMAIL: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // R2 / S3
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("authentik-avatars"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Observability
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_ORG_ID: z.string().optional(),
  LOG_LEVEL: z.string().optional(),

  // Services
  TEMPORAL_GRPC_SERVER: z.string().default("localhost:50051"),

  // Security
  DISABLE_RATE_LIMITING: z.string().optional(),
  IP_WHITELIST: z.string().optional(),
  IP_BLACKLIST: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Validate environment variables at startup
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of result.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = result.data;
