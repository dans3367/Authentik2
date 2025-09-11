/**
 * Utility functions for promotional code generation
 */

// Character sets for code generation
const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ALPHABETIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMERIC = '0123456789';

export type CodeFormat = 'alphanumeric' | 'alphabetic' | 'numeric';

export interface CodeGenerationOptions {
  count: number;
  length: number;
  format: CodeFormat;
  prefix?: string;
  suffix?: string;
}

/**
 * Generate random codes based on the specified options
 */
export function generatePromotionalCodes(options: CodeGenerationOptions): string[] {
  const { count, length, format, prefix = '', suffix = '' } = options;
  
  if (count <= 0 || length <= 0) {
    throw new Error('Count and length must be positive numbers');
  }
  
  if (count > 10000) {
    throw new Error('Cannot generate more than 10,000 codes at once');
  }
  
  const charset = getCharsetByFormat(format);
  const codes = new Set<string>();
  
  // Generate unique codes
  while (codes.size < count) {
    const code = generateSingleCode(length, charset, prefix, suffix);
    codes.add(code);
  }
  
  return Array.from(codes);
}

/**
 * Parse user-provided codes from a text string
 */
export function parseUserCodes(input: string): string[] {
  if (!input.trim()) {
    return [];
  }
  
  // Split by various delimiters and filter out empty strings
  const codes = input
    .split(/[\s,;|\n\r]+/)
    .map(code => code.trim().toUpperCase())
    .filter(code => code.length > 0);
  
  // Remove duplicates
  return Array.from(new Set(codes));
}

/**
 * Validate promotional codes
 */
export function validatePromotionalCodes(codes: string[]): {
  valid: string[];
  invalid: string[];
  errors: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  const errors: string[] = [];
  
  if (codes.length === 0) {
    errors.push('At least one promotional code is required');
    return { valid, invalid, errors };
  }
  
  if (codes.length > 10000) {
    errors.push('Cannot have more than 10,000 promotional codes');
    return { valid, invalid, errors };
  }
  
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  
  codes.forEach(code => {
    // Check for empty or invalid codes
    if (!code || code.length === 0) {
      invalid.push(code);
      return;
    }
    
    // Check code length
    if (code.length < 2 || code.length > 50) {
      invalid.push(code);
      return;
    }
    
    // Check for valid characters (alphanumeric and common special chars)
    if (!/^[A-Z0-9\-_]+$/.test(code)) {
      invalid.push(code);
      return;
    }
    
    // Check for duplicates
    if (seen.has(code)) {
      duplicates.add(code);
      return;
    }
    
    seen.add(code);
    valid.push(code);
  });
  
  if (duplicates.size > 0) {
    errors.push(`Duplicate codes found: ${Array.from(duplicates).join(', ')}`);
  }
  
  if (invalid.length > 0) {
    errors.push(`${invalid.length} invalid codes found. Codes must be 2-50 characters and contain only letters, numbers, hyphens, and underscores.`);
  }
  
  return { valid, invalid, errors };
}

/**
 * Get character set based on format
 */
function getCharsetByFormat(format: CodeFormat): string {
  switch (format) {
    case 'alphanumeric':
      return ALPHANUMERIC;
    case 'alphabetic':
      return ALPHABETIC;
    case 'numeric':
      return NUMERIC;
    default:
      return ALPHANUMERIC;
  }
}

/**
 * Generate a single random code
 */
function generateSingleCode(length: number, charset: string, prefix: string, suffix: string): string {
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    code += charset[randomIndex];
  }
  
  return prefix + code + suffix;
}

/**
 * Format codes for display
 */
export function formatCodesForDisplay(codes: string[]): string {
  return codes.join(' ');
}

/**
 * Get code generation presets
 */
export const CODE_GENERATION_PRESETS = {
  short: { length: 6, format: 'alphanumeric' as CodeFormat },
  medium: { length: 8, format: 'alphanumeric' as CodeFormat },
  long: { length: 12, format: 'alphanumeric' as CodeFormat },
  alphabetic: { length: 8, format: 'alphabetic' as CodeFormat },
  numeric: { length: 6, format: 'numeric' as CodeFormat },
} as const;
