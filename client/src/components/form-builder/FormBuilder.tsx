import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Trash2, GripVertical, Type, Mail, Hash, Calendar, Check, Circle, AlignLeft, Palette, Eye, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation as useLabelTranslation } from '@/hooks/use-translation';
import { useTranslation as useI18n } from 'react-i18next';

interface FormElement {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface FormBuilderProps {
  onSave?: (formData: any) => void;
  onExport?: (formData: any) => void;
  className?: string;
}

const componentTypes = [
  { type: 'text', label: 'Text Input', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'textarea', label: 'Text Area', icon: AlignLeft },
  { type: 'select', label: 'Dropdown', icon: Circle },
  { type: 'checkbox', label: 'Checkbox', icon: Check },
  { type: 'radio', label: 'Radio Group', icon: Circle },
  { type: 'date', label: 'Date', icon: Calendar },
];

function SortableFormElement({ element, onUpdate, onDelete }: { 
  element: FormElement; 
  onUpdate: (id: string, updates: Partial<FormElement>) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-2",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Input
              value={element.label}
              onChange={(e) => onUpdate(element.id, { label: e.target.value })}
              placeholder="Field label"
              className="font-medium"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(element.id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          {(element.type === 'text' || element.type === 'email' || element.type === 'number' || element.type === 'textarea') && (
            <Input
              value={element.placeholder || ''}
              onChange={(e) => onUpdate(element.id, { placeholder: e.target.value })}
              placeholder="Placeholder text"
              className="text-sm"
            />
          )}
          
          {(element.type === 'select' || element.type === 'radio') && (
            <div>
              <Label className="text-sm text-gray-600">Options (one per line)</Label>
              <Textarea
                value={element.options?.join('\n') || ''}
                onChange={(e) => onUpdate(element.id, { options: e.target.value.split('\n').filter(Boolean) })}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                className="text-sm mt-1"
                rows={3}
              />
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`required-${element.id}`}
              checked={element.required || false}
              onCheckedChange={(checked) => onUpdate(element.id, { required: checked as boolean })}
            />
            <Label htmlFor={`required-${element.id}`} className="text-sm">Required field</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormPreview({ elements }: { elements: FormElement[] }) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { getLabel } = useLabelTranslation();
  const { t } = useI18n();

  const handleInputChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const renderField = (element: FormElement) => {
    const commonProps = {
      id: element.id,
      required: element.required,
    };

    switch (element.type) {
      case 'text':
        return (
          <Input
            {...commonProps}
            type="text"
            placeholder={element.placeholder}
            value={formData[element.id] || ''}
            onChange={(e) => handleInputChange(element.id, e.target.value)}
          />
        );
      case 'email':
        return (
          <Input
            {...commonProps}
            type="email"
            placeholder={element.placeholder}
            value={formData[element.id] || ''}
            onChange={(e) => handleInputChange(element.id, e.target.value)}
          />
        );
      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            placeholder={element.placeholder}
            value={formData[element.id] || ''}
            onChange={(e) => handleInputChange(element.id, e.target.value)}
          />
        );
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            placeholder={element.placeholder}
            value={formData[element.id] || ''}
            onChange={(e) => handleInputChange(element.id, e.target.value)}
          />
        );
      case 'select':
        return (
          <Select onValueChange={(value) => handleInputChange(element.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {element.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              {...commonProps}
              checked={formData[element.id] || false}
              onCheckedChange={(checked) => handleInputChange(element.id, checked)}
            />
            <Label htmlFor={element.id}>
              {getLabel({ label: element.label, labelTranslations: (element as any).labelTranslations })}
            </Label>
          </div>
        );
      case 'radio':
        return (
          <RadioGroup
            value={formData[element.id] || ''}
            onValueChange={(value) => handleInputChange(element.id, value)}
          >
            {element.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${element.id}-${index}`} />
                <Label htmlFor={`${element.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            value={formData[element.id] || ''}
            onChange={(e) => handleInputChange(element.id, e.target.value)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {elements.map((element) => (
        <div key={element.id} className="space-y-2">
          {element.type !== 'checkbox' && (
            <Label htmlFor={element.id}>
              {getLabel({ label: element.label, labelTranslations: (element as any).labelTranslations })}
              {element.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          )}
          {renderField(element)}
        </div>
      ))}
      
      {elements.length > 0 && (
        <div className="pt-4">
          <Button className="w-full">{t('common.submit', 'Submit')}</Button>
        </div>
      )}
    </div>
  );
}

export default function FormBuilder({ onSave, onExport, className }: FormBuilderProps) {
  const [elements, setElements] = useState<FormElement[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'build' | 'preview'>('build');
  const [formTitle, setFormTitle] = useState('Untitled Form');

  const addElement = (type: FormElement['type']) => {
    const newElement: FormElement = {
      id: `element-${Date.now()}`,
      type,
      label: `${componentTypes.find(c => c.type === type)?.label || 'Field'}`,
      required: false,
      ...(type === 'select' || type === 'radio' ? { options: ['Option 1', 'Option 2'] } : {}),
    };
    setElements(prev => [...prev, newElement]);
  };

  const updateElement = (id: string, updates: Partial<FormElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setElements((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  };

  const handleSave = () => {
    const formData = {
      title: formTitle,
      elements,
      createdAt: new Date().toISOString(),
    };
    onSave?.(formData);
  };

  const handleExport = () => {
    const formData = {
      title: formTitle,
      elements,
      createdAt: new Date().toISOString(),
    };
    onExport?.(formData);
  };

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <Input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none p-0 focus:ring-0"
            placeholder="Form title"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={mode === 'build' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('build')}
          >
            <Palette className="h-4 w-4 mr-2" />
            Build
          </Button>
          <Button
            variant={mode === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('preview')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {mode === 'build' ? (
          <>
            {/* Component Palette */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Components</h3>
              <div className="space-y-2">
                {componentTypes.map((component) => {
                  const Icon = component.icon;
                  return (
                    <Button
                      key={component.type}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => addElement(component.type as FormElement['type'])}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {component.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Form Builder */}
            <div className="flex-1 p-4 overflow-y-auto">
              <DndContext
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={elements.map(el => el.id)} strategy={verticalListSortingStrategy}>
                  {elements.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Type className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Start building your form</h3>
                      <p>Add components from the left panel to get started</p>
                    </div>
                  ) : (
                    elements.map((element) => (
                      <SortableFormElement
                        key={element.id}
                        element={element}
                        onUpdate={updateElement}
                        onDelete={deleteElement}
                      />
                    ))
                  )}
                </SortableContext>

                <DragOverlay>
                  {activeId ? (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg">
                      <div className="font-medium">
                        {elements.find(el => el.id === activeId)?.label}
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </>
        ) : (
          /* Preview Mode */
          <div className="flex-1 p-8">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>{formTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {elements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No form elements to preview. Switch to Build mode to add components.</p>
                  </div>
                ) : (
                  <FormPreview elements={elements} />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}