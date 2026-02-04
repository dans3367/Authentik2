import React from 'react';

interface FullNameProps {
  id: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  firstNameValue?: string;
  lastNameValue?: string;
  onFirstNameChange?: (value: string) => void;
  onLastNameChange?: (value: string) => void;
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
  theme?: {
    label?: string;
    input?: string;
  } | null;
}

export function FullName({
  id,
  required = false,
  disabled = false,
  readonly = false,
  firstNameValue = '',
  lastNameValue = '',
  onFirstNameChange,
  onLastNameChange,
  firstNamePlaceholder = "First Name",
  lastNamePlaceholder = "Last Name",
  theme
}: FullNameProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <label 
          htmlFor={`${id}-first`} 
          className={theme?.label || 'text-sm font-medium text-gray-700'}
        >
          First Name {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={`${id}-first`}
          type="text"
          placeholder={firstNamePlaceholder}
          value={firstNameValue}
          onChange={(e) => onFirstNameChange?.(e.target.value)}
          required={required}
          disabled={disabled}
          readOnly={readonly}
          className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
        />
      </div>
      <div className="space-y-2">
        <label 
          htmlFor={`${id}-last`} 
          className={theme?.label || 'text-sm font-medium text-gray-700'}
        >
          Last Name {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={`${id}-last`}
          type="text"
          placeholder={lastNamePlaceholder}
          value={lastNameValue}
          onChange={(e) => onLastNameChange?.(e.target.value)}
          required={required}
          disabled={disabled}
          readOnly={readonly}
          className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
        />
      </div>
    </div>
  );
}