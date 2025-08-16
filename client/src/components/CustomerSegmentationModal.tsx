import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Tag, Users, X, Check, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { EmailContactWithDetails, ContactTag } from "@shared/schema";

interface CustomerSegmentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientType: 'all' | 'selected' | 'tags';
  selectedContactIds: string[];
  selectedTagIds: string[];
  onSave: (data: {
    recipientType: 'all' | 'selected' | 'tags';
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => void;
}

export function CustomerSegmentationModal({
  isOpen,
  onClose,
  recipientType,
  selectedContactIds,
  selectedTagIds,
  onSave,
}: CustomerSegmentationModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'selected' | 'tags'>(recipientType);
  const [searchTerm, setSearchTerm] = useState("");
  const [tempSelectedContacts, setTempSelectedContacts] = useState<string[]>(selectedContactIds);
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>(selectedTagIds);

  // Fetch contacts
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/email-contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-contacts');
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch tags
  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['/api/contact-tags'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/contact-tags');
      return response.json();
    },
    enabled: isOpen,
  });

  const contacts: EmailContactWithDetails[] = (contactsData as any)?.contacts || [];
  const tags: ContactTag[] = (tagsData as any)?.tags || [];

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact =>
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter tags based on search
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset temporary selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(recipientType);
      setTempSelectedContacts(selectedContactIds);
      setTempSelectedTags(selectedTagIds);
      setSearchTerm("");
    }
  }, [isOpen, recipientType, selectedContactIds, selectedTagIds]);

  const handleContactToggle = (contactId: string) => {
    setTempSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleTagToggle = (tagId: string) => {
    setTempSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = () => {
    onSave({
      recipientType: activeTab,
      selectedContactIds: activeTab === 'selected' ? tempSelectedContacts : [],
      selectedTagIds: activeTab === 'tags' ? tempSelectedTags : [],
    });
    onClose();
  };

  const getSelectionSummary = () => {
    switch (activeTab) {
      case 'all':
        return `All customers (${contacts.length} total)`;
      case 'selected':
        return `${tempSelectedContacts.length} selected customers`;
      case 'tags':
        const tagNames = tempSelectedTags.map(tagId => {
          const tag = tags.find(t => t.id === tagId);
          return tag?.name || tagId;
        }).join(', ');
        return `${tempSelectedTags.length} selected tags${tagNames ? `: ${tagNames}` : ''}`;
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Segmentation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                All Customers
              </TabsTrigger>
              <TabsTrigger value="selected" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Select Customers
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Select by Tags
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Send to All Customers
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Your newsletter will be sent to all active customers in your contact list
                </p>
                <div className="mt-4">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {contacts.length} customers
                  </Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="selected" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search customers by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setTempSelectedContacts([])}
                    disabled={tempSelectedContacts.length === 0}
                  >
                    Clear All
                  </Button>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {tempSelectedContacts.length} of {filteredContacts.length} customers selected
                </div>

                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  {contactsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No customers found matching your search' : 'No customers available'}
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleContactToggle(contact.id)}
                        >
                          <Checkbox
                            checked={tempSelectedContacts.includes(contact.id)}
                            onChange={() => {}} // Controlled by parent click
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {contact.firstName && contact.lastName
                                  ? `${contact.firstName} ${contact.lastName}`
                                  : contact.email}
                              </p>
                              <Badge
                                variant={contact.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {contact.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                            {contact.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {contact.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag.id} variant="outline" className="text-xs">
                                    {tag.name}
                                  </Badge>
                                ))}
                                {contact.tags.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{contact.tags.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search tags..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setTempSelectedTags([])}
                    disabled={tempSelectedTags.length === 0}
                  >
                    Clear All
                  </Button>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {tempSelectedTags.length} of {filteredTags.length} tags selected
                </div>

                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  {tagsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : filteredTags.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No tags found matching your search' : 'No tags available'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 p-4">
                      {filteredTags.map((tag) => (
                        <div
                          key={tag.id}
                          className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                            tempSelectedTags.includes(tag.id)
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => handleTagToggle(tag.id)}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color || '#gray' }}
                          />
                          <span className="text-sm font-medium flex-1">{tag.name}</span>
                          {tempSelectedTags.includes(tag.id) && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getSelectionSummary()}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Selection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}