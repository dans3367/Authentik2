import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, X, Mail, CheckCircle2, UserCheck, Tag, Calendar, Shield, AlertTriangle, CalendarIcon, ShieldAlert, Settings2, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Schema for the form
const editContactSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'pending']),
  tags: z.array(z.string()).optional(),
  lists: z.array(z.string()).optional(),
  consentGiven: z.boolean().optional(),
  consentMethod: z.string().optional(),
  consentIpAddress: z.string().optional(),
  consentDate: z.date().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.date().optional().nullable(),
  preferredLanguage: z.string().optional(),
  prefMarketing: z.boolean().optional(),
  prefCustomerEngagement: z.boolean().optional(),
  prefNewsletters: z.boolean().optional(),
  prefSurveysForms: z.boolean().optional(),
  shopId: z.string().optional().nullable(),
});

type EditContactForm = z.infer<typeof editContactSchema>;

// Interface that matches the API expectations
interface UpdateContactRequest {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string;
  tags?: string[];
  lists?: string[];
  consentGiven?: boolean;
  consentMethod?: string | null;
  consentIpAddress?: string | null;
  consentDate?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  preferredLanguage?: string | null;
  prefMarketing?: boolean;
  prefCustomerEngagement?: boolean;
  prefNewsletters?: boolean;
  prefSurveysForms?: boolean;
  shopId?: string | null;
}

export default function EditEmailContact() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/contacts/edit/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canEditContacts = !permissionsLoading && hasPermission("contacts.edit");
  const isEditPermissionDenied = !permissionsLoading && !canEditContacts;
  const contactId = match && params?.id ? params.id : "";
  const hasRouteContactId = Boolean(contactId);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!hasRouteContactId) {
      setLocation("/contacts");
    }
  }, [hasRouteContactId, setLocation]);

  // Fetch contact data
  const { data: contactData, isLoading: isContactLoading, error: contactError } = useQuery({
    queryKey: ["/api/email-contacts", contactId],
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest("GET", `${queryKey[0]}/${queryKey[1]}`);
      return res.json();
    },
    enabled: hasRouteContactId && canEditContacts,
  });


  // Fetch available tags
  const { data: tagsData } = useQuery({
    queryKey: ["/api/contact-tags"],
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest("GET", queryKey[0]);
      return res.json();
    },
    enabled: canEditContacts,
  });

  // Fetch available lists
  const { data: listsData } = useQuery({
    queryKey: ["/api/email-lists"],
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest("GET", queryKey[0]);
      return res.json();
    },
    enabled: canEditContacts,
  });

  // Fetch shops for shop assignment dropdown
  const { data: shopsData } = useQuery({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
    staleTime: Infinity,
    enabled: canEditContacts,
  });
  const shopsList: { id: string; name: string; status: string }[] = shopsData?.shops || [];

  // Fetch custom field definitions + values for this contact
  const { data: customFieldsData } = useQuery({
    queryKey: ["/api/email-contacts", contactId, "custom-fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/email-contacts/${contactId}/custom-fields`);
      return res.json();
    },
    enabled: hasRouteContactId && canEditContacts,
  });

  const customFieldDefs: any[] = customFieldsData?.customFields || [];

  const form = useForm<EditContactForm>({
    resolver: zodResolver(editContactSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      status: "active",
      tags: [],
      lists: [],
      consentGiven: false,
      consentMethod: "",
      consentIpAddress: "",
      consentDate: undefined,
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      phoneNumber: "",
      dateOfBirth: undefined,
      preferredLanguage: "en",
      shopId: null,
      prefMarketing: true,
      prefCustomerEngagement: true,
      prefNewsletters: true,
      prefSurveysForms: true,
    },
  });

  // Update form when contact data is loaded
  useEffect(() => {
    if ((contactData as any)?.contact) {
      const contact = (contactData as any).contact;
      form.reset({
        email: contact.email || "",
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        status: contact.status || "active",
        tags: contact.tags?.map((tag: any) => tag.id) || [],
        lists: contact.lists?.map((list: any) => list.id) || [],
        consentGiven: contact.consentGiven || false,
        consentMethod: contact.consentMethod || "",
        consentIpAddress: contact.consentIpAddress || "",
        consentDate: contact.consentDate ? new Date(contact.consentDate) : undefined,
        address: contact.address || "",
        city: contact.city || "",
        state: contact.state || "",
        zipCode: contact.zipCode || "",
        country: contact.country || "",
        phoneNumber: contact.phoneNumber || "",
        dateOfBirth: contact.dateOfBirth ? new Date(contact.dateOfBirth + 'T12:00:00') : undefined,
        preferredLanguage: contact.preferredLanguage || "en",
        shopId: contact.shopId || null,
        prefMarketing: contact.prefMarketing ?? true,
        prefCustomerEngagement: contact.prefCustomerEngagement ?? true,
        prefNewsletters: contact.prefNewsletters ?? true,
        prefSurveysForms: contact.prefSurveysForms ?? true,
      });
      setSelectedTags(contact.tags?.map((tag: any) => tag.id) || []);
      setSelectedLists(contact.lists?.map((list: any) => list.id) || []);
    }
  }, [contactData, form]);

  // Load custom field values when data is ready
  useEffect(() => {
    if (customFieldDefs.length > 0) {
      const vals: Record<string, string> = {};
      customFieldDefs.forEach((cf: any) => {
        if (cf.value !== null && cf.value !== undefined) {
          vals[cf.id] = cf.value;
        }
      });
      setCustomFieldValues(vals);
    }
  }, [customFieldsData]);

  const updateContactMutation = useMutation({
    mutationFn: async (data: UpdateContactRequest) => {
      const response = await apiRequest("PUT", `/api/email-contacts/${contactId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contact updated",
        description: "Email contact has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-contacts", contactId] });
      setLocation("/contacts");
    },
    onError: (error: any) => {
      const is403 = error instanceof Error && error.message?.startsWith('403:');
      toast({
        title: is403 ? "Permission Denied" : "Error",
        description: is403
          ? "You do not have permission to edit contacts. Contact your administrator to request access."
          : (error.message || "Failed to update contact. Please try again."),
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: EditContactForm) => {
    const formData: UpdateContactRequest = {
      email: data.email,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      status: data.status,
      tags: selectedTags,
      lists: selectedLists,
      consentGiven: data.consentGiven,
      consentMethod: data.consentMethod || null,
      consentIpAddress: data.consentIpAddress || null,
      // Convert Date object to ISO string for API
      consentDate: data.consentDate ? data.consentDate.toISOString() : null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      country: data.country || null,
      phoneNumber: data.phoneNumber || null,
      dateOfBirth: data.dateOfBirth ? format(data.dateOfBirth, 'yyyy-MM-dd') : null,
      preferredLanguage: data.preferredLanguage || 'en',
      shopId: data.shopId || null,
      prefMarketing: data.prefMarketing ?? true,
      prefCustomerEngagement: data.prefCustomerEngagement ?? true,
      prefNewsletters: data.prefNewsletters ?? true,
      prefSurveysForms: data.prefSurveysForms ?? true,
    };

    // Save custom field values in parallel with contact update
    if (customFieldDefs.length > 0) {
      const cfValues = Object.entries(customFieldValues).map(([fieldId, value]) => ({
        fieldId,
        value: value || null,
      }));
      try {
        await apiRequest("PUT", `/api/email-contacts/${contactId}/custom-fields`, { values: cfValues });
      } catch (err) {
        console.error('Failed to save custom field values:', err);
      }
    }

    updateContactMutation.mutate(formData);
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

  if (!hasRouteContactId) {
    return null;
  }

  if (permissionsLoading || isContactLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (isEditPermissionDenied) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <ShieldAlert className="h-12 w-12 text-orange-500" />
              <h2 className="text-xl font-semibold">Permission Denied</h2>
              <p className="text-muted-foreground text-sm max-w-md">
                You do not have permission to edit contacts. Contact your administrator to request access.
              </p>
              <Button variant="outline" onClick={() => setLocation("/contacts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contactError || !(contactData as any)?.contact) {
    const is403 = contactError instanceof Error && contactError.message?.startsWith('403:');
    if (is403) {
      return (
        <div className="max-w-6xl mx-auto p-4">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <ShieldAlert className="h-12 w-12 text-orange-500" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  You do not have permission to edit this contact. Contact your administrator to request access.
                </p>
                <Button variant="outline" onClick={() => setLocation("/contacts")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Contacts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Contact not found</h3>
              <p className="text-muted-foreground mb-4">
                The contact you're looking for doesn't exist or has been deleted.
              </p>
              <Button onClick={() => setLocation("/contacts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const contact = (contactData as any)?.contact;
  const availableTags = (tagsData as any)?.tags || [];
  const availableLists = (listsData as any)?.lists || [];

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/contacts")}
          className="mb-6 group hover:bg-white/60 dark:hover:bg-slate-800/60 backdrop-blur-sm border border-white/20 dark:border-slate-700/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-0.5" />
          Back to Contacts
        </Button>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 dark:from-slate-100 dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
            Edit Contact
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Update contact information and manage their subscription status
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">Contact Information</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Update the contact's details and subscription status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="contact@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="First name" {...field} />
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
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Address Fields */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">Address Information (Optional)</h3>

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer's Date of Birth</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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

                    {/* Email Preferences */}
                    <div className="space-y-4 border-t pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">Email Preferences</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {([
                          { name: 'prefMarketing' as const, label: 'Marketing', description: 'Promotions & offers' },
                          { name: 'prefCustomerEngagement' as const, label: 'Customer Engagement', description: 'Birthday & loyalty' },
                          { name: 'prefNewsletters' as const, label: 'Newsletters', description: 'Updates & digests' },
                          { name: 'prefSurveysForms' as const, label: 'Surveys & Forms', description: 'Feedback requests' },
                        ]).map((pref) => (
                          <FormField
                            key={pref.name}
                            control={form.control}
                            name={pref.name}
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                  <FormLabel className="text-sm font-medium">{pref.label}</FormLabel>
                                  <FormDescription className="text-xs">{pref.description}</FormDescription>
                                </div>
                                <FormControl>
                                  <Checkbox
                                    checked={field.value ?? true}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Shop Assignment */}
                    {shopsList.length > 0 && (
                      <FormField
                        control={form.control}
                        name="shopId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5">
                              <Store className="h-3.5 w-3.5" />
                              Shop
                            </FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                              value={field.value || "__none__"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select shop" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="__none__">No shop assigned</SelectItem>
                                {shopsList.filter((s) => s.status === 'active').map((shop) => (
                                  <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs">
                              The shop this contact belongs to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {/* Custom Fields */}
                  {customFieldDefs.length > 0 && (
                    <div className="space-y-4 border-t pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Settings2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">Custom Fields</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customFieldDefs.map((cf: any) => {
                          const mask = cf.mask;
                          return (
                          <div key={cf.id} className={`space-y-1.5${mask === 'multi_line' ? ' md:col-span-2' : ''}`}>
                            <FormLabel>
                              {cf.label}
                              {cf.isRequired && <span className="text-red-500 ml-1">*</span>}
                            </FormLabel>
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
                                  id={`cf-${cf.id}`}
                                  checked={customFieldValues[cf.id] === 'true'}
                                  onCheckedChange={(checked) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: checked ? 'true' : 'false' }))}
                                />
                                <label htmlFor={`cf-${cf.id}`} className="text-sm text-muted-foreground cursor-pointer">
                                  {cf.placeholder || 'Yes'}
                                </label>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                            <SelectItem value="bounced">Bounced</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tags */}
                  {availableTags.length > 0 && (
                    <div className="space-y-3">
                      <FormLabel>Tags</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {availableTags.map((tag: any) => (
                          <div key={tag.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tag-${tag.id}`}
                              checked={selectedTags.includes(tag.id)}
                              onCheckedChange={() => toggleTag(tag.id)}
                            />
                            <label
                              htmlFor={`tag-${tag.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {tag.name}
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedTags.map(tagId => {
                            const tag = availableTags.find((t: any) => t.id === tagId);
                            return tag ? (
                              <Badge key={tagId} variant="secondary" className="flex items-center gap-1">
                                {tag.name}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => toggleTag(tagId)}
                                />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lists */}
                  {availableLists.length > 0 && (
                    <div className="space-y-3">
                      <FormLabel>Email Lists</FormLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {availableLists.map((list: any) => (
                          <div key={list.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`list-${list.id}`}
                              checked={selectedLists.includes(list.id)}
                              onCheckedChange={() => toggleList(list.id)}
                            />
                            <label
                              htmlFor={`list-${list.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {list.name}
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedLists.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedLists.map(listId => {
                            const list = availableLists.find((l: any) => l.id === listId);
                            return list ? (
                              <Badge key={listId} variant="outline" className="flex items-center gap-1">
                                {list.name}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => toggleList(listId)}
                                />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Consent Information */}
                  <div className="space-y-4 border-t border-slate-200/50 dark:border-slate-700/50 pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">Consent Information</h3>
                    </div>

                    {/* Consent Given */}
                    <FormField
                      control={form.control}
                      name="consentGiven"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-medium">
                              Marketing consent given
                            </FormLabel>
                            <FormDescription className="text-xs">
                              This contact has explicitly given consent to receive marketing communications
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Consent Method */}
                    <FormField
                      control={form.control}
                      name="consentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Consent Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select how consent was obtained" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="web_form">Web Form</SelectItem>
                              <SelectItem value="email_signup">Email Signup</SelectItem>
                              <SelectItem value="manual_entry">Manual Entry</SelectItem>
                              <SelectItem value="import">Import</SelectItem>
                              <SelectItem value="api">API</SelectItem>
                              <SelectItem value="double_opt_in">Double Opt-in</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="in_person">In Person</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            How this contact's consent was originally obtained
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Consent IP Address */}
                    <FormField
                      control={form.control}
                      name="consentIpAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Consent IP Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="192.168.1.1"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            IP address from which consent was given (for compliance tracking)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Consent Date */}
                    <FormField
                      control={form.control}
                      name="consentDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Consent Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick consent date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={{ after: new Date(), before: new Date("1900-01-01") }}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormDescription className="text-xs">
                            Date when marketing consent was originally given
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Compliance Warning */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Compliance Notice
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Ensure all consent information is accurate and complies with GDPR, CAN-SPAM, and other applicable regulations.
                          Only send marketing emails to contacts who have explicitly consented.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/contacts")}
                      className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateContactMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
                    >
                      {updateContactMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Summary */}
          <Card className="border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Contact Summary</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Current contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{contact?.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Email Address</p>
                  </div>
                </div>

                {(contact?.firstName || contact?.lastName) && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {[contact?.firstName, contact?.lastName].filter(Boolean).join(' ')}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Full Name</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <Badge
                      variant={contact?.status === 'active' ? 'default' : 'secondary'}
                      className={
                        contact?.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          contact?.status === 'unsubscribed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' :
                            contact?.status === 'bounced' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                              contact?.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : ''
                      }
                    >
                      {contact?.status}
                    </Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Status</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags Section */}
          <Card className="border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Current Tags</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Tags assigned to this contact
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {Array.isArray(contact?.tags) && contact.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag: any) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        borderColor: tag.color,
                        color: tag.color
                      }}
                      className="border-2"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No tags assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Lists Section */}
          <Card className="border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Current Lists</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Email lists this contact belongs to
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {Array.isArray(contact?.lists) && contact.lists.length > 0 ? (
                <div className="space-y-2">
                  {contact.lists.map((list: any) => (
                    <div key={list.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                      <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/30">
                        <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{list.name}</p>
                        {list.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{list.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Not subscribed to any lists</p>
              )}
            </CardContent>
          </Card>

          {/* Contact Details */}
          <Card className="border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Contact Details</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Additional contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Date Added</p>
                  </div>
                </div>

                {contact.consentDate && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {new Date(contact.consentDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Consent Date</p>
                    </div>
                  </div>
                )}

                {contact.consentMethod && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                      <CheckCircle2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {contact.consentMethod.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Consent Method</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consent Status */}
          <Card className="border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Consent Status
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Marketing consent and compliance information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${contact.consentGiven ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <CheckCircle2 className={`h-4 w-4 ${contact.consentGiven ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${contact.consentGiven ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                      {contact.consentGiven ? 'Consent Given' : 'No Consent'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Marketing Permission</p>
                  </div>
                </div>

                {contact.consentIpAddress && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 font-mono">
                        {contact.consentIpAddress}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Consent IP Address</p>
                    </div>
                  </div>
                )}

                {!contact.consentGiven && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Compliance Warning
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        This contact has not given consent for marketing emails. Sending marketing content may violate regulations.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
