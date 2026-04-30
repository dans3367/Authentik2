import { Request, Response, NextFunction } from 'express';

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return null;
  }
}

function configuredAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  const values = [
    process.env.FRONTEND_URL,
    process.env.BASE_URL,
    ...(process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : []),
  ];

  for (const value of values) {
    const origin = normalizeOrigin(value);
    if (origin) allowed.add(origin);
  }

  return allowed;
}

function isDevelopmentLoopback(origin: string): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function requestHostOrigin(req: Request): string | null {
  const host = req.get('host');
  if (!host) return null;

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol || (req.secure ? 'https' : 'http');
  return normalizeOrigin(`${proto}://${host}`);
}

function isTrustedOrigin(origin: string, req: Request): boolean {
  const ownOrigin = requestHostOrigin(req);
  if (ownOrigin && origin === ownOrigin) return true;
  if (configuredAllowedOrigins().has(origin)) return true;
  return isDevelopmentLoopback(origin);
}

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = normalizeOrigin(req.get('origin'));
  const referer = normalizeOrigin(req.get('referer'));
  const candidate = origin || referer;

  if (!candidate) {
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(403).json({ message: 'Missing request origin' });
  }

  if (!isTrustedOrigin(candidate, req)) {
    return res.status(403).json({ message: 'Untrusted request origin' });
  }

  next();
}
