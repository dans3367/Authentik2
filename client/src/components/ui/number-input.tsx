import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type NumberVariant = 'number' | 'phone' | 'country-phone' | 'currency';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  min?: number;
  max?: number;
  step?: number;
  variant?: NumberVariant;
  onChange?: (value: string) => void;
}

// Format phone number as (XXX) XXX-XXXX
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Format country phone number as +CC (XXX) XXX-XXXX
function formatCountryPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15); // Allow up to 15 digits for international numbers
  
  if (digits.length === 0) return '';
  
  // Extract country code (1-3 digits)
  let countryCode = '';
  let remainingDigits = digits;
  
  if (digits.length >= 1) {
    // Try to detect country code patterns
    if (digits.startsWith('1') && digits.length >= 11) {
      // US/Canada format: +1 (XXX) XXX-XXXX
      countryCode = '+1';
      remainingDigits = digits.slice(1);
      
      if (remainingDigits.length === 0) return countryCode;
      if (remainingDigits.length <= 3) return `${countryCode} (${remainingDigits}`;
      if (remainingDigits.length <= 6) return `${countryCode} (${remainingDigits.slice(0, 3)}) ${remainingDigits.slice(3)}`;
      return `${countryCode} (${remainingDigits.slice(0, 3)}) ${remainingDigits.slice(3, 6)}-${remainingDigits.slice(6, 10)}`;
    } else if (digits.startsWith('44') && digits.length >= 12) {
      // UK format: +44 XXXX XXXXXX
      countryCode = '+44';
      remainingDigits = digits.slice(2);
      
      if (remainingDigits.length === 0) return countryCode;
      if (remainingDigits.length <= 4) return `${countryCode} ${remainingDigits}`;
      return `${countryCode} ${remainingDigits.slice(0, 4)} ${remainingDigits.slice(4, 10)}`;
    } else {
      // Generic international format: +CC XXXXXXXX...
      const codeLength = Math.min(3, digits.length);
      countryCode = '+' + digits.slice(0, codeLength);
      remainingDigits = digits.slice(codeLength);
      
      if (remainingDigits.length === 0) return countryCode;
      // Format remaining digits in groups of 2-3 for readability
      const groups = [];
      let i = 0;
      while (i < remainingDigits.length) {
        const groupSize = i === 0 ? 3 : 2; // First group 3 digits, then 2
        groups.push(remainingDigits.slice(i, i + groupSize));
        i += groupSize;
      }
      return `${countryCode} ${groups.join(' ')}`;
    }
  }
  
  return '+' + digits;
}

// Format currency as $X,XXX.XX
function formatCurrency(value: string): string {
  // Remove all non-digit characters except decimal point
  let digits = value.replace(/[^\d.]/g, '');
  
  // Handle multiple decimal points - keep only the first one
  const parts = digits.split('.');
  if (parts.length > 2) {
    digits = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Split into integer and decimal parts
  const [intPart, decPart] = digits.split('.');
  
  // Format integer part with commas
  const formattedInt = intPart ? parseInt(intPart, 10).toLocaleString('en-US') : '0';
  
  // Limit decimal to 2 places
  const formattedDec = decPart !== undefined ? '.' + decPart.slice(0, 2) : '';
  
  return '$' + formattedInt + formattedDec;
}

export function NumberInput({ 
  className, 
  min, 
  max, 
  step = 1, 
  variant = 'number',
  onChange,
  value: propValue,
  defaultValue,
  ...props 
}: NumberInputProps) {
  const [internalValue, setInternalValue] = useState(() => {
    const initial = propValue?.toString() || defaultValue?.toString() || '';
    if (variant === 'phone') return formatPhoneNumber(initial);
    if (variant === 'country-phone') return formatCountryPhoneNumber(initial);
    if (variant === 'currency') return initial ? formatCurrency(initial) : '';
    return initial;
  });

  const displayValue = propValue !== undefined ? (
    variant === 'phone' ? formatPhoneNumber(propValue.toString()) :
    variant === 'country-phone' ? formatCountryPhoneNumber(propValue.toString()) :
    variant === 'currency' ? formatCurrency(propValue.toString()) :
    propValue.toString()
  ) : internalValue;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let formattedValue: string;
    let rawNumericValue: string;

    switch (variant) {
      case 'phone':
        formattedValue = formatPhoneNumber(rawValue);
        rawNumericValue = rawValue.replace(/\D/g, '').slice(0, 10);
        break;
      case 'country-phone':
        formattedValue = formatCountryPhoneNumber(rawValue);
        rawNumericValue = rawValue.replace(/\D/g, '').slice(0, 15);
        break;
      case 'currency':
        formattedValue = formatCurrency(rawValue);
        rawNumericValue = rawValue.replace(/[^\d.]/g, '');
        break;
      default:
        formattedValue = rawValue;
        rawNumericValue = rawValue;
    }

    setInternalValue(formattedValue);
    onChange?.(rawNumericValue);
  }, [variant, onChange]);

  // For number variant, use native number input
  if (variant === 'number') {
    return (
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={propValue}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }

  // For phone, country-phone and currency, use text input with masking
  return (
    <input
      type="text"
      inputMode={variant === 'phone' || variant === 'country-phone' ? 'tel' : 'decimal'}
      value={displayValue}
      onChange={handleChange}
      placeholder={
        props.placeholder || 
        (variant === 'phone' ? '(555) 555-5555' : 
         variant === 'country-phone' ? '+1 (555) 555-5555' : 
         variant === 'currency' ? '$0.00' : undefined)
      }
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export default NumberInput;