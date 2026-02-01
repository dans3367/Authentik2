import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  UserPlus,
  Mail,
  User,
  Tag,
  List,
  Loader2
} from "lucide-react";
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

// Schema for the form - validation messages will be handled in the component
const addContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
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

export default function NewEmailContact() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);

  const form = useForm<AddContactForm>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
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

  // Create contact mutation with optimistic updates
  const createContactMutation = useMutation({
    mutationFn: async (data: AddContactForm) => {
      const payload = {
        ...data,
        tags: selectedTags,
        lists: selectedLists,
        consentIpAddress: window.location.hostname, // Get IP-like info from client
        consentUserAgent: navigator.userAgent,
      };
      const response = await apiRequest('POST', '/api/email-contacts', payload);
      return response.json();
    },
    onMutate: async (newContact) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/email-contacts'] });

      // Snapshot the previous value
      const previousContacts = queryClient.getQueryData(['/api/email-contacts']);

      // Optimistically update the cache with the new contact
      const optimisticContact = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, // Temporary ID
        email: newContact.email,
        firstName: newContact.firstName || null,
        lastName: newContact.lastName || null,
        status: newContact.status || 'active',
        tags: tags.filter(tag => selectedTags.includes(tag.id)),
        lists: lists.filter(list => selectedLists.includes(list.id)),
        addedDate: new Date(),
        lastActivity: null,
        emailsSent: 0,
        emailsOpened: 0,
      };

      queryClient.setQueryData(['/api/email-contacts'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          contacts: [optimisticContact, ...old.contacts],
        };
      });

      // Update stats optimistically
      queryClient.setQueryData(['/api/email-contacts-stats'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          stats: {
            ...old.stats,
            totalContacts: old.stats.totalContacts + 1,
            activeContacts: newContact.status === 'active' ? old.stats.activeContacts + 1 : old.stats.activeContacts,
            pendingContacts: newContact.status === 'pending' ? old.stats.pendingContacts + 1 : old.stats.pendingContacts,
          },
        };
      });

      // Return a context object with the snapshotted value
      return { previousContacts };
    },
    onError: (err, newContact, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousContacts) {
        queryClient.setQueryData(['/api/email-contacts'], context.previousContacts);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts-stats'] });

      toast({
        title: t('emailContacts.toasts.error'),
        description: err?.message || t('emailContacts.newContact.toasts.createError'),
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: t('emailContacts.toasts.success'),
        description: t('emailContacts.newContact.toasts.createSuccess', { 
          name: variables.firstName || variables.lastName || variables.email.split('@')[0] 
        }),
        duration: 3000,
      });

      // Invalidate and refetch to get the real data with correct ID
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-contacts-stats'] });

      // Add a small delay before redirecting to show the success state
      setTimeout(() => {
        setLocation('/email-contacts');
      }, 500);
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
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/email-contacts')}
            className="p-0 h-auto"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('emailContacts.newContact.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('emailContacts.newContact.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t('emailContacts.newContact.cardTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            className="bg-white dark:bg-gray-800"
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
                            className="bg-white dark:bg-gray-800"
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
                            className="bg-white dark:bg-gray-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Address Fields */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Address Information (Optional)</h3>
                  
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123 Main St" 
                            {...field} 
                            className="bg-white dark:bg-gray-800"
                          />
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
                            <Input 
                              placeholder="New York" 
                              {...field} 
                              className="bg-white dark:bg-gray-800"
                            />
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
                            <Input 
                              placeholder="NY" 
                              {...field} 
                              className="bg-white dark:bg-gray-800"
                            />
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
                            <Input 
                              placeholder="10001" 
                              {...field} 
                              className="bg-white dark:bg-gray-800"
                            />
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
                            <Input 
                              placeholder="United States" 
                              {...field} 
                              className="bg-white dark:bg-gray-800"
                            />
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
                          <Input 
                            placeholder="+1 (555) 123-4567" 
                            {...field} 
                            className="bg-white dark:bg-gray-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Status Field */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emailContacts.newContact.form.statusLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white dark:bg-gray-800">
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
                    <div className="space-y-2">
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
                <div className="border-t pt-6">
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
                <div className="flex items-center gap-3 pt-6">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/email-contacts')}
                  >
                    {t('emailContacts.newContact.form.cancelButton')}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}