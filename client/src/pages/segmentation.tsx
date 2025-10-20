import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Tag,
  Mail,
  List,
  UserCheck,
  Target,
  Copy,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { CustomerSegmentationModal } from "@/components/CustomerSegmentationModal";

interface SegmentList {
  id: string;
  name: string;
  description: string | null;
  type: "all" | "selected" | "tags";
  contactCount: number;
  selectedContactIds: string[];
  selectedTagIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface SegmentStats {
  totalLists: number;
  totalContacts: number;
  averageListSize: number;
}

export default function SegmentationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSegmentationModalOpen, setIsSegmentationModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<SegmentList | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "all" as "all" | "selected" | "tags",
    selectedContactIds: [] as string[],
    selectedTagIds: [] as string[],
  });

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch segment lists
  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ["/api/segment-lists"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/segment-lists");
      return response.json();
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/segment-lists-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/segment-lists/stats");
      return response.json();
    },
  });

  const lists: SegmentList[] = listsData?.lists || [];
  const stats: SegmentStats = statsData?.stats || {
    totalLists: 0,
    totalContacts: 0,
    averageListSize: 0,
  };

  // Filter lists
  const filteredLists = lists.filter((list) => {
    const matchesSearch =
      list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (list.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesType = typeFilter === "all" || list.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/segment-lists", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: "Success",
        description: "Segment list created successfully",
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create segment list",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const response = await apiRequest("PATCH", `/api/segment-lists/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: "Success",
        description: "Segment list updated successfully",
      });
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update segment list",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/segment-lists/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: "Success",
        description: "Segment list deleted successfully",
      });
      setIsDeleteModalOpen(false);
      setSelectedList(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete segment list",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "all",
      selectedContactIds: [],
      selectedTagIds: [],
    });
    setSelectedList(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEdit = (list: SegmentList) => {
    setSelectedList(list);
    setFormData({
      name: list.name,
      description: list.description || "",
      type: list.type,
      selectedContactIds: list.selectedContactIds,
      selectedTagIds: list.selectedTagIds,
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (list: SegmentList) => {
    setSelectedList(list);
    setIsDeleteModalOpen(true);
  };

  const handleDuplicate = async (list: SegmentList) => {
    const duplicateData = {
      name: `${list.name} (Copy)`,
      description: list.description || "",
      type: list.type,
      selectedContactIds: list.selectedContactIds,
      selectedTagIds: list.selectedTagIds,
    };
    createMutation.mutate(duplicateData);
  };

  const handleSubmitCreate = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a list name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleSubmitEdit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a list name",
        variant: "destructive",
      });
      return;
    }
    if (selectedList) {
      updateMutation.mutate({ id: selectedList.id, ...formData });
    }
  };

  const handleSegmentationSave = (data: {
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => {
    setFormData({
      ...formData,
      type: data.recipientType,
      selectedContactIds: data.selectedContactIds,
      selectedTagIds: data.selectedTagIds,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "all":
        return <Users className="h-4 w-4" />;
      case "selected":
        return <UserCheck className="h-4 w-4" />;
      case "tags":
        return <Tag className="h-4 w-4" />;
      default:
        return <List className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "all":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "selected":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "tags":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="h-8 w-8 text-indigo-600" />
            Segmentation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage customer segments for targeted email campaigns
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Segment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Segments</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLists}</div>
            <p className="text-xs text-muted-foreground">Active segment lists</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">Across all segments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Segment Size</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.averageListSize)}</div>
            <p className="text-xs text-muted-foreground">Contacts per segment</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search segments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="selected">Selected Customers</SelectItem>
                <SelectItem value="tags">Tag-based</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Segment Lists</CardTitle>
        </CardHeader>
        <CardContent>
          {listsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No segments found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first segment to get started"}
              </p>
              {!searchQuery && typeFilter === "all" && (
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Segment
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLists.map((list) => (
                    <TableRow key={list.id}>
                      <TableCell className="font-medium">{list.name}</TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${getTypeBadgeColor(list.type)}`}>
                          {getTypeIcon(list.type)}
                          {list.type === "all"
                            ? "All Customers"
                            : list.type === "selected"
                            ? "Selected"
                            : "Tags"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          {list.contactCount}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {list.description || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(list.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(list)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(list)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(list)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Segment List</DialogTitle>
            <DialogDescription>
              Create a new segment list to organize your contacts for targeted campaigns
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., VIP Customers, Newsletter Subscribers"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe this segment..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Segment Criteria</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsSegmentationModalOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {formData.type === "all"
                  ? "All Customers"
                  : formData.type === "selected"
                  ? `${formData.selectedContactIds.length} Selected Customers`
                  : `${formData.selectedTagIds.length} Selected Tags`}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Segment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Segment List</DialogTitle>
            <DialogDescription>
              Update the segment list details and criteria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g., VIP Customers, Newsletter Subscribers"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe this segment..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Segment Criteria</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsSegmentationModalOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {formData.type === "all"
                  ? "All Customers"
                  : formData.type === "selected"
                  ? `${formData.selectedContactIds.length} Selected Customers`
                  : `${formData.selectedTagIds.length} Selected Tags`}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Segment List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedList?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedList && deleteMutation.mutate(selectedList.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Segmentation Modal */}
      <CustomerSegmentationModal
        isOpen={isSegmentationModalOpen}
        onClose={() => setIsSegmentationModalOpen(false)}
        recipientType={formData.type}
        selectedContactIds={formData.selectedContactIds}
        selectedTagIds={formData.selectedTagIds}
        onSave={handleSegmentationSave}
      />
    </div>
  );
}
