import { FormElement, ValidationRules, ElementStyling } from '@/types/form-builder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Fragment, useState, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { validateFieldName, normalizeFieldName } from '@/hooks/use-form-builder';

interface PropertiesPanelProps {
  selectedElement: FormElement | null;
  onUpdateElement: (id: string, updates: Partial<FormElement>) => void;
  onDeselectElement: () => void;
}

export function PropertiesPanel({
  selectedElement,
  onUpdateElement,
  onDeselectElement,
}: PropertiesPanelProps) {
  if (!selectedElement) {
    return (
      <aside className="w-80 lg:w-80 bg-gradient-to-b from-white to-slate-50/50 border-l border-slate-200/60 shadow-sm relative z-10 h-full flex flex-col">
        <div className="p-4 lg:p-6 flex-1 overflow-y-auto">
          <div className="text-center py-12 lg:py-20">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl lg:rounded-2xl flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-sm">
              <svg className="w-6 h-6 lg:w-8 lg:h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
              </svg>
            </div>
            <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-2 lg:mb-3">Properties Panel</h3>
            <p className="text-sm lg:text-base text-slate-600 leading-relaxed mb-4 lg:mb-6 px-4">Select any form element to customize its properties, validation rules, and styling options.</p>
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg lg:rounded-xl p-3 lg:p-4">
              <div className="text-xs text-blue-600 font-medium mb-1">💡 Quick tip</div>
              <div className="text-xs text-blue-700">
                Click on any form element to start editing
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const handleUpdate = (field: keyof FormElement, value: any) => {
    onUpdateElement(selectedElement.id, { [field]: value });
  };

  const handleValidationUpdate = (field: keyof ValidationRules, value: any) => {
    const validation = { ...selectedElement.validation, [field]: value };
    onUpdateElement(selectedElement.id, { validation });
  };

  const handleStylingUpdate = (field: keyof ElementStyling, value: any) => {
    const currentStyling = selectedElement.styling || { width: 'full', size: 'medium' };
    const styling = { ...currentStyling, [field]: value };
    onUpdateElement(selectedElement.id, { styling });
  };

  const handleOptionsUpdate = (options: string[]) => {
    onUpdateElement(selectedElement.id, { options });
  };

  return (
    <aside className="w-80 lg:w-80 bg-gradient-to-b from-white to-slate-50/30 border-l border-slate-200/60 shadow-sm relative z-10 h-full flex flex-col">
      <div className="p-4 lg:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <div>
            <h2 className="text-base lg:text-lg font-bold text-slate-800">Element Properties</h2>
            <p className="text-xs text-slate-500 mt-0.5">Customize your form element</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselectElement}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors p-1 lg:p-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </Button>
        </div>

        {/* Element Type Badge */}
        <div className="mb-6 lg:mb-8">
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200/50 rounded-lg lg:rounded-xl p-3 lg:p-4">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div>
                <div className="text-sm font-bold text-slate-800 capitalize">
                  {selectedElement.type.replace('-', ' ')}
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  Form Element
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Properties */}
        <div className="space-y-4 mb-8">
          <div>
            <Label htmlFor="label" className="text-sm font-medium text-neutral-700 mb-2">
              Label
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                id="label"
                value={selectedElement.label}
                onChange={(e) => handleUpdate('label', e.target.value)}
                className="focus:ring-2 focus:ring-blue-500 flex-1"
              />
              <LanguageSelector
                currentTranslations={selectedElement.labelTranslations || {}}
                onTranslationsUpdate={(translations) => handleUpdate('labelTranslations', translations)}
                originalLabel={selectedElement.label}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="placeholder" className="text-sm font-medium text-neutral-700 mb-2">
              Placeholder
            </Label>
            <Input
              id="placeholder"
              value={selectedElement.placeholder || ''}
              onChange={(e) => handleUpdate('placeholder', e.target.value)}
              className="focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label htmlFor="helpText" className="text-sm font-medium text-neutral-700 mb-2">
              Help Text
            </Label>
            <Input
              id="helpText"
              value={selectedElement.helpText || ''}
              onChange={(e) => handleUpdate('helpText', e.target.value)}
              className="focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label htmlFor="name" className="text-sm font-medium text-neutral-700 mb-2">
              Field Name
            </Label>
            <Input
              id="name"
              value={selectedElement.name}
              onChange={(e) => {
                // Only allow lowercase letters, numbers, and hyphens
                const filteredValue = e.target.value.replace(/[^a-z0-9-]/g, '');
                handleUpdate('name', filteredValue);
              }}
              className={`focus:ring-2 ${
                validateFieldName(selectedElement.name) 
                  ? 'focus:ring-blue-500 border-gray-300' 
                  : 'focus:ring-red-500 border-red-300'
              }`}
              placeholder="field-name"
            />
            <div className="mt-1 space-y-1">
              {!validateFieldName(selectedElement.name) && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Must start with a letter and contain only a-z, 0-9, and hyphens (-)
                </p>
              )}
              <p className="text-xs text-neutral-500">
                Only lowercase letters (a-z), numbers (0-9), and hyphens (-) can be typed
              </p>
            </div>
          </div>

          {/* Image-specific properties */}
          {selectedElement.type === 'image' && (
            <>
              <div>
                <Label htmlFor="src" className="text-sm font-medium text-neutral-700 mb-2">
                  Image URL
                </Label>
                <Input
                  id="src"
                  value={selectedElement.src || ''}
                  onChange={(e) => handleUpdate('src', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Enter a valid image URL (jpg, png, gif, webp)
                </p>
              </div>

              <div>
                <Label htmlFor="alt" className="text-sm font-medium text-neutral-700 mb-2">
                  Alt Text
                </Label>
                <Input
                  id="alt"
                  value={selectedElement.alt || ''}
                  onChange={(e) => handleUpdate('alt', e.target.value)}
                  placeholder="Describe the image..."
                  className="focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Describe the image for accessibility
                </p>
              </div>
            </>
          )}
        </div>

        {/* Options for select, radio, checkbox */}
        {(selectedElement.type === 'select' || selectedElement.type === 'radio' || selectedElement.type === 'checkbox') && (
          <div className="mb-8">
            <Label className="text-sm font-medium text-neutral-700 mb-2">Options</Label>
            <div className="space-y-2">
              {selectedElement.options?.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(selectedElement.options || [])];
                      newOptions[index] = e.target.value;
                      handleOptionsUpdate(newOptions);
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newOptions = selectedElement.options?.filter((_, i) => i !== index) || [];
                      handleOptionsUpdate(newOptions);
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newOptions = [...(selectedElement.options || []), `Option ${(selectedElement.options?.length || 0) + 1}`];
                  handleOptionsUpdate(newOptions);
                }}
                className="w-full"
              >
                <i className="fas fa-plus mr-2"></i>Add Option
              </Button>
            </div>
          </div>
        )}

        {/* Validation Rules */}
        <div className="mb-8">
            <h3 className="text-sm font-medium text-neutral-700 mb-4">Validation Rules</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <Checkbox
                  checked={selectedElement.required}
                  onCheckedChange={(checked) => handleUpdate('required', checked)}
                />
                <span className="ml-2 text-sm text-neutral-700">Required field</span>
              </label>
              
              {(selectedElement.type === 'text-input' || selectedElement.type === 'textarea') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-neutral-600 mb-1">Min Length</Label>
                    <Input
                      type="number"
                      value={selectedElement.validation?.minLength || ''}
                      onChange={(e) => handleValidationUpdate('minLength', parseInt(e.target.value) || undefined)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-neutral-600 mb-1">Max Length</Label>
                    <Input
                      type="number"
                      value={selectedElement.validation?.maxLength || ''}
                      onChange={(e) => handleValidationUpdate('maxLength', parseInt(e.target.value) || undefined)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {selectedElement.type === 'number-input' && (
                <>
                  <div>
                    <Label className="text-xs font-medium text-neutral-600 mb-1">Input Type</Label>
                    <Select 
                      value={selectedElement.numberVariant || 'number'}
                      onValueChange={(value) => handleUpdate('numberVariant', value)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number (Default)</SelectItem>
                        <SelectItem value="phone">Phone Number</SelectItem>
                        <SelectItem value="country-phone">International Phone</SelectItem>
                        <SelectItem value="currency">Currency ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedElement.numberVariant === 'number' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium text-neutral-600 mb-1">Min Value</Label>
                        <Input
                          type="number"
                          value={selectedElement.validation?.min || ''}
                          onChange={(e) => handleValidationUpdate('min', parseInt(e.target.value) || undefined)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-neutral-600 mb-1">Max Value</Label>
                        <Input
                          type="number"
                          value={selectedElement.validation?.max || ''}
                          onChange={(e) => handleValidationUpdate('max', parseInt(e.target.value) || undefined)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedElement.type === 'rate-scale' && (
                <>
                  <div>
                    <Label className="text-xs font-medium text-neutral-600 mb-1">Display Style</Label>
                    <Select 
                      value={selectedElement.rateVariant || 'numbers'}
                      onValueChange={(value) => handleUpdate('rateVariant', value)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="numbers">Numbers (1, 2, 3...)</SelectItem>
                        <SelectItem value="stars">Stars (⭐⭐⭐...)</SelectItem>
                        <SelectItem value="faces">Happy Faces (😢😐😊...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-neutral-600 mb-1">Min Rating</Label>
                      <Input
                        type="number"
                        value={selectedElement.validation?.min || 1}
                        onChange={(e) => handleValidationUpdate('min', parseInt(e.target.value) || 1)}
                        className="text-sm"
                        min="1"
                        max="10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-neutral-600 mb-1">Max Rating</Label>
                      <Input
                        type="number"
                        value={selectedElement.validation?.max || 10}
                        onChange={(e) => handleValidationUpdate('max', parseInt(e.target.value) || 10)}
                        className="text-sm"
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedElement.type === 'boolean-switch' && (
                <div>
                  <Label className="text-xs font-medium text-neutral-600 mb-1">Display Style</Label>
                  <Select 
                    value={selectedElement.booleanVariant || 'yes-no'}
                    onValueChange={(value) => handleUpdate('booleanVariant', value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes-no">Yes / No</SelectItem>
                      <SelectItem value="true-false">True / False</SelectItem>
                      <SelectItem value="on-off">On / Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedElement.type === 'datetime-picker' && (
                <div>
                  <Label className="text-xs font-medium text-neutral-600 mb-1">Input Type</Label>
                  <Listbox 
                    value={selectedElement.dateTimeVariant || 'date-only'}
                    onChange={(value) => {
                      console.log('DateTime variant changing to:', value);
                      handleUpdate('dateTimeVariant', value);
                    }}
                  >
                    <div className="relative">
                      <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                        <span className="block truncate">
                          {selectedElement.dateTimeVariant === 'date-only' || !selectedElement.dateTimeVariant ? '📅 Date Only' :
                           selectedElement.dateTimeVariant === 'time-only' ? '🕐 Time Only' :
                           '📅🕐 Date & Time'}
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon
                            className="h-4 w-4 text-gray-400"
                            aria-hidden="true"
                          />
                        </span>
                      </Listbox.Button>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          <Listbox.Option
                            value="date-only"
                            className={({ active }) =>
                              `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                              }`
                            }
                          >
                            {({ selected }) => (
                              <>
                                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                  📅 Date Only
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                    <CheckIcon className="h-4 w-4" aria-hidden="true" />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                          <Listbox.Option
                            value="time-only"
                            className={({ active }) =>
                              `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                              }`
                            }
                          >
                            {({ selected }) => (
                              <>
                                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                  🕐 Time Only
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                    <CheckIcon className="h-4 w-4" aria-hidden="true" />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                          <Listbox.Option
                            value="datetime"
                            className={({ active }) =>
                              `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                              }`
                            }
                          >
                            {({ selected }) => (
                              <>
                                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                  📅🕐 Date & Time
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                    <CheckIcon className="h-4 w-4" aria-hidden="true" />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                        </Listbox.Options>
                      </Transition>
                    </div>
                  </Listbox>
                  <p className="text-xs text-neutral-500 mt-1">
                    {(selectedElement.dateTimeVariant === 'date-only' || !selectedElement.dateTimeVariant) && 'Users will select a date only'}
                    {selectedElement.dateTimeVariant === 'time-only' && 'Users will select a time only'}
                    {selectedElement.dateTimeVariant === 'datetime' && 'Users will select both date and time'}
                  </p>
                </div>
              )}
            </div>
        </div>

        

        {/* Advanced Settings */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-neutral-700 mb-4">Advanced</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <Checkbox
                checked={selectedElement.disabled || false}
                onCheckedChange={(checked) => handleUpdate('disabled', checked)}
              />
              <span className="ml-2 text-sm text-neutral-700">Disabled</span>
            </label>
            
            <label className="flex items-center">
              <Checkbox
                checked={selectedElement.readonly || false}
                onCheckedChange={(checked) => handleUpdate('readonly', checked)}
              />
              <span className="ml-2 text-sm text-neutral-700">Read only</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-neutral-200">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            onClick={onDeselectElement}
          >
            Done Editing
          </Button>
        </div>
      </div>
    </aside>
  );
}
