import { ComponentPaletteItem, FormElementType } from '@/types/form-builder';
import { DraggableComponent } from './draggable-component';
import { useTranslation } from 'react-i18next';

const paletteItems: ComponentPaletteItem[] = [
  // Basic Inputs
  {
    type: 'text-input',
    label: 'Text Input',
    description: 'Single line text field',
    icon: 'fas fa-font',
    color: 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700',
    category: 'basic',
  },
  {
    type: 'email-input',
    label: 'Email Input',
    description: 'Email address field',
    icon: 'fas fa-envelope',
    color: 'bg-gradient-to-br from-green-100 to-emerald-200 text-green-700',
    category: 'basic',
  },
  {
    type: 'textarea',
    label: 'Textarea',
    description: 'Multi-line text area',
    icon: 'fas fa-align-left',
    color: 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700',
    category: 'basic',
  },
  {
    type: 'number-input',
    label: 'Number Input',
    description: 'Numeric field',
    icon: 'fas fa-hashtag',
    color: 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700',
    category: 'basic',
  },
  {
    type: 'full-name',
    label: 'Full Name',
    description: 'First and last name fields',
    icon: 'fas fa-user',
    color: 'bg-gradient-to-br from-teal-100 to-cyan-200 text-teal-700',
    category: 'basic',
  },
  {
    type: 'image',
    label: 'Image',
    description: 'Square image display',
    icon: 'fas fa-image',
    color: 'bg-gradient-to-br from-violet-100 to-purple-200 text-violet-700',
    category: 'basic',
  },
  // Selection
  {
    type: 'select',
    label: 'Select Dropdown',
    description: 'Dropdown selection',
    icon: 'fas fa-caret-down',
    color: 'bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700',
    category: 'selection',
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'Multiple selection',
    icon: 'fas fa-check-square',
    color: 'bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-700',
    category: 'selection',
  },
  {
    type: 'radio',
    label: 'Radio Button',
    description: 'Single selection',
    icon: 'fas fa-dot-circle',
    color: 'bg-gradient-to-br from-pink-100 to-rose-200 text-pink-700',
    category: 'selection',
  },
  {
    type: 'rate-scale',
    label: 'Rate Scale',
    description: 'Rating scale 1-10',
    icon: 'fas fa-star',
    color: 'bg-gradient-to-br from-yellow-100 to-amber-200 text-yellow-700',
    category: 'selection',
  },
  {
    type: 'boolean-switch',
    label: 'Yes/No Switch',
    description: 'Toggle switch for binary choices',
    icon: 'fas fa-toggle-on',
    color: 'bg-gradient-to-br from-cyan-100 to-blue-200 text-cyan-700',
    category: 'selection',
  },
  {
    type: 'datetime-picker',
    label: 'Date & Time',
    description: 'Date, time, or datetime input',
    icon: 'fas fa-calendar-alt',
    color: 'bg-gradient-to-br from-blue-100 to-sky-200 text-blue-700',
    category: 'basic',
  },
];

const categoryLabels = {
  basic: 'Basic Inputs',
  selection: 'Selection',
};

interface ComponentPaletteProps {
  onAddElement: (type: FormElementType) => void;
}

export function ComponentPalette({ onAddElement }: ComponentPaletteProps) {
  const { t } = useTranslation();
  const categories = ['basic', 'selection'] as const;
  const isMobile = window.innerWidth < 1024; // lg breakpoint

  return (
    <aside className="w-80 lg:w-80 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200/60 shadow-sm relative z-10 h-full flex flex-col">
      <div className="p-4 lg:p-6 flex-1 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">{t('formBuilder.palette.header', 'Form Components')}</h2>
          <p className="text-sm text-slate-500">{t('formBuilder.palette.subheader', 'Drag & drop to build your form')}</p>
        </div>
        
        {categories.map((category) => {
          const items = paletteItems.filter(item => item.category === category);
          
          return (
            <div key={category} className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  {t(`formBuilder.palette.categories.${category}`, categoryLabels[category])}
                </h3>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent ml-3"></div>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const localizedItem = {
                    ...item,
                    label: t(`formBuilder.palette.${item.type}.label`, item.label),
                    description: t(`formBuilder.palette.${item.type}.description`, item.description),
                  } as ComponentPaletteItem;
                  return (
                    <DraggableComponent
                      key={item.type}
                      item={localizedItem}
                      onAddElement={onAddElement}
                      isMobile={isMobile}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        
        <div className="mt-12 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
          <div className="text-xs text-blue-600 font-medium mb-1">💡 {t('formBuilder.proTipTitle', 'Pro tip')}</div>
          <div className="text-xs text-blue-700">
            {isMobile 
              ? t('formBuilder.proTipMobile', 'Click to add instantly, or drag for precise placement')
              : t('formBuilder.proTipDesktop', 'Drag components for precise placement with blue line indicators')}
          </div>
        </div>
      </div>
    </aside>
  );
}
