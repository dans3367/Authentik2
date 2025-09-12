import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2, Calendar, Megaphone, Settings, ChevronDown, ChevronUp, Save, Upload, Wand2, Code, Copy, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generatePromotionalCodes, parseUserCodes, validatePromotionalCodes, formatCodesForDisplay, CODE_GENERATION_PRESETS, type CodeFormat } from '@/utils/codeGeneration';

const promotionTypeColors = {
  newsletter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  survey: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  birthday: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  announcement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  sale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  event: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

export default function CreatePromotionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    type: 'newsletter' as const,
    targetAudience: 'all',
    isActive: true,
    maxUses: '',
    validFrom: '',
    validTo: '',
    promotionalCodes: [] as string[],
  });
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // Code generation state
  const [codeGenerationMode, setCodeGenerationMode] = useState<'upload' | 'generate'>('upload');
  const [userCodesInput, setUserCodesInput] = useState('');
  const [generateOptions, setGenerateOptions] = useState({
    count: 10,
    length: 8,
    format: 'alphanumeric' as CodeFormat,
    prefix: '',
    suffix: '',
  });
  const [isCodeSectionOpen, setIsCodeSectionOpen] = useState(false);

  const createPromotionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/promotions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-stats'] });
      toast({
        title: "Success",
        description: "Promotion created successfully",
      });
      setLocation('/promotions');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create promotion",
        variant: "destructive",
      });
    },
  });

  // Code generation handlers
  const handleUserCodesChange = (value: string) => {
    setUserCodesInput(value);
    const codes = parseUserCodes(value);
    const validation = validatePromotionalCodes(codes);
    
    if (validation.errors.length > 0) {
      // Don't show toast for every keystroke, just update the codes
      setFormData({ ...formData, promotionalCodes: validation.valid });
    } else {
      setFormData({ ...formData, promotionalCodes: validation.valid });
    }
  };

  const handleGenerateCodes = () => {
    try {
      const codes = generatePromotionalCodes(generateOptions);
      setFormData({ ...formData, promotionalCodes: codes });
      toast({
        title: "Success",
        description: `Generated ${codes.length} promotional codes`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate codes",
        variant: "destructive",
      });
    }
  };

  const handleCopyCodesList = async () => {
    if (formData.promotionalCodes.length === 0) return;
    
    try {
      await navigator.clipboard.writeText(formatCodesForDisplay(formData.promotionalCodes));
      toast({
        title: "Success",
        description: "Promotional codes copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy codes to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate promotional codes if any are provided
    if (formData.promotionalCodes.length > 0) {
      const validation = validatePromotionalCodes(formData.promotionalCodes);
      if (validation.errors.length > 0) {
        toast({
          title: "Validation Error",
          description: validation.errors.join('. '),
          variant: "destructive",
        });
        return;
      }
    }

    // Prepare data with proper date conversion and validation
    const submitData = {
      ...formData,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
      validFrom: formData.validFrom ? new Date(formData.validFrom + 'T00:00:00') : undefined,
      validTo: formData.validTo ? new Date(formData.validTo + 'T23:59:59') : undefined,
      promotionalCodes: formData.promotionalCodes.length > 0 ? formData.promotionalCodes : undefined,
    };

    // Validate date range
    if (submitData.validFrom && submitData.validTo && submitData.validFrom >= submitData.validTo) {
      toast({
        title: "Validation Error",
        description: "Valid From date must be before Valid To date",
        variant: "destructive",
      });
      return;
    }

    createPromotionMutation.mutate(submitData);
  };

  const handleCancel = () => {
    setLocation('/promotions');
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCancel}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Promotions
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            Create New Promotion
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create promotional content template for your email campaigns
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter promotion title"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newsletter">Newsletter</SelectItem>
                        <SelectItem value="survey">Survey</SelectItem>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the promotion"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Select value={formData.targetAudience} onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Contacts</SelectItem>
                      <SelectItem value="subscribers">Subscribers Only</SelectItem>
                      <SelectItem value="customers">Customers</SelectItem>
                      <SelectItem value="prospects">Prospects</SelectItem>
                      <SelectItem value="vip">VIP Customers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
                  />
                  <Label htmlFor="isActive">Active (available for use)</Label>
                </div>
              </CardContent>
            </Card>

            {/* Content Card */}
            <Card>
              <CardHeader>
                <CardTitle>Promotion Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter the promotional content (HTML supported)"
                    rows={12}
                    required
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can use HTML tags for rich formatting in your promotional content.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Code Generation Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Promotional Codes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Collapsible open={isCodeSectionOpen} onOpenChange={setIsCodeSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-between mb-4"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Code Generation Options
                      </div>
                      {isCodeSectionOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4">
                    {/* Code Generation Mode Selection */}
                    <div className="space-y-3">
                      <Label>Choose how to add promotional codes:</Label>
                      <RadioGroup 
                        value={codeGenerationMode} 
                        onValueChange={(value: 'upload' | 'generate') => setCodeGenerationMode(value)}
                        className="grid grid-cols-1 gap-4"
                      >
                        <div className="flex items-center space-x-2 border rounded-lg p-3">
                          <RadioGroupItem value="upload" id="upload" />
                          <Label htmlFor="upload" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Upload className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Upload my own codes</div>
                              <div className="text-sm text-muted-foreground">Paste your promotional codes separated by spaces</div>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-3">
                          <RadioGroupItem value="generate" id="generate" />
                          <Label htmlFor="generate" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Wand2 className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Generate codes for me</div>
                              <div className="text-sm text-muted-foreground">Automatically generate unique promotional codes</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Upload Mode */}
                    {codeGenerationMode === 'upload' && (
                      <div className="space-y-3">
                        <Label htmlFor="userCodes">Promotional Codes</Label>
                        <Textarea
                          id="userCodes"
                          value={userCodesInput}
                          onChange={(e) => handleUserCodesChange(e.target.value)}
                          placeholder="Paste your promotional codes here, separated by spaces, commas, or new lines&#10;Example: SAVE20 WELCOME10 NEWUSER15"
                          rows={6}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter your promotional codes separated by spaces, commas, or line breaks. 
                          Codes will be automatically converted to uppercase and duplicates will be removed.
                        </p>
                      </div>
                    )}

                    {/* Generate Mode */}
                    {codeGenerationMode === 'generate' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="codeCount">Number of Codes</Label>
                            <Input
                              id="codeCount"
                              type="number"
                              min="1"
                              max="10000"
                              value={generateOptions.count}
                              onChange={(e) => setGenerateOptions({ 
                                ...generateOptions, 
                                count: parseInt(e.target.value) || 1 
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="codeLength">Code Length</Label>
                            <Input
                              id="codeLength"
                              type="number"
                              min="4"
                              max="20"
                              value={generateOptions.length}
                              onChange={(e) => setGenerateOptions({ 
                                ...generateOptions, 
                                length: parseInt(e.target.value) || 8 
                              })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Code Format</Label>
                          <Select 
                            value={generateOptions.format} 
                            onValueChange={(value: CodeFormat) => setGenerateOptions({ 
                              ...generateOptions, 
                              format: value 
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="alphanumeric">Alphanumeric (A-Z, 0-9)</SelectItem>
                              <SelectItem value="alphabetic">Alphabetic only (A-Z)</SelectItem>
                              <SelectItem value="numeric">Numbers only (0-9)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="codePrefix">Prefix (Optional)</Label>
                            <Input
                              id="codePrefix"
                              value={generateOptions.prefix}
                              onChange={(e) => setGenerateOptions({ 
                                ...generateOptions, 
                                prefix: e.target.value.toUpperCase() 
                              })}
                              placeholder="e.g., SALE"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="codeSuffix">Suffix (Optional)</Label>
                            <Input
                              id="codeSuffix"
                              value={generateOptions.suffix}
                              onChange={(e) => setGenerateOptions({ 
                                ...generateOptions, 
                                suffix: e.target.value.toUpperCase() 
                              })}
                              placeholder="e.g., OFF"
                              maxLength={10}
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={handleGenerateCodes}
                          className="w-full"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate Codes
                        </Button>
                      </div>
                    )}

                    {/* Generated/Uploaded Codes Display */}
                    {formData.promotionalCodes.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Generated Codes ({formData.promotionalCodes.length})</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyCodesList}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All
                          </Button>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border max-h-32 overflow-y-auto">
                          <code className="text-xs text-wrap break-all">
                            {formatCodesForDisplay(formData.promotionalCodes)}
                          </code>
                        </div>
                        {codeGenerationMode === 'upload' && (
                          <p className="text-xs text-muted-foreground">
                            Codes have been parsed and validated. Invalid codes were automatically removed.
                          </p>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Advanced Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Advanced Options
                      </div>
                      {isAdvancedOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Max Uses */}
                      <div className="space-y-2">
                        <Label htmlFor="maxUses">Maximum Uses</Label>
                        <Input
                          id="maxUses"
                          type="number"
                          min="1"
                          value={formData.maxUses}
                          onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                          placeholder="Leave empty for unlimited uses"
                        />
                        <p className="text-xs text-muted-foreground">
                          Limit how many times this promotion can be used across all campaigns
                        </p>
                      </div>

                      {/* Date Range */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="validFrom">Valid From</Label>
                          <Input
                            id="validFrom"
                            type="date"
                            value={formData.validFrom}
                            onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Promotion becomes active from this date
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="validTo">Valid To</Label>
                          <Input
                            id="validTo"
                            type="date"
                            value={formData.validTo}
                            onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Promotion expires after this date
                          </p>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div className="text-xs text-blue-800 dark:text-blue-200">
                            <p className="font-medium mb-1">Advanced Settings Help:</p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>Max uses limit applies globally across all campaigns</li>
                              <li>Date range controls when the promotion is available for selection</li>
                              <li>Expired promotions are automatically hidden from selection</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Title
                    </div>
                    <div className="text-sm font-medium">
                      {formData.title || "Your promotion title will appear here"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Type
                    </div>
                    <Badge className={promotionTypeColors[formData.type]}>
                      {formData.type}
                    </Badge>
                  </div>

                  {formData.description && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Description
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formData.description}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Content Preview
                    </div>
                    <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto leading-relaxed bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                      {formData.content || "Your promotional content will appear here as you type..."}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Target Audience
                    </div>
                    <div className="text-sm">
                      {formData.targetAudience}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </div>
                    <Badge variant={formData.isActive ? "default" : "secondary"}>
                      {formData.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {formData.promotionalCodes.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Promotional Codes
                      </div>
                      <div className="text-sm">
                        {formData.promotionalCodes.length} code{formData.promotionalCodes.length !== 1 ? 's' : ''} added
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs max-h-20 overflow-y-auto">
                        <code className="text-wrap break-all">
                          {formData.promotionalCodes.slice(0, 5).join(' ')}
                          {formData.promotionalCodes.length > 5 && ' ...'}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={createPromotionMutation.isPending}
                  >
                    {createPromotionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Create Promotion
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={handleCancel}
                    disabled={createPromotionMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
