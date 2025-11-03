import { useState } from 'react';
import { NewsletterBlock, NewsletterEditorState } from '@/types/newsletter-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Palette, Layout } from 'lucide-react';

interface SettingsSidebarProps {
  selectedBlock: NewsletterBlock | undefined;
  globalStyle: NewsletterEditorState['globalStyle'];
  onBlockUpdate: (blockId: string, updates: Partial<NewsletterBlock>) => void;
  onGlobalStyleUpdate: (updates: Partial<NewsletterEditorState['globalStyle']>) => void;
}

export function SettingsSidebar({
  selectedBlock,
  globalStyle,
  onBlockUpdate,
  onGlobalStyleUpdate,
}: SettingsSidebarProps) {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
          <TabsTrigger value="template" className="text-xs">
            <Layout className="w-3 h-3 mr-1" />
            Template
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="layout" className="text-xs">
            <Palette className="w-3 h-3 mr-1" />
            Layout
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="template" className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Template</Label>
              <p className="text-xs text-gray-500">Choose a pre-built template to start with</p>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="p-4 space-y-6">
            {selectedBlock ? (
              <BlockSettings block={selectedBlock} onUpdate={onBlockUpdate} />
            ) : (
              <div className="text-center py-12">
                <Settings className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Select a block to edit its settings</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="layout" className="p-4 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="fontFamily" className="text-sm font-medium">Font Family</Label>
                <Select
                  value={globalStyle?.fontFamily}
                  onValueChange={(value) => onGlobalStyleUpdate({ fontFamily: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                    <SelectItem value="Georgia, serif">Georgia</SelectItem>
                    <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                    <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
                    <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="backgroundColor" className="text-sm font-medium">Background</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={globalStyle?.backgroundColor}
                    onChange={(e) => onGlobalStyleUpdate({ backgroundColor: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={globalStyle?.backgroundColor}
                    onChange={(e) => onGlobalStyleUpdate({ backgroundColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="primaryColor" className="text-sm font-medium">Primary Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={globalStyle?.primaryColor}
                    onChange={(e) => onGlobalStyleUpdate({ primaryColor: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={globalStyle?.primaryColor}
                    onChange={(e) => onGlobalStyleUpdate({ primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondaryColor" className="text-sm font-medium">Secondary Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={globalStyle?.secondaryColor}
                    onChange={(e) => onGlobalStyleUpdate({ secondaryColor: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={globalStyle?.secondaryColor}
                    onChange={(e) => onGlobalStyleUpdate({ secondaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Other Settings Section */}
      <div className="border-t border-gray-200 p-4">
        <button className="w-full text-sm text-gray-600 hover:text-gray-900 flex items-center justify-between">
          <span>Other settings</span>
          <span className="text-xs">▼</span>
        </button>
      </div>
    </div>
  );
}

function BlockSettings({
  block,
  onUpdate,
}: {
  block: NewsletterBlock;
  onUpdate: (blockId: string, updates: Partial<NewsletterBlock>) => void;
}) {
  const handleUpdate = (updates: Partial<NewsletterBlock>) => {
    onUpdate(block.id, updates);
  };

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={block.title}
              onChange={(e) => handleUpdate({ title: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={block.subtitle || ''}
              onChange={(e) => handleUpdate({ subtitle: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={block.imageUrl || ''}
              onChange={(e) => handleUpdate({ imageUrl: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="buttonText">Button Text</Label>
            <Input
              id="buttonText"
              value={block.buttonText || ''}
              onChange={(e) => handleUpdate({ buttonText: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="buttonUrl">Button URL</Label>
            <Input
              id="buttonUrl"
              value={block.buttonUrl || ''}
              onChange={(e) => handleUpdate({ buttonUrl: e.target.value })}
              className="mt-2"
            />
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={block.content}
              onChange={(e) => handleUpdate({ content: e.target.value })}
              className="mt-2 min-h-[200px]"
            />
          </div>
          <StyleSettings block={block} onUpdate={handleUpdate} />
        </div>
      );

    case 'image':
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="url">Image URL</Label>
            <Input
              id="url"
              value={block.url}
              onChange={(e) => handleUpdate({ url: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="alt">Alt Text</Label>
            <Input
              id="alt"
              value={block.alt || ''}
              onChange={(e) => handleUpdate({ alt: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="link">Link URL (optional)</Label>
            <Input
              id="link"
              value={block.link || ''}
              onChange={(e) => handleUpdate({ link: e.target.value })}
              className="mt-2"
            />
          </div>
        </div>
      );

    case 'button':
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="text">Button Text</Label>
            <Input
              id="text"
              value={block.text}
              onChange={(e) => handleUpdate({ text: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={block.url}
              onChange={(e) => handleUpdate({ url: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="variant">Style</Label>
            <Select
              value={block.variant}
              onValueChange={(value: any) => handleUpdate({ variant: value })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <StyleSettings block={block} onUpdate={handleUpdate} />
        </div>
      );

    case 'footer':
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={block.companyName || ''}
              onChange={(e) => handleUpdate({ companyName: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={block.address || ''}
              onChange={(e) => handleUpdate({ address: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="unsubscribeText">Unsubscribe Text</Label>
            <Input
              id="unsubscribeText"
              value={block.unsubscribeText || ''}
              onChange={(e) => handleUpdate({ unsubscribeText: e.target.value })}
              className="mt-2"
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-500">
          No settings available for this block type
        </div>
      );
  }
}

function StyleSettings({
  block,
  onUpdate,
}: {
  block: NewsletterBlock;
  onUpdate: (updates: Partial<NewsletterBlock>) => void;
}) {
  const style = block.style || {};

  const updateStyle = (styleUpdates: Partial<typeof style>) => {
    onUpdate({
      style: { ...style, ...styleUpdates },
    });
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-sm font-medium">Styling</h3>
      
      <div>
        <Label htmlFor="textAlign">Text Align</Label>
        <Select
          value={style.textAlign || 'left'}
          onValueChange={(value: any) => updateStyle({ textAlign: value })}
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="textColor">Text Color</Label>
        <div className="flex gap-2 mt-2">
          <Input
            type="color"
            value={style.textColor || '#000000'}
            onChange={(e) => updateStyle({ textColor: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={style.textColor || '#000000'}
            onChange={(e) => updateStyle({ textColor: e.target.value })}
            className="flex-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="backgroundColor">Background Color</Label>
        <div className="flex gap-2 mt-2">
          <Input
            type="color"
            value={style.backgroundColor || '#ffffff'}
            onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={style.backgroundColor || '#ffffff'}
            onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
            className="flex-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="padding">Padding</Label>
        <Input
          id="padding"
          value={style.padding || ''}
          onChange={(e) => updateStyle({ padding: e.target.value })}
          placeholder="e.g., 20px or 1rem"
          className="mt-2"
        />
      </div>
    </div>
  );
}
