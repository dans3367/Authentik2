import { useState, useCallback } from 'react';
import { FormElement, FormElementType, FormBuilderState, FormSettings } from '@/types/form-builder';
import { nanoid } from 'nanoid';

const defaultSettings: FormSettings = {
  actionUrl: '/api/submit-form',
  method: 'POST',
};

export function useFormBuilder(initialTitle?: string, initialElements?: FormElement[]) {
  const [state, setState] = useState<FormBuilderState>({
    formTitle: initialTitle || 'Untitled Form',
    elements: initialElements || [],
    selectedElementId: null,
    settings: defaultSettings,
    previewMode: false,
  });

  const [formSettings, setFormSettings] = useState({
    description: '',
    showProgressBar: false,
    allowSaveProgress: false,
    showFormTitle: true,
  });

  const [formTags, setFormTags] = useState<string[]>([]);

  const addElement = useCallback((type: FormElementType, index?: number) => {
    const newElement: FormElement = {
      id: nanoid(),
      type,
      label: getDefaultLabel(type),
      labelTranslations: {},
      placeholder: getDefaultPlaceholder(type),
      helpText: '',
      name: generateFieldName(type),
      required: false,
      validation: {},
      styling: {
        width: 'full',
        size: 'medium',
      },
      options: type === 'select' || type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : undefined,
      rateVariant: type === 'rate-scale' ? 'numbers' : undefined,
      booleanVariant: type === 'boolean-switch' ? 'yes-no' : undefined,
      dateTimeVariant: type === 'datetime-picker' ? 'date-only' : undefined,
      numberVariant: type === 'number-input' ? 'number' : undefined,
    };

    setState(prev => {
      let insertIndex: number;
      
      if (index !== undefined) {
        // Use provided index
        insertIndex = index;
      } else if (prev.selectedElementId) {
        // Insert after currently selected element
        const selectedIndex = prev.elements.findIndex(el => el.id === prev.selectedElementId);
        insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : prev.elements.length;
      } else {
        // No selection, add to end
        insertIndex = prev.elements.length;
      }

      return {
        ...prev,
        elements: [
          ...prev.elements.slice(0, insertIndex),
          newElement,
          ...prev.elements.slice(insertIndex)
        ],
        selectedElementId: newElement.id,
      };
    });
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<FormElement>) => {
    // For field names, don't normalize during typing - let users type freely
    setState(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === id ? { ...el, ...updates } : el
      ),
    }));
  }, []);

  const removeElement = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
      selectedElementId: prev.selectedElementId === id ? null : prev.selectedElementId,
    }));
  }, []);

  const moveElement = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const elements = [...prev.elements];
      const [movedElement] = elements.splice(fromIndex, 1);
      elements.splice(toIndex, 0, movedElement);
      
      // Keep the moved element selected to maintain high z-index
      return { 
        ...prev, 
        elements,
        selectedElementId: movedElement.id
      };
    });
  }, []);

  const selectElement = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedElementId: id }));
  }, []);

  const updateFormTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, formTitle: title }));
  }, []);

  const updateSettings = useCallback((settings: Partial<FormSettings>) => {
    setState(prev => ({ 
      ...prev, 
      settings: { ...prev.settings, ...settings }
    }));
  }, []);

  const togglePreview = useCallback(() => {
    setState(prev => ({ ...prev, previewMode: !prev.previewMode }));
  }, []);

  const resetFormData = useCallback((title: string, elements: FormElement[]) => {
    // Ensure all field names follow the formatting rules
    const normalizedElements = ensureUniqueFieldNames(elements);
    
    setState(prev => ({
      ...prev,
      formTitle: title,
      elements: normalizedElements,
      selectedElementId: null
    }));
  }, []);

  const exportForm = useCallback(() => {
    // Ensure all field names are properly formatted before export
    const normalizedElements = ensureUniqueFieldNames(state.elements);
    
    const formConfig = {
      title: state.formTitle,
      elements: normalizedElements,
      settings: state.settings,
    };
    
    const dataStr = JSON.stringify(formConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${state.formTitle.toLowerCase().replace(/\s+/g, '-')}-form.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [state]);



  const addElementAtIndex = (type: FormElementType, index?: number) => {
    const newElement: FormElement = {
      id: nanoid(),
      type,
      label: getDefaultLabel(type),
      placeholder: getDefaultPlaceholder(type),
      required: false,
      disabled: false,
      readonly: false,
      name: generateFieldName(type),
      ...(type === 'select' && { options: [] }),
      ...(type === 'radio' && { options: [] }),
      ...(type === 'checkbox' && { checked: false }),
      ...(type === 'image' && { src: '', alt: '' }),
      ...(type === 'rate-scale' && { rateVariant: 'numbers' }),
      ...(type === 'boolean-switch' && { booleanVariant: 'yes-no' }),
      ...(type === 'datetime-picker' && { dateTimeVariant: 'date-only' }),
    };

    if (index !== undefined && index >= 0 && index <= state.elements.length) {
      const newElements = [...state.elements];
      newElements.splice(index, 0, newElement);
      setState(prev => ({
        ...prev,
        elements: newElements,
        selectedElementId: newElement.id,
      }));
    } else {
      setState(prev => ({
        ...prev,
        elements: [...prev.elements, newElement],
        selectedElementId: newElement.id,
      }));
    }
  };

  const updateFormSettings = useCallback((key: string, value: any) => {
    setFormSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const updateFormTags = useCallback((tags: string[]) => {
    setFormTags(tags);
  }, []);

  return {
    ...state,
    formSettings,
    formTags,
    addElement,
    addElementAtIndex,
    updateElement,
    removeElement,
    moveElement,
    selectElement,
    updateFormTitle,
    updateSettings,
    updateFormSettings,
    updateFormTags,
    togglePreview,
    resetFormData,
    exportForm,
  };
}

function getDefaultLabel(type: FormElementType): string {
  const labels = {
    'text-input': 'Text Field',
    'email-input': 'Email Address',
    'number-input': 'Number',
    'textarea': 'Text Area',
    'select': 'Select Option',
    'checkbox': 'Checkbox',
    'radio': 'Radio Button',
    'image': 'Image',
    'rate-scale': 'How did we do?',
    'boolean-switch': 'Yes or No?',
    'datetime-picker': 'Select Date',
    'full-name': 'Full Name',
  } as const;
  return labels[type];
}

function getDefaultPlaceholder(type: FormElementType): string {
  const placeholders = {
    'text-input': 'Enter text...',
    'email-input': 'you@example.com',
    'number-input': 'Enter number...',
    'textarea': 'Enter description...',
    'select': 'Choose an option',
    'checkbox': '',
    'radio': '',
    'image': '',
    'rate-scale': '',
    'boolean-switch': '',
    'datetime-picker': 'Select date...',
    'full-name': 'Enter your full name',
  } as const;
  return placeholders[type];
}

function generateFieldName(type: FormElementType): string {
  const timestamp = Date.now().toString(36);
  // Convert type to valid field name format (a-z, 0-9, and hyphens only)
  const normalizedType = type.replace(/[^a-z0-9-]/g, '');
  return `${normalizedType}-${timestamp}`;
}

function validateFieldName(name: string): boolean {
  // Must start with a letter, then allow letters, numbers, and hyphens
  const validPattern = /^[a-z][a-z0-9-]*$/;
  return validPattern.test(name) && name.length > 0;
}

function normalizeFieldName(input: string): string {
  if (!input || input.trim() === '') return 'field-name';
  
  // Since we're already filtering at input level, just ensure proper format
  let normalized = input
    .replace(/[^a-z0-9-]/g, '') // Only allow lowercase letters, numbers, and hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  // Ensure it starts with a letter
  if (normalized && /^[^a-z]/.test(normalized)) {
    normalized = 'field-' + normalized;
  }
  
  // Return normalized result or fallback
  return normalized || 'field-name';
}

function ensureUniqueFieldNames(elements: FormElement[]): FormElement[] {
  const usedNames = new Set<string>();
  
  return elements.map((element) => {
    let normalizedName = normalizeFieldName(element.name);
    
    // Ensure uniqueness by adding suffix if needed
    let counter = 1;
    let finalName = normalizedName;
    while (usedNames.has(finalName)) {
      finalName = `${normalizedName}-${counter}`;
      counter++;
    }
    
    usedNames.add(finalName);
    return { ...element, name: finalName };
  });
}

// Export utility functions for field name validation
export { validateFieldName, normalizeFieldName, ensureUniqueFieldNames };
