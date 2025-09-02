import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  Tag,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { updateShopSchema, type UpdateShopData, type ShopWithManager } from "@shared/schema";

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

export default function EditShopPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateShopData>({
    resolver: zodResolver(updateShopSchema),
  });

  // Fetch shop data
  const { data: shopData, isLoading: shopLoading } = useQuery<{ shop: ShopWithManager }>({
    queryKey: ['/api/shops', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/shops/${id}`);
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch managers
  const { data: managersData, isLoading: managersLoading } = useQuery<{ managers: Manager[] }>({
    queryKey: ['/api/shops/managers/list'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shops/managers/list');
      return response.json();
    },
  });

  // Update shop mutation
  const updateShopMutation = useMutation({
    mutationFn: async (data: UpdateShopData) => {
      const response = await apiRequest('PUT', `/api/shops/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      toast({
        title: "Success",
        description: "Shop updated successfully",
      });
      navigate('/shops');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update shop",
        variant: "destructive",
      });
    },
  });

  // Set form values when shop data is loaded
  useEffect(() => {
    if (shopData?.shop) {
      const shop = shopData.shop;
      reset({
        name: shop.name,
        description: shop.description || '',
        address: shop.address || '',
        city: shop.city || '',
        state: shop.state || '',
        zipCode: shop.zipCode || '',
        country: shop.country,
        phone: shop.phone,
        email: shop.email,
        website: shop.website || '',
        managerId: shop.managerId || 'no-manager',
        operatingHours: shop.operatingHours || '',
        status: shop.status as any || 'active',
        category: shop.category || '',
        tags: shop.tags || [],
        socialMedia: shop.socialMedia || '',
        settings: shop.settings || '',
        isActive: shop.isActive ?? undefined,
      });
      setTags(shop.tags || []);
    }
  }, [shopData, reset]);

  const onSubmit = (data: UpdateShopData) => {
    // Convert "no-manager" to null for the API
    const submitData = {
      ...data,
      managerId: data.managerId === 'no-manager' ? null : data.managerId,
      tags: tags.length > 0 ? tags : undefined,
    };
    
    updateShopMutation.mutate(submitData);
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

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <Skeleton className="h-10 w-64" />
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!shopData?.shop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">Shop not found</h2>
              <p className="text-muted-foreground mb-4">The shop you're looking for doesn't exist.</p>
              <Button onClick={() => navigate('/shops')} data-testid="button-back-shops">
                Back to Shops
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
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
                <h1 className="text-3xl font-bold tracking-tight">Edit Shop</h1>
                <p className="text-muted-foreground">Update shop information</p>
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
                        <SelectItem value="no-manager">No Manager</SelectItem>
                        {managersData?.managers.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName} ({manager.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <CardDescription>Add tags to help segment campaigns by shop</CardDescription>
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
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}