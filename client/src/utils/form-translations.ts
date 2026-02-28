// Form language translations for button texts and common UI strings
// Supported languages: English (en), Spanish (es)

export type FormLanguage = 'en' | 'es';

export interface FormTranslations {
  submit: string;
  reset: string;
  submitting: string;
  submitForm: string;
  next: string;
  previous: string;
  required: string;
  selectOption: string;
  firstName: string;
  lastName: string;
  formProgress: string;
  disclaimer: string;
}

const translations: Record<FormLanguage, FormTranslations> = {
  en: {
    submit: 'Submit',
    reset: 'Reset',
    submitting: 'Submitting...',
    submitForm: 'Submit Form',
    next: 'Next',
    previous: 'Previous',
    required: 'Required',
    selectOption: 'Select an option...',
    firstName: 'First Name',
    lastName: 'Last Name',
    formProgress: 'Form Progress',
    disclaimer: 'By submitting this form, you agree to receive email and phone communications from us, including marketing messages, updates, and promotional offers. Standard message and data rates may apply to phone communications. You can opt out at any time by following the unsubscribe instructions in our emails or by contacting us directly.',
  },
  es: {
    submit: 'Enviar',
    reset: 'Restablecer',
    submitting: 'Enviando...',
    submitForm: 'Enviar Formulario',
    next: 'Siguiente',
    previous: 'Anterior',
    required: 'Obligatorio',
    selectOption: 'Seleccione una opción...',
    firstName: 'Nombre',
    lastName: 'Apellido',
    formProgress: 'Progreso del Formulario',
    disclaimer: 'Al enviar este formulario, aceptas recibir comunicaciones por correo electrónico y teléfono de nuestra parte, incluidos mensajes de marketing, actualizaciones y ofertas promocionales. Se pueden aplicar tarifas estándar de mensajes y datos a las comunicaciones telefónicas. Puedes darte de baja en cualquier momento siguiendo las instrucciones de cancelación de suscripción en nuestros correos electrónicos o contactándonos directamente.',
  },
};

export const languageOptions: { value: FormLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

export function getFormTranslations(language: FormLanguage = 'en'): FormTranslations {
  return translations[language] || translations.en;
}

export function getFormTranslation(key: keyof FormTranslations, language: FormLanguage = 'en'): string {
  return (translations[language] || translations.en)[key];
}
