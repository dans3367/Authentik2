import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseTheme, ThemeStyles } from '../themes';
import { FullName } from './ui/FullName';

interface FormElement {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormData {
  id: string;
  title: string;
  description?: string;
  formData: {
    elements: FormElement[];
  };
  theme: string;
}

interface FormViewProps {
  formId: string;
}

const FormView: React.FC<FormViewProps> = ({ formId }) => {
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [theme, setTheme] = useState<ThemeStyles | null>(null);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/forms/${formId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Form not found or inactive');
          } else {
            setError('Failed to load form');
          }
          return;
        }

        const formData = await response.json();
        setForm(formData);
        
        // Parse and set theme
        const parsedTheme = parseTheme(formData.theme);
        setTheme(parsedTheme);
        
        // Initialize form values
        const initialValues: Record<string, any> = {};
        formData.formData.elements?.forEach((element: FormElement) => {
          initialValues[element.id] = '';
        });
        setFormValues(initialValues);
        
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  const handleInputChange = (elementId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [elementId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseData: formValues
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFormElement = (element: FormElement) => {
    const { id, type, label, required, placeholder, options } = element;

    switch (type) {
      case 'text':
      case 'text-input':
      case 'email':
      case 'email-input':
      case 'tel':
      case 'url':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              id={id}
              type={type === 'text-input' ? 'text' : type === 'email-input' ? 'email' : type}
              placeholder={placeholder}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
            />
          </div>
        );

      case 'full-name':
        return (
          <div key={id} className="space-y-2">
            <FullName
              id={id}
              required={required}
              firstNameValue={formValues[`${id}_first`] || ''}
              lastNameValue={formValues[`${id}_last`] || ''}
              onFirstNameChange={(value) => handleInputChange(`${id}_first`, value)}
              onLastNameChange={(value) => handleInputChange(`${id}_last`, value)}
              firstNamePlaceholder="First Name"
              lastNamePlaceholder="Last Name"
              theme={theme}
            />
          </div>
        );

      case 'first-name':
      case 'last-name':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              id={id}
              type="text"
              placeholder={placeholder}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id={id}
              placeholder={placeholder}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.textarea || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'}
              rows={4}
            />
          </div>
        );

      case 'select':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <select
              id={id}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.select || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
            >
              <option value="">Select an option...</option>
              {options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );

      case 'radio':
        return (
          <div key={id} className="space-y-2">
            <label className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${id}-${index}`}
                    name={id}
                    value={option}
                    required={required}
                    checked={formValues[id] === option}
                    onChange={(e) => handleInputChange(id, e.target.value)}
                    className={theme?.radio || 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300'}
                  />
                  <label htmlFor={`${id}-${index}`} className={theme?.label || 'text-sm font-normal text-gray-700'}>
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div key={id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={id}
                required={required}
                checked={formValues[id] || false}
                onChange={(e) => handleInputChange(id, e.target.checked)}
                className={theme?.checkbox || 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'}
              />
              <label htmlFor={id} className={theme?.label || 'text-sm font-normal text-gray-700'}>
                {label} {required && <span className="text-red-500">*</span>}
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme?.background || 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme?.background || 'bg-gray-50'}`}>
        <div className={`w-full max-w-md ${theme?.card || 'bg-white rounded-lg shadow-md border border-gray-300'}`}>
          <div className={theme?.header || 'p-6 border-b border-gray-200'}>
            <h3 className={`flex items-center space-x-2 ${theme?.title || 'text-xl font-semibold text-gray-900'}`}>
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Error</span>
            </h3>
          </div>
          <div className="p-6">
            <p className={theme?.description || 'text-gray-600'}>{error || 'Form not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme?.background || 'bg-gray-50'}`}>
        <div className={`w-full max-w-md ${theme?.card || 'bg-white rounded-lg shadow-md border border-gray-300'}`}>
          <div className={theme?.header || 'p-6 border-b border-gray-200'}>
            <h3 className={`flex items-center space-x-2 ${theme?.title || 'text-xl font-semibold text-gray-900'}`}>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Success!</span>
            </h3>
          </div>
          <div className="p-6">
            <p className={theme?.description || 'text-gray-600'}>
              Thank you for your submission. Your response has been recorded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme?.container || 'min-h-screen py-8'} ${theme?.background || 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 max-w-2xl">
        <div className={theme?.card || 'bg-white rounded-lg shadow-md border border-gray-300'}>
          <div className={theme?.header || 'p-6 border-b border-gray-200'}>
            <h1 className={theme?.title || 'text-2xl font-bold text-gray-900'}>{form.title}</h1>
            {form.description && (
              <p className={theme?.description || 'text-gray-600 mt-2'}>{form.description}</p>
            )}
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {form.formData.elements?.map(renderFormElement)}
              
              <button 
                type="submit" 
                disabled={submitting}
                className={theme?.button || 'w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'}
              >
                {submitting ? 'Submitting...' : 'Submit Form'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormView;