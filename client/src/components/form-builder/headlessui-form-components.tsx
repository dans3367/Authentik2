import React from 'react';
import { Switch, RadioGroup, Checkbox, Listbox, Transition } from '@headlessui/react';
// Swapped from @heroicons/react to lucide-react so the build only ships
// one icon set. Mapping: ChevronUpDownIcon → ChevronsUpDown, CheckIcon → Check.
import { ChevronsUpDown as ChevronUpDownIcon, Check as CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormTheme } from '@/types/form-builder';

// Helper functions for theme-specific radio button styling
const getRadioThemeChecked = (baseInput: string) => {
  if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
    return 'border-yellow-400 bg-yellow-400';
  } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
    return 'border-orange-500 bg-orange-500';
  } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
    return 'border-purple-500 bg-purple-500';
  } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
    return 'border-emerald-600 bg-emerald-600';
  } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
    return 'border-cyan-400 bg-cyan-400';
  } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
    return 'border-yellow-400 bg-yellow-400';
  } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
    return 'border-purple-500 bg-purple-500';
  } else if (baseInput.includes('uppercase') && baseInput.includes('tracking-wider')) {
    return 'border-blue-600 bg-blue-600';
  } else if (baseInput.includes('border-purple-500/40')) {
    // Cosmic theme
    return 'border-purple-400 bg-gradient-to-r from-purple-500 to-pink-500';
  } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
    // Brutalist theme
    return 'border-black bg-black';
  } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
    // Pastel Dream theme
    return 'border-purple-400 bg-gradient-to-r from-purple-400 to-pink-400';
  } else {
    return 'border-blue-500 bg-blue-500';
  }
};

const getRadioThemeUnchecked = (baseInput: string) => {
  if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
    return 'border-gray-600 bg-gray-800';
  } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
    return 'border-orange-400 bg-yellow-50';
  } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
    return 'border-pink-300 bg-pink-50';
  } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
    return 'border-green-300 bg-white';
  } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
    return 'border-cyan-400 bg-gray-900';
  } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
    return 'border-purple-600 bg-purple-800';
  } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
    return 'border-gray-200 bg-white';
  } else if (baseInput.includes('focus:ring-1') && baseInput.includes('focus:ring-blue-500')) {
    return 'border-gray-300 bg-white';
  } else if (baseInput.includes('border-purple-500/40')) {
    // Cosmic theme
    return 'border-purple-500/40 bg-black/40';
  } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
    // Brutalist theme
    return 'border-black bg-white';
  } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
    // Pastel Dream theme
    return 'border-purple-200 bg-white/70';
  } else {
    return 'border-gray-300 bg-gray-50';
  }
};

const getRadioIndicatorColor = (baseInput: string) => {
  if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
    return 'bg-gray-800';
  } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
    return 'bg-yellow-50';
  } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
    return 'bg-pink-50';
  } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
    return 'bg-white';
  } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
    return 'bg-gray-900';
  } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
    return 'bg-purple-800';
  } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
    return 'bg-white';
  } else if (baseInput.includes('focus:ring-1') && baseInput.includes('focus:ring-blue-500')) {
    return 'bg-white';
  } else if (baseInput.includes('border-purple-500/40')) {
    // Cosmic theme
    return 'bg-cyan-300';
  } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
    // Brutalist theme
    return 'bg-white';
  } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
    // Pastel Dream theme
    return 'bg-white';
  } else {
    return 'bg-gray-50';
  }
};

const getRadioLabelStyle = (baseInput: string) => {
  if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
    return 'text-gray-300 font-medium tracking-widest uppercase cursor-pointer select-none';
  } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
    return 'text-pink-600 font-black tracking-wider uppercase cursor-pointer select-none transform skew-x-6';
  } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
    return 'text-purple-700 font-bold cursor-pointer select-none';
  } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
    return 'text-emerald-700 font-semibold tracking-wide cursor-pointer select-none';
  } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
    return 'text-green-400 font-bold tracking-wider uppercase cursor-pointer select-none';
  } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
    return 'text-yellow-300 font-medium tracking-widest uppercase font-serif cursor-pointer select-none';
  } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
    return 'text-gray-800 font-semibold cursor-pointer select-none';
  } else if (baseInput.includes('focus:ring-1') && baseInput.includes('focus:ring-blue-500')) {
    return 'text-gray-700 font-medium cursor-pointer select-none';
  } else if (baseInput.includes('border-purple-500/40')) {
    // Cosmic theme
    return 'text-purple-200 font-medium tracking-wide cursor-pointer select-none';
  } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
    // Brutalist theme
    return 'text-black font-black uppercase tracking-wider cursor-pointer select-none';
  } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
    // Pastel Dream theme
    return 'text-purple-700 font-medium cursor-pointer select-none';
  } else {
    return 'text-gray-700 font-medium tracking-wide cursor-pointer select-none';
  }
};

// Helper functions for checkbox styling
const getCheckboxThemeChecked = (baseInput: string) => {
  if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
    return 'border-yellow-400 bg-yellow-400';
  } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
    return 'border-orange-500 bg-orange-500';
  } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
    return 'border-purple-500 bg-purple-500 rounded-xl';
  } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
    return 'border-emerald-600 bg-emerald-600 rounded-lg';
  } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
    return 'border-cyan-400 bg-cyan-400';
  } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
    return 'border-yellow-400 bg-yellow-400';
  } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
    return 'border-purple-500 bg-purple-500 rounded-md';
  } else if (baseInput.includes('focus:ring-1') && baseInput.includes('focus:ring-blue-500')) {
    return 'border-blue-600 bg-blue-600';
  } else if (baseInput.includes('border-purple-500/40')) {
    // Cosmic theme
    return 'border-purple-400 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg';
  } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
    // Brutalist theme
    return 'border-black bg-black';
  } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
    // Pastel Dream theme
    return 'border-purple-400 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl';
  } else {
    return 'border-blue-500 bg-blue-500';
  }
};

const getCheckboxThemeUnchecked = (baseInput: string) => {
  if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
    return 'border-gray-600 bg-gray-800';
  } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
    return 'border-orange-400 bg-yellow-50 rounded-none';
  } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
    return 'border-pink-300 bg-pink-50 rounded-xl';
  } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
    return 'border-green-300 bg-white rounded-lg';
  } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
    return 'border-cyan-400 bg-gray-900';
  } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
    return 'border-purple-600 bg-purple-800';
  } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
    return 'border-gray-200 bg-white rounded-md';
  } else if (baseInput.includes('focus:ring-1') && baseInput.includes('focus:ring-blue-500')) {
    return 'border-gray-300 bg-white';
  } else if (baseInput.includes('border-purple-500/40')) {
    // Cosmic theme
    return 'border-purple-500/40 bg-black/40 rounded-lg';
  } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
    // Brutalist theme
    return 'border-black bg-white';
  } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
    // Pastel Dream theme
    return 'border-purple-200 bg-white/70 rounded-xl';
  } else {
    return 'border-gray-300 bg-gray-50';
  }
};

const getCheckboxLabelStyle = (baseInput: string) => {
  return getRadioLabelStyle(baseInput); // Same as radio labels
};

// HeadlessUI Boolean Switch Component
interface HeadlessUIBooleanSwitchProps {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  className?: string;
  variant?: "yes-no" | "true-false" | "on-off";
  showLabels?: boolean;
  themeStyles?: FormTheme['styles'];
}

export function HeadlessUIBooleanSwitch({
  value = false,
  onValueChange,
  disabled = false,
  name,
  required = false,
  className,
  variant = "yes-no",
  showLabels = true,
  themeStyles,
}: HeadlessUIBooleanSwitchProps) {
  const [enabled, setEnabled] = React.useState(value);

  React.useEffect(() => {
    setEnabled(value);
  }, [value]);

  const handleChange = (newValue: boolean) => {
    if (disabled) return;
    setEnabled(newValue);
    onValueChange?.(newValue);
  };

  const getLabels = () => {
    switch (variant) {
      case "true-false":
        return { positive: "True", negative: "False" };
      case "on-off":
        return { positive: "On", negative: "Off" };
      case "yes-no":
      default:
        return { positive: "Yes", negative: "No" };
    }
  };

  const labels = getLabels();

  // Use the actual theme's booleanSwitch styles
  const booleanSwitchStyles = themeStyles?.booleanSwitch || {
    track: 'bg-gray-200',
    thumb: 'bg-white',
    activeLabel: 'text-gray-700 font-medium',
    inactiveLabel: 'text-gray-400 font-medium'
  };

  // Extract and apply proper theme-specific track styling
  const getTrackStyle = () => {
    const trackClass = booleanSwitchStyles.track;
    let resultClasses = [];
    
    // Extract base border classes that should always apply
    const borderClasses = trackClass.match(/border-\d+|border-2|border-3|border-4/g) || [];
    resultClasses.push(...borderClasses);
    
    if (enabled) {
      // Extract checked state styling (background and border)
      const checkedBgMatch = trackClass.match(/data-\[state=checked\]:(bg-[^\s]+(?:\s+[^\s]*)*)/);
      if (checkedBgMatch) {
        resultClasses.push(checkedBgMatch[1]);
      }
      
      const checkedBorderMatch = trackClass.match(/data-\[state=checked\]:(border-[^\s]+)/);
      if (checkedBorderMatch) {
        resultClasses.push(checkedBorderMatch[1]);
      }
    } else {
      // Extract unchecked state styling (background and border)
      const uncheckedBgMatch = trackClass.match(/data-\[state=unchecked\]:(bg-[^\s]+)/);
      if (uncheckedBgMatch) {
        resultClasses.push(uncheckedBgMatch[1]);
      }
      
      const uncheckedBorderMatch = trackClass.match(/data-\[state=unchecked\]:(border-[^\s]+)/);
      if (uncheckedBorderMatch) {
        resultClasses.push(uncheckedBorderMatch[1]);
      }
    }
    
    return resultClasses.join(' ');
  };

  // Extract and apply proper theme-specific thumb styling
  const getThumbStyle = () => {
    const thumbClass = booleanSwitchStyles.thumb;
    let resultClasses = [];
    
    // Extract base classes (shadow, etc.) that should always apply
    const baseClasses = thumbClass.match(/shadow-[^\s]+|rounded-[^\s]+/g) || [];
    resultClasses.push(...baseClasses);
    
    if (enabled) {
      // Extract checked state thumb styling
      const checkedThumbMatch = thumbClass.match(/data-\[state=checked\]:(bg-[^\s]+)/);
      if (checkedThumbMatch) {
        resultClasses.push(checkedThumbMatch[1]);
      }
    } else {
      // Extract unchecked state thumb styling
      const uncheckedThumbMatch = thumbClass.match(/data-\[state=unchecked\]:(bg-[^\s]+)/);
      if (uncheckedThumbMatch) {
        resultClasses.push(uncheckedThumbMatch[1]);
      }
    }
    
    return resultClasses.join(' ');
  };

  return (
    <div className={cn("inline-flex items-center justify-center gap-3", className)}>
      {showLabels && (
        <span 
          className={cn(
            "text-sm transition-colors cursor-pointer select-none whitespace-nowrap",
            !enabled ? booleanSwitchStyles.activeLabel : booleanSwitchStyles.inactiveLabel
          )}
          onClick={() => handleChange(false)}
        >
          {labels.negative}
        </span>
      )}
      
      <Switch
        checked={enabled}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
          // Ensure there's always a border for visibility
          getTrackStyle() || "border-2 border-gray-300",
          getTrackStyle(),
          // Handle special shape cases per theme
          booleanSwitchStyles.track.includes('rounded-none') ? "rounded-none" : "rounded-full"
        )}
        style={{
          width: '44px',
          height: '24px',
          minWidth: '44px'
        }}
      >
        <span
          className={cn(
            "pointer-events-none inline-block transform transition-transform duration-200",
            getThumbStyle(),
            // Always make thumb circular unless theme specifically overrides
            booleanSwitchStyles.thumb.includes('rounded-none') ? "" : "rounded-full",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )}
          style={{
            width: '16px',
            height: '16px'
          }}
        />
      </Switch>
      
      {showLabels && (
        <span 
          className={cn(
            "text-sm transition-colors cursor-pointer select-none whitespace-nowrap",
            enabled ? booleanSwitchStyles.activeLabel : booleanSwitchStyles.inactiveLabel
          )}
          onClick={() => handleChange(true)}
        >
          {labels.positive}
        </span>
      )}

      {name && (
        <input
          type="hidden"
          name={name}
          value={enabled ? "true" : "false"}
          required={required}
        />
      )}
    </div>
  );
}

// HeadlessUI Radio Group Component
interface HeadlessUIRadioGroupProps {
  name: string;
  options: string[];
  themeStyles: FormTheme['styles'];
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export function HeadlessUIRadioGroup({
  name,
  options,
  themeStyles,
  defaultValue,
  onChange
}: HeadlessUIRadioGroupProps) {
  const [selected, setSelected] = React.useState(defaultValue || '');

  const handleChange = (value: string) => {
    setSelected(value);
    onChange?.(value);
  };



  return (
    <RadioGroup value={selected} onChange={handleChange} className="space-y-3">
      {options.map((option) => (
        <RadioGroup.Option
          key={option}
          value={option}
          className="flex items-center space-x-3 group cursor-pointer"
        >
          {({ checked }) => (
            <>
              <div className="relative">
                <div 
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-all duration-200",
                    checked 
                      ? getRadioThemeChecked(themeStyles.input)
                      : getRadioThemeUnchecked(themeStyles.input)
                  )} 
                />
                {checked && (
                  <div 
                    className={cn(
                      "absolute w-2 h-2 rounded-full",
                      getRadioIndicatorColor(themeStyles.input)
                    )}
                    style={{ 
                      top: '50%', 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)' 
                    }}
                  />
                )}
              </div>
              <span className={cn(getRadioLabelStyle(themeStyles.input))}>
                {option}
              </span>
              {checked && (
                <input
                  type="hidden"
                  name={name}
                  value={option}
                />
              )}
            </>
          )}
        </RadioGroup.Option>
      ))}
    </RadioGroup>
  );
}

// HeadlessUI Checkbox Component
interface HeadlessUICheckboxProps {
  name: string;
  value: string;
  label: string;
  themeStyles: FormTheme['styles'];
  defaultChecked?: boolean;
  onChange?: (checked: boolean, value: string) => void;
}

export function HeadlessUICheckbox({
  name,
  value,
  label,
  themeStyles,
  defaultChecked = false,
  onChange
}: HeadlessUICheckboxProps) {
  const [checked, setChecked] = React.useState(defaultChecked);

  const handleChange = (newChecked: boolean) => {
    setChecked(newChecked);
    onChange?.(newChecked, value);
  };

  return (
    <Checkbox
      checked={checked}
      onChange={handleChange}
      className="flex items-center space-x-3 group cursor-pointer"
    >
      {({ checked }) => (
        <>
          <div className="relative">
            <div 
              className={cn(
                "w-5 h-5 border-2 transition-all duration-200",
                checked 
                  ? getCheckboxThemeChecked(themeStyles.input)
                  : getCheckboxThemeUnchecked(themeStyles.input)
              )} 
            />
            {checked && (
              <svg 
                className="absolute inset-0 w-full h-full text-white" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                  clipRule="evenodd" 
                />
              </svg>
            )}
          </div>
          <span className={cn(getCheckboxLabelStyle(themeStyles.input))}>
            {label}
          </span>
          {checked && (
            <input
              type="hidden"
              name={name}
              value={value}
            />
          )}
        </>
      )}
    </Checkbox>
  );
}

// DateTime Picker Component
interface HeadlessUIDateTimePickerProps {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  variant?: 'date-only' | 'time-only' | 'datetime';
  themeStyles: FormTheme['styles'];
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function HeadlessUIDateTimePicker({
  label,
  name,
  required = false,
  disabled = false,
  variant = 'date-only',
  themeStyles,
  onChange,
  placeholder,
  className
}: HeadlessUIDateTimePickerProps) {
  const [value, setValue] = React.useState('');

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange?.(newValue);
  };

  const getInputType = () => {
    switch (variant) {
      case 'date-only':
        return 'date';
      case 'time-only':
        return 'time';
      case 'datetime':
        return 'datetime-local';
      default:
        return 'datetime-local';
    }
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    switch (variant) {
      case 'date-only':
        return 'Select date...';
      case 'time-only':
        return 'Select time...';
      case 'datetime':
        return 'Select date and time...';
      default:
        return 'Select date and time...';
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className={cn(themeStyles.label)}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={getInputType()}
        name={name}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={getPlaceholder()}
        className={cn(
          themeStyles.input,
          "w-full",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
    </div>
  );
}

// HeadlessUI Select Component with theme-aware styling
interface HeadlessUISelectProps {
  name: string;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  themeStyles: FormTheme['styles'];
  onChange?: (value: string) => void;
  className?: string;
}

export function HeadlessUISelect({
  name,
  options,
  placeholder = 'Select an option...',
  required = false,
  disabled = false,
  themeStyles,
  onChange,
  className
}: HeadlessUISelectProps) {
  const [selected, setSelected] = React.useState('');

  const handleChange = (value: string) => {
    setSelected(value);
    onChange?.(value);
  };

  // Get theme-specific select styling
  const getSelectThemeStyles = () => {
    const baseInput = themeStyles.input;
    
    // Theme-specific customizations for select
    if (baseInput.includes('bg-gray-900') || baseInput.includes('bg-gray-800')) {
      // Elegant theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-gray-800 border border-gray-600 rounded-lg shadow-2xl',
        option: 'text-white hover:bg-gray-700 focus:bg-gray-700',
        activeOption: 'bg-yellow-400 text-gray-900',
        text: 'text-white'
      };
    } else if (baseInput.includes('border-3') || baseInput.includes('font-mono')) {
      // Retro theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-yellow-50 border-3 border-orange-400 rounded-none shadow-2xl',
        option: 'text-black hover:bg-orange-100 focus:bg-orange-100 font-mono',
        activeOption: 'bg-orange-500 text-white',
        text: 'text-black font-mono'
      };
    } else if (baseInput.includes('rounded-3xl') || baseInput.includes('border-4')) {
      // Playful theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white border-3 border-pink-300 rounded-2xl shadow-2xl',
        option: 'text-purple-700 hover:bg-pink-50 focus:bg-pink-50',
        activeOption: 'bg-purple-600 text-white',
        text: 'text-purple-700'
      };
    } else if (baseInput.includes('rounded-2xl') && baseInput.includes('green')) {
      // Nature theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white/90 backdrop-blur-sm border-2 border-green-300 rounded-2xl shadow-2xl',
        option: 'text-emerald-700 hover:bg-green-50 focus:bg-green-50',
        activeOption: 'bg-emerald-600 text-white',
        text: 'text-emerald-700'
      };
    } else if (baseInput.includes('bg-black') || baseInput.includes('border-cyan')) {
      // Neon theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-gray-900 border-2 border-cyan-400 rounded-lg shadow-2xl shadow-cyan-400/30',
        option: 'text-cyan-100 hover:bg-gray-800 focus:bg-gray-800',
        activeOption: 'bg-cyan-400 text-black',
        text: 'text-cyan-100'
      };
    } else if (baseInput.includes('bg-purple-800') || baseInput.includes('font-serif')) {
      // Luxury theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-purple-800/90 backdrop-blur-sm border border-purple-600 rounded-lg shadow-2xl',
        option: 'text-white hover:bg-purple-700 focus:bg-purple-700 font-serif',
        activeOption: 'bg-yellow-400 text-purple-900',
        text: 'text-white font-serif'
      };
    } else if (baseInput.includes('rounded-xl') && baseInput.includes('backdrop-blur')) {
      // Modern theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white/90 backdrop-blur-xl border border-gray-200 rounded-xl shadow-2xl',
        option: 'text-gray-800 hover:bg-gray-50 focus:bg-gray-50',
        activeOption: 'bg-purple-500 text-white',
        text: 'text-gray-800'
      };
    } else if (baseInput.includes('focus:ring-1') && baseInput.includes('focus:ring-blue-500')) {
      // Professional theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white border border-gray-200 rounded-md shadow-sm',
        option: 'text-gray-700 hover:bg-gray-50 focus:bg-gray-50 font-medium',
        activeOption: 'bg-blue-600 text-white',
        text: 'text-gray-700 font-medium'
      };
    } else if (baseInput.includes('border-purple-500/40')) {
      // Cosmic theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-black/90 backdrop-blur-xl border border-purple-500/40 rounded-lg shadow-2xl shadow-purple-500/20',
        option: 'text-purple-200 hover:bg-purple-900/40 focus:bg-purple-900/40',
        activeOption: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
        text: 'text-purple-200'
      };
    } else if (baseInput.includes('border-4') && baseInput.includes('border-black')) {
      // Brutalist theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white border-4 border-black shadow-[4px_4px_0_0_#000000]',
        option: 'text-black hover:bg-gray-100 focus:bg-gray-100 font-black uppercase',
        activeOption: 'bg-black text-white',
        text: 'text-black font-black'
      };
    } else if (baseInput.includes('border-purple-200') && baseInput.includes('rounded-2xl')) {
      // Pastel Dream theme
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white/90 backdrop-blur-lg border-2 border-purple-200 rounded-2xl shadow-xl',
        option: 'text-purple-700 hover:bg-purple-50 focus:bg-purple-50',
        activeOption: 'bg-gradient-to-r from-purple-400 to-pink-400 text-white',
        text: 'text-purple-700'
      };
    } else {
      // Minimal theme (default)
      return {
        button: `${baseInput} justify-between text-left`,
        dropdown: 'bg-white border border-gray-300 rounded-lg shadow-lg',
        option: 'text-gray-700 hover:bg-gray-50 focus:bg-gray-50',
        activeOption: 'bg-blue-500 text-white',
        text: 'text-gray-700'
      };
    }
  };

  const styles = getSelectThemeStyles();

  return (
    <div className={cn("relative", className)}>
      <Listbox value={selected} onChange={handleChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            className={cn(
              styles.button,
              "relative w-full cursor-default py-3 pl-4 pr-10 text-left focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className={cn("block truncate", styles.text)}>
              {selected || placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Transition
            as={React.Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className={cn(
              "absolute mt-1 max-h-60 w-full overflow-auto py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10",
              styles.dropdown
            )}>
              {options.map((option, optionIdx) => (
                <Listbox.Option
                  key={optionIdx}
                  className={({ active, selected: isSelected }) =>
                    cn(
                      "relative cursor-default select-none py-2 pl-10 pr-4",
                      active || isSelected ? styles.activeOption : styles.option
                    )
                  }
                  value={option}
                >
                  {({ selected: isSelected }) => (
                    <>
                      <span className={cn("block truncate", isSelected ? "font-medium" : "font-normal")}>
                        {option}
                      </span>
                      {isSelected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selected} />
    </div>
  );
}