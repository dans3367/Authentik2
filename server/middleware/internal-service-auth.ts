import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;

export interface InternalServiceRequest extends Request {
  internalService?: {
    service: string;
    verified: boolean;
  };
}

/**
 * Generates an HMAC signature for internal service requests.
 * Used by Trigger.dev tasks to sign requests to internal endpoints.
 */
export function generateInternalSignature(
  payload: object,
  timestamp: number,
  secret?: string
): string {
  const secretKey = secret || INTERNAL_SERVICE_SECRET;
  if (!secretKey) {
    throw new Error('INTERNAL_SERVICE_SECRET is not configured');
  }

  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  return createHmac('sha256', secretKey)
    .update(signaturePayload)
    .digest('hex');
}

/**
 * Verifies an HMAC signature from internal service requests.
 */
export function verifyInternalSignature(
  payload: object,
  timestamp: number,
  signature: string,
  secret?: string
): boolean {
  const secretKey = secret || INTERNAL_SERVICE_SECRET;
  if (!secretKey) {
    console.error('INTERNAL_SERVICE_SECRET is not configured');
    return false;
  }

  const expectedSignature = generateInternalSignature(payload, timestamp, secretKey);
  
  try {
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Middleware to authenticate internal service requests using HMAC signatures.
 * 
 * Required headers:
 * - x-internal-service: Service identifier (e.g., 'trigger', 'trigger.dev')
 * - x-internal-timestamp: Unix timestamp (ms) when request was signed
 * - x-internal-signature: HMAC-SHA256 signature of timestamp.payload
 * 
 * Security features:
 * - HMAC-SHA256 signature verification using shared secret
 * - Timestamp validation to prevent replay attacks (5 minute window)
 * - Timing-safe comparison to prevent timing attacks
 */
export function authenticateInternalService(
  req: InternalServiceRequest,
  res: Response,
  next: NextFunction
) {
  const internalService = req.headers['x-internal-service'] as string;
  const timestamp = req.headers['x-internal-timestamp'] as string;
  const signature = req.headers['x-internal-signature'] as string;

  // Check if INTERNAL_SERVICE_SECRET is configured
  if (!INTERNAL_SERVICE_SECRET) {
    console.error('🔐 [Internal Auth] INTERNAL_SERVICE_SECRET is not configured');
    return res.status(500).json({ 
      error: 'Internal service authentication not configured',
      code: 'AUTH_NOT_CONFIGURED'
    });
  }

  // Validate required headers
  const validServices = ['trigger', 'trigger.dev', 'inngest'];
  const normalizedService = (internalService || '').toString().toLowerCase();
  
  if (!validServices.includes(normalizedService)) {
    console.warn('🔐 [Internal Auth] Invalid or missing service header:', internalService);
    return res.status(403).json({ 
      error: 'Forbidden',
      code: 'INVALID_SERVICE_HEADER'
    });
  }

  if (!timestamp || !signature) {
    console.warn('🔐 [Internal Auth] Missing timestamp or signature headers');
    return res.status(403).json({ 
      error: 'Forbidden',
      code: 'MISSING_AUTH_HEADERS'
    });
  }

  // Validate timestamp to prevent replay attacks (5 minute window)
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (isNaN(requestTime) || Math.abs(now - requestTime) > maxAge) {
    console.warn('🔐 [Internal Auth] Timestamp out of range:', {
      requestTime,
      now,
      diff: Math.abs(now - requestTime),
      maxAge
    });
    return res.status(403).json({ 
      error: 'Forbidden',
      code: 'TIMESTAMP_EXPIRED'
    });
  }

  // Verify HMAC signature
  const isValid = verifyInternalSignature(req.body, requestTime, signature);

  if (!isValid) {
    console.warn('🔐 [Internal Auth] Invalid signature for request:', {
      service: normalizedService,
      timestamp: requestTime,
      bodyKeys: Object.keys(req.body || {})
    });
    return res.status(403).json({ 
      error: 'Forbidden',
      code: 'INVALID_SIGNATURE'
    });
  }

  // Attach verified service info to request
  req.internalService = {
    service: normalizedService,
    verified: true
  };

  console.log('🔐 [Internal Auth] Request authenticated:', {
    service: normalizedService,
    timestamp: requestTime
  });

  next();
}
