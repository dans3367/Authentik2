import { RateLimiter } from './types';

// Token bucket rate limiter implementation
export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(requestsPerSecond: number, burstSize?: number) {
    this.maxTokens = burstSize || requestsPerSecond;
    this.tokens = this.maxTokens;
    this.refillRate = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  canSend(): boolean {
    this.refillTokens();
    return this.tokens >= 1;
  }

  recordSend(): void {
    this.refillTokens();
    if (this.tokens >= 1) {
      this.tokens -= 1;
    }
  }

  getNextAvailableTime(): Date {
    this.refillTokens();
    
    if (this.tokens >= 1) {
      return new Date(); // Available now
    }

    // Calculate when the next token will be available
    const tokensNeeded = 1 - this.tokens;
    const timeToRefill = (tokensNeeded / this.refillRate) * 1000; // Convert to milliseconds
    return new Date(Date.now() + timeToRefill);
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  // Get current status for monitoring
  getStatus(): { tokens: number; maxTokens: number; refillRate: number } {
    this.refillTokens();
    return {
      tokens: this.tokens,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate
    };
  }
}

// Sliding window rate limiter for more precise control
export class SlidingWindowRateLimiter implements RateLimiter {
  private readonly requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(requestsPerSecond: number, windowSizeSeconds: number = 1) {
    this.maxRequests = requestsPerSecond * windowSizeSeconds;
    this.windowMs = windowSizeSeconds * 1000;
  }

  canSend(): boolean {
    this.cleanupOldRequests();
    return this.requests.length < this.maxRequests;
  }

  recordSend(): void {
    this.cleanupOldRequests();
    if (this.requests.length < this.maxRequests) {
      this.requests.push(Date.now());
    }
  }

  getNextAvailableTime(): Date {
    this.cleanupOldRequests();
    
    if (this.requests.length < this.maxRequests) {
      return new Date(); // Available now
    }

    // Next available time is when the oldest request expires
    const oldestRequest = this.requests[0];
    return new Date(oldestRequest + this.windowMs);
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.requests.length > 0 && this.requests[0] < cutoff) {
      this.requests.shift();
    }
  }

  // Get current status for monitoring
  getStatus(): { currentRequests: number; maxRequests: number; windowMs: number } {
    this.cleanupOldRequests();
    return {
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs
    };
  }
}