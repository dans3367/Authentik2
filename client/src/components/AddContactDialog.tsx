import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  UserPlus,
  Mail,
  User,
  Tag,
  List,
  Loader2,
  Settings2,
  CalendarIcon,
  Cake,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const addContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.date().nullable().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'pending']).default('active'),
  tags: z.array(z.string()).optional(),
  lists: z.array(z.string()).optional(),
  consentGiven: z.boolean().refine(val => val === true),
  consentMethod: z.string().default('manual_add'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
  preferredLanguage: z.string().optional(),
});

type AddContactForm = z.infer<typeof addContactSchema>;

interface ContactTag {
  id: string;
  name: string;
  color: string;
}

interface EmailList {
  id: string;
  name: string;
  description?: string | null;
}

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const form = useForm<AddContactForm>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      dateOfBirth: null,
      status: "active",
      tags: [],
      lists: [],
      consentGiven: false,
      consentMethod: "manual_add",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      phoneNumber: "",
      preferredLanguage: "en",
    },
  });

  // Fetch email lists
  const { data: listsData } = useQuery({
    queryKey: ['/api/email-lists'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-lists');
      return response.json();
    },
  });

  // Fetch contact tags
  const { data: tagsData } = useQuery({
    queryKey: ['/api/contact-tags'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/contact-tags');
      return response.json();
    },
  });

  const lists: EmailList[] = listsData?.lists || [];
  const tags: ContactTag[] = tagsData?.tags || [];

  // Fetch custom field definitions
  const { data: customFieldsData } = useQuery({
    queryKey: ['/api/contact-custom-fields'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/contact-custom-fields');
      return response.json();
    },
  });

  const customFieldDefs: any[] = customFieldsData?.fields || [];

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: AddContactForm) => {
      const payload = {
        ...data,
        dateOfBirth: data.dateOfBirth ? format(data.dateOfBirth, 'yyyy-MM-dd') : undefined,
        tags: selectedTags,
        lists: selectedLists,
        consentIpAddress: window.location.hostname,
        consentUserAgent: navigator.userAgent,
      };
      const response = await apiRequest('POST', '/api/email-contacts', payload);
      return response.json();
    },
    onSuccess: async (data, variables) => {
      // Save custom field values for the newly created contact
      if (data?.id && customFieldDefs.length > 0) {
        const cfValues = Object.entries(customFieldValues)
          .filter(([_, value]) => value)
          .map(([fieldId, value]) => ({ fieldId, value }));
        if (cfValues.length > 0) {
          try {
            await apiRequest('PUT', `/api/email-contacts/${data.id}/custom-fields`, { values: cfValues });
          } catch (err) {
            console.error('Failed to save custom field values:', err);
          }
        }
      }

      toast({
        title: t('emailContacts.toasts.success'),
        description: t('emailContacts.newContact.toasts.createSuccess', { 
          name: variables.firstName || variables.lastName || variables.email.split('@')[0] 
        }),
        duration: 3000,
      });

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts-stats'] });

      // Reset form and close dialog
      form.reset();
      setSelectedTags([]);
      setSelectedLists([]);
      setCustomFieldValues({});
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: t('emailContacts.toasts.error'),
        description: err?.message || t('emailContacts.newContact.toasts.createError'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddContactForm) => {
    createContactMutation.mutate(data);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleList = (listId: string) => {
    setSelectedLists(prev => 
      prev.includes(listId) 
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {t('emailContacts.newContact.cardTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('emailContacts.newContact.subtitle')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
            {/* Contact Information Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {t('emailContacts.newContact.form.firstNameLabel')}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('emailContacts.newContact.form.firstNamePlaceholder')} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {t('emailContacts.newContact.form.lastNameLabel')}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('emailContacts.newContact.form.lastNamePlaceholder')} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {t('emailContacts.newContact.form.emailLabel')} *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('emailContacts.newContact.form.emailPlaceholder')} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date of Birth */}
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Cake className="w-4 h-4" />
                    Date of Birth
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          type="button"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Select date of birth</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        selected={field.value ?? undefined}
                        onSelect={field.onChange}
                        disabled={{ after: new Date(), before: new Date("1900-01-01") }}
                        fromYear={1920}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>Optional - used for birthday cards and promotions</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address Fields */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Address Information (Optional)</h3>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip/Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="United States" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preferred Language */}
              <FormField
                control={form.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Language</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'en'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Language used for sending communications to this contact
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Custom Fields */}
            {customFieldDefs.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Custom Fields
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFieldDefs.map((cf: any) => {
                    const mask = cf.mask;
                    return (
                    <div key={cf.id} className={`space-y-1.5${mask === 'multi_line' ? ' md:col-span-2' : ''}`}>
                      <Label>
                        {cf.label}
                        {cf.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {cf.fieldType === 'text' && mask === 'multi_line' && (
                        <Textarea
                          placeholder={cf.placeholder || `Enter ${cf.label.toLowerCase()}...`}
                          value={customFieldValues[cf.id] || ''}
                          rows={3}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'text' && mask !== 'multi_line' && (
                        <Input
                          placeholder={cf.placeholder || `Enter ${cf.label.toLowerCase()}...`}
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'number' && (mask === 'phone_with_area' || mask === 'phone_no_area') && (
                        <Input
                          type="tel"
                          placeholder={cf.placeholder || (mask === 'phone_with_area' ? '(555) 123-4567' : '123-4567')}
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'number' && mask !== 'phone_with_area' && mask !== 'phone_no_area' && (
                        <Input
                          type="number"
                          step={mask === 'currency' ? '0.01' : mask === 'percentage' ? '1' : 'any'}
                          placeholder={cf.placeholder || (mask === 'currency' ? '0.00' : mask === 'percentage' ? '0' : '0')}
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'url' && (
                        <Input
                          type="url"
                          placeholder={cf.placeholder || 'https://...'}
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'date' && mask === 'time_only' && (
                        <Input
                          type="time"
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'date' && mask === 'date_time' && (
                        <Input
                          type="datetime-local"
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'date' && mask !== 'time_only' && mask !== 'date_time' && (
                        <Input
                          type="date"
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        />
                      )}
                      {cf.fieldType === 'select' && (
                        <Select
                          value={customFieldValues[cf.id] || ''}
                          onValueChange={(val) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={cf.placeholder || `Select ${cf.label.toLowerCase()}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(cf.options || []).map((opt: string) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {cf.fieldType === 'boolean' && (
                        <div className="flex items-center space-x-2 pt-1">
                          <Checkbox
                            id={`add-cf-${cf.id}`}
                            checked={customFieldValues[cf.id] === 'true'}
                            onCheckedChange={(checked) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: checked ? 'true' : 'false' }))}
                          />
                          <Label htmlFor={`add-cf-${cf.id}`} className="text-sm text-muted-foreground cursor-pointer">
                            {cf.placeholder || 'Yes'}
                          </Label>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status Field */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailContacts.newContact.form.statusLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('emailContacts.newContact.form.statusPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t('emailContacts.filters.active')}</SelectItem>
                      <SelectItem value="inactive">{t('emailContacts.filters.inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Lists */}
            {lists.length > 0 && (
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <List className="w-4 h-4" />
                  {t('emailContacts.newContact.form.emailListsLabel')}
                </Label>
                <FormDescription className="mb-3">
                  {t('emailContacts.newContact.form.emailListsDescription')}
                </FormDescription>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {lists.map((list) => (
                    <div key={list.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`list-${list.id}`}
                        checked={selectedLists.includes(list.id)}
                        onCheckedChange={() => toggleList(list.id)}
                      />
                      <Label
                        htmlFor={`list-${list.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {list.name}
                        {list.description && (
                          <span className="text-gray-500 ml-2">- {list.description}</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4" />
                  {t('emailContacts.newContact.form.tagsLabel')}
                </Label>
                <FormDescription className="mb-3">
                  {t('emailContacts.newContact.form.tagsDescription')}
                </FormDescription>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={{
                        backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined,
                        borderColor: tag.color,
                        color: selectedTags.includes(tag.id) ? 'white' : tag.color,
                      }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Consent Disclosure */}
            <div className="border-t pt-4">
              <FormField
                control={form.control}
                name="consentGiven"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50 dark:bg-blue-950/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-medium text-sm">
                        {t('emailContacts.newContact.form.consentLabel')} *
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {t('emailContacts.newContact.form.consentDescription')}
                      </FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('emailContacts.newContact.form.cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={createContactMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createContactMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('emailContacts.newContact.form.creating')}
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('emailContacts.newContact.form.createButton')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
