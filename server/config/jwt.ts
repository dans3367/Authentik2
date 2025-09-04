/**
 * Centralized JWT configuration
 * Ensures consistent secret usage across the application
 */

import jwt from 'jsonwebtoken';

// JWT Secrets - centralized to prevent inconsistencies
export const JWT_SECRETS = {
  accessToken: process.env.JWT_SECRET || "your-super-secret-jwt-key",
  refreshToken: process.env.REFRESH_TOKEN_SECRET || "your-super-secret-refresh-key",
} as const;

/**
 * JWT utility functions for consistent token handling
 */
export class JWTUtils {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: {
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    tenantSlug?: string;
  }, expiresIn: string = '15m'): string {
    return jwt.sign(payload, JWT_SECRETS.accessToken, { expiresIn });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: { userId: string; type: 'refresh' }, expiresIn: string = '7d'): string {
    return jwt.sign(payload, JWT_SECRETS.refreshToken, { expiresIn });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRETS.accessToken);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRETS.refreshToken);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Decode token without verification (for inspection)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;

      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

