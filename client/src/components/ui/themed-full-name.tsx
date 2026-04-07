import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FormTheme } from '@/types/form-builder';

interface ThemedFullNameProps {
  name?: string;
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
  onChange?: (firstName: string, lastName: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  themeStyles?: FormTheme['styles'];
}

export function ThemedFullName({
  name,
  firstNamePlaceholder = "First Name",
  lastNamePlaceholder = "Last Name",
  onChange,
  className,
  required = false,
  disabled = false,
  readonly = false,
  themeStyles
}: ThemedFullNameProps) {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');

  const handleChange = (field: 'firstName' | 'lastName', value: string) => {
    if (field === 'firstName') {
      setFirstName(value);
      onChange?.(value, lastName);
    } else {
      setLastName(value);
      onChange?.(firstName, value);
    }
  };

  // Use theme styles for inputs if available, otherwise fall back to default styling
  const inputClasses = themeStyles?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  
  const forceTransparentStyle: React.CSSProperties = {};

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <Input
        name={name ? `${name}_first` : 'firstName'}
        placeholder={firstNamePlaceholder}
        value={firstName}
        onChange={(e) => handleChange('firstName', e.target.value)}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        className={inputClasses}
        style={forceTransparentStyle}
      />
      <Input
        name={name ? `${name}_last` : 'lastName'}
        placeholder={lastNamePlaceholder}
        value={lastName}
        onChange={(e) => handleChange('lastName', e.target.value)}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        className={inputClasses}
        style={forceTransparentStyle}
      />
    </div>
  );
}

export default ThemedFullName;