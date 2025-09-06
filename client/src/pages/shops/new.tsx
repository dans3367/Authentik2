import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Store, 
  ArrowLeft,
  Save,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  User,
  Building,
  Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createShopSchema, type CreateShopData } from "@shared/schema";
import { useReduxAuth } from "@/hooks/useReduxAuth";

interface Manager {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

const SHOP_CATEGORIES = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'service', label: 'Service Center' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_OPERATING_HOURS = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: { closed: true },
};

export default function NewShopPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useReduxAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateShopData>({
    resolver: zodResolver(createShopSchema),
    defaultValues: {
      status: 'active',
      country: 'United States',
      operatingHours: JSON.stringify(DEFAULT_OPERATING_HOURS),
      tags: [],
    },
  });

  // Debug authentication state
  console.log('🔍 [Shops/New] Auth state:', {
    isAuthenticated,
    authLoading,
    hasUser: !!user,
    userRole: user?.role
  });

  // Fetch managers
  const { data: managersData, isLoading: managersLoading, error: managersError } = useQuery<Manager[]>({
    queryKey: ['/api/shops/managers/list'],
    queryFn: async () => {
      console.log('🔍 Fetching managers list...');
      try {
        const response = await apiRequest('GET', '/api/shops/managers/list');
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Managers API error:', response.status, errorText);
          throw new Error(`Failed to fetch managers: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        console.log('🔍 Managers response:', data);
        return data;
      } catch (error) {
        console.error('❌ Error in managers query:', error);
        throw error;
      }
    },
    enabled: !!isAuthenticated && !authLoading,
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Log error if any
  if (managersError) {
    console.error('❌ Error fetching managers:', managersError);
  }

  // Debug function to create test managers
  const createTestManagers = async () => {
    try {
      const response = await apiRequest('POST', '/api/dev/create-test-managers');
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Test managers created:', result);
        toast({
          title: "Test Managers Created",
          description: `Created: ${result.created.join(', ')}`,
        });
        // Refetch managers
        window.location.reload();
      } else {
        console.error('❌ Failed to create test managers');
      }
    } catch (error) {
      console.error('❌ Error creating test managers:', error);
    }
  };

  // Create shop mutation
  const createShopMutation = useMutation({
    mutationFn: async (data: CreateShopData) => {
      const response = await apiRequest('POST', '/api/shops', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create shop');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Shop created successfully",
      });
      navigate('/shops');
    },
    onError: (error: any) => {
      // Handle shop limit errors specifically
      if (error.message && error.message.includes("Shop limit reached")) {
        toast({
          title: "Shop Limit Reached",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create shop",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: CreateShopData) => {
    createShopMutation.mutate({
      ...data,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setValue('tags', newTags);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    setValue('tags', newTags);
  };

  // Show loading state while authentication is being determined
  if (authLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-4">Loading...</span>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/shops')}
                data-testid="button-back-shops"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Add New Shop</h1>
                <p className="text-muted-foreground">Create a new shop location</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>General details about the shop</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Shop Name *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Enter shop name"
                      data-testid="input-shop-name"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={watch('category')} 
                      onValueChange={(value) => setValue('category', value)}
                    >
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {SHOP_CATEGORIES.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Enter shop description"
                    rows={3}
                    data-testid="textarea-description"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={watch('status')} 
                      onValueChange={(value) => setValue('status', value as any)}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="managerId">Manager</Label>
                    <Select 
                      value={watch('managerId') || undefined}
                      onValueChange={(value) => setValue('managerId', value)}
                      disabled={managersLoading}
                    >
                      <SelectTrigger data-testid="select-manager">
                        <SelectValue placeholder={managersLoading ? "Loading..." : "Select manager"} />
                      </SelectTrigger>
                      <SelectContent>
                        {managersLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading managers...
                          </SelectItem>
                        ) : managersError ? (
                          <SelectItem value="error" disabled>
                            Error loading managers
                          </SelectItem>
                        ) : managersData && managersData.length > 0 ? (
                          managersData.map(manager => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.firstName || manager.lastName 
                                ? `${manager.firstName || ''} ${manager.lastName || ''}`.trim() 
                                : 'No name'} ({manager.email})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-managers" disabled>
                            No managers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {managersError && (
                      <p className="text-sm text-destructive">
                        Failed to load managers. Please try refreshing the page.
                      </p>
                    )}
                    {!managersLoading && !managersError && managersData && managersData.length === 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          No managers found. Only users with "Manager" or "Owner" role can be assigned to shops.
                        </p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={createTestManagers}
                          data-testid="button-create-test-managers"
                        >
                          Create Test Managers
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle>Location Details</CardTitle>
                <CardDescription>Physical location and address information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    {...register('address')}
                    placeholder="123 Main Street"
                    data-testid="input-address"
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address.message}</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...register('city')}
                      placeholder="New York"
                      data-testid="input-city"
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive">{errors.city.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province</Label>
                    <Input
                      id="state"
                      {...register('state')}
                      placeholder="NY"
                      data-testid="input-state"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                    <Input
                      id="zipCode"
                      {...register('zipCode')}
                      placeholder="10001"
                      data-testid="input-zip"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    {...register('country')}
                    placeholder="United States"
                    data-testid="input-country"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>How customers can reach this shop</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="(555) 123-4567"
                      data-testid="input-phone"
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="shop@example.com"
                      data-testid="input-email"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    {...register('website')}
                    placeholder="https://example.com"
                    data-testid="input-website"
                  />
                  {errors.website && (
                    <p className="text-sm text-destructive">{errors.website.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Add tags to help categorize this shop</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add a tag..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      data-testid="input-tag"
                    />
                    <Button type="button" onClick={handleAddTag} variant="secondary" data-testid="button-add-tag">
                      <Tag className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <Badge 
                          key={tag} 
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => handleRemoveTag(tag)}
                          data-testid={`tag-${tag}`}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/shops')}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                  data-testid="button-submit"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Create Shop
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}