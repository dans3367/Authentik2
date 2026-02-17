import { logger } from "@trigger.dev/sdk/v3";

/**
 * Custom retry strategy for database/API connection failures.
 *
 * Schedule:
 *   Attempts 1–3: retry every 30 seconds
 *   Attempts 4–6: retry every 1 hour
 *   Attempt 7:    retry after 24 hours
 *   After 7:      fail permanently
 *
 * Usage: add to any task definition:
 *   retry: DB_RETRY_CONFIG,
 *   catchError: dbConnectionCatchError,
 */

// Patterns that indicate a database or network/connection failure worth retrying
const RETRYABLE_PATTERNS = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "fetch failed",
  "socket hang up",
  "connection refused",
  "connection reset",
  "connection terminated",
  "connection timed out",
  "too many connections",
  "database",
  "EPIPE",
  "network",
  "503",
  "502",
  "504",
  "EHOSTUNREACH",
];

function isRetryableError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return RETRYABLE_PATTERNS.some((pattern) =>
    message.includes(pattern.toLowerCase())
  );
}

/**
 * Retry delays by attempt number (1-indexed).
 * Attempts 1-3: 30 seconds
 * Attempts 4-6: 1 hour
 * Attempt 7:    24 hours
 */
function getRetryDelayMs(attemptNumber: number): number | null {
  if (attemptNumber >= 1 && attemptNumber <= 3) {
    return 30 * 1000; // 30 seconds
  }
  if (attemptNumber >= 4 && attemptNumber <= 6) {
    return 60 * 60 * 1000; // 1 hour
  }
  if (attemptNumber === 7) {
    return 24 * 60 * 60 * 1000; // 24 hours
  }
  return null; // No more retries
}

/**
 * Retry config — set maxAttempts to 8 so Trigger.dev allows up to 7 retries
 * (first run + 7 retries = 8 total attempts).
 */
export const DB_RETRY_CONFIG = {
  maxAttempts: 8,
};

/**
 * catchError handler that implements the custom retry schedule
 * for database/connection errors. Non-connection errors use default behavior.
 */
export async function dbConnectionCatchError({
  error,
  ctx,
}: {
  error: unknown;
  ctx: { run: { id: string }; attempt: { number: number } };
  payload?: unknown;
  retryAt?: Date;
}) {
  const attemptNumber = ctx.attempt.number;

  if (!isRetryableError(error)) {
    // Not a connection error — let default retry logic handle it
    logger.warn("Non-retryable error encountered, using default retry behavior", {
      attemptNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }

  const delayMs = getRetryDelayMs(attemptNumber);

  if (delayMs === null) {
    // Exhausted all retries
    logger.error("All retry attempts exhausted for connection error", {
      attemptNumber,
      runId: ctx.run.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { skipRetrying: true };
  }

  const retryAt = new Date(Date.now() + delayMs);
  const delayLabel =
    delayMs < 60000
      ? `${delayMs / 1000}s`
      : delayMs < 3600000
        ? `${delayMs / 60000}m`
        : `${delayMs / 3600000}h`;

  logger.warn(
    `Connection error on attempt ${attemptNumber}, retrying in ${delayLabel}`,
    {
      attemptNumber,
      retryAt: retryAt.toISOString(),
      runId: ctx.run.id,
      error: error instanceof Error ? error.message : String(error),
    }
  );

  return { retryAt };
}
