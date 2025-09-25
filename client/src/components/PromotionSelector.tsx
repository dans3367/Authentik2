import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Plus, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface Promotion {
  id: string;
  title: string;
  description: string;
  content: string;
  type: 'newsletter' | 'survey' | 'birthday' | 'announcement' | 'sale' | 'event';
  targetAudience: string;
  isActive: boolean;
  usageCount: number;
  maxUses?: number;
  validFrom?: string;
  validTo?: string;
  promotionalCodes?: string[];
  createdAt: string;
  updatedAt: string;
}

interface PromotionSelectorProps {
  selectedPromotions: string[];
  onPromotionsChange: (promotionIds: string[]) => void;
  onPromotionContentInsert?: (content: string) => void;
  campaignType?: 'newsletter' | 'survey' | 'birthday' | 'announcement' | 'sale' | 'event';
  className?: string;
}

const promotionTypeColors = {
  newsletter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  survey: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  birthday: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  announcement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  sale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  event: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

function PromotionPreviewModal({ promotion, isOpen, onClose }: { 
  promotion: Promotion; 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {promotion.title}
            <Badge className={promotionTypeColors[promotion.type]}>
              {promotion.type}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {promotion.description && (
            <p className="text-gray-600 dark:text-gray-400">
              {promotion.description}
            </p>
          )}
          <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
            <h4 className="font-medium mb-2">Content Preview:</h4>
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: promotion.content }}
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Target Audience: {promotion.targetAudience} • Used {promotion.usageCount} times
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PromotionSelector({ 
  selectedPromotions, 
  onPromotionsChange, 
  onPromotionContentInsert,
  campaignType,
  className 
}: PromotionSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [previewPromotion, setPreviewPromotion] = useState<Promotion | null>(null);

  const { data: promotions, isLoading, error } = useQuery({
    queryKey: ['/api/promotions', { type: filterType === 'all' ? undefined : filterType, search: searchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (searchTerm) params.append('search', searchTerm);
      params.append('isActive', 'true'); // Only show active promotions
      
      const response = await apiRequest('GET', `/api/promotions?${params.toString()}`);
      const data = await response.json();
      return data.promotions;
    },
  });

  const { data: selectedPromotionData } = useQuery({
    queryKey: ['/api/promotions/selected', selectedPromotions],
    queryFn: async () => {
      if (selectedPromotions.length === 0) return [];
      const promises = selectedPromotions.map(async id => {
        try {
          const response = await apiRequest('GET', `/api/promotions/${id}`);
          return await response.json();
        } catch (error) {
          return null;
        }
      });
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    },
    enabled: selectedPromotions.length > 0,
  });

  const handlePromotionToggle = (promotionId: string) => {
    if (selectedPromotions.includes(promotionId)) {
      onPromotionsChange(selectedPromotions.filter(id => id !== promotionId));
    } else {
      onPromotionsChange([...selectedPromotions, promotionId]);
    }
  };

  const handleInsertContent = (promotion: Promotion) => {
    if (onPromotionContentInsert) {
      onPromotionContentInsert(promotion.content);
    }
    if (!selectedPromotions.includes(promotion.id)) {
      onPromotionsChange([...selectedPromotions, promotion.id]);
    }
    setIsDialogOpen(false);
  };

  const filteredPromotions = promotions?.filter((promotion: Promotion) => {
    if (campaignType && promotion.type !== campaignType && filterType === 'all') {
      return false; // Auto-filter by campaign type if specified
    }
    return true;
  }) || [];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selected Promotions Display */}
      {selectedPromotions.length > 0 && selectedPromotionData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Selected Promotions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedPromotionData.map((promotion: Promotion) => (
                <div key={promotion.id} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-1">
                  <span className="text-sm font-medium">{promotion.title}</span>
                  <Badge variant="outline" className={promotionTypeColors[promotion.type]}>
                    {promotion.type}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePromotionToggle(promotion.id)}
                    className="h-auto p-0.5 hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    <X className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotion Selector Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Megaphone className="h-4 w-4 mr-2" />
            {selectedPromotions.length > 0 
              ? `Manage Promotions (${selectedPromotions.length} selected)`
              : 'Add Promotions'
            }
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Promotions</DialogTitle>
          </DialogHeader>
          
          {/* Filters */}
          <div className="flex gap-4 pb-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="survey">Survey</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search promotions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Promotions List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-gray-500">
                Failed to load promotions
              </div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No promotions found
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPromotions.map((promotion: Promotion) => (
                  <div 
                    key={promotion.id} 
                    className={cn(
                      "border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow",
                      selectedPromotions.includes(promotion.id) && "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{promotion.title}</h4>
                          <Badge className={promotionTypeColors[promotion.type]}>
                            {promotion.type}
                          </Badge>
                          {selectedPromotions.includes(promotion.id) && (
                            <Badge variant="default" className="bg-blue-600">Selected</Badge>
                          )}
                        </div>
                        {promotion.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {promotion.description}
                          </p>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Target: {promotion.targetAudience} • Used {promotion.usageCount} times
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPromotion(promotion);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedPromotions.includes(promotion.id) ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePromotionToggle(promotion.id);
                          }}
                        >
                          {selectedPromotions.includes(promotion.id) ? 'Remove' : 'Select'}
                        </Button>
                        {onPromotionContentInsert && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInsertContent(promotion);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Insert
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewPromotion && (
        <PromotionPreviewModal 
          promotion={previewPromotion} 
          isOpen={!!previewPromotion}
          onClose={() => setPreviewPromotion(null)}
        />
      )}
    </div>
  );
}
