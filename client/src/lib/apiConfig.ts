/**
 * API Configuration utilities for dynamic URL handling
 * Supports both localhost development and external IP access
 */

// Get the API server port from environment or default
const API_PORT = import.meta.env.VITE_API_PORT || '5002';

/**
 * Determines if the current access is via localhost
 */
export const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return true;
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

/**
 * Gets the base URL for the main API server
 * - Uses relative URLs for localhost (Vite proxy handles it)
 * - Uses direct IP:port for external access
 */
export const getApiBaseUrl = (): string => {
  // Use environment variable if explicitly set
  if (import.meta.env.VITE_BETTER_AUTH_URL) {
    return import.meta.env.VITE_BETTER_AUTH_URL;
  }
  
  if (typeof window === 'undefined') {
    return `http://localhost:${API_PORT}`;
  }
  
  const { hostname, protocol } = window.location;
  
  // For localhost, use relative URLs (Vite proxy handles routing)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '';
  }
  
  // For IP address access, point directly to the API server
  return `${protocol}//${hostname}:${API_PORT}`;
};

/**
 * Gets the base URL for the forms server
 * NOTE: Forms are now served by the main server — this returns the main API URL.
 */
export const getFormsServerUrl = (): string => {
  return getApiBaseUrl();
};

/**
 * Builds a full API URL from a relative path
 */
export const buildApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  if (path.startsWith('http')) {
    return path;
  }
  return baseUrl ? `${baseUrl}${path}` : path;
};
