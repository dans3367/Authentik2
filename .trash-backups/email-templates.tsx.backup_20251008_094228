import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Clock,
  Copy,
  Edit,
  Trash2,
  Star,
  StarOff,
  Download,
  Eye
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Template {
  id: string;
  name: string;
  category: "promotional" | "transactional" | "newsletter" | "welcome" | "custom";
  subject: string;
  preview: string;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  isFavorite: boolean;
}

const mockTemplates: Template[] = [
  {
    id: "1",
    name: "Summer Sale Template",
    category: "promotional",
    subject: "🌞 Summer Sale - Up to 50% Off!",
    preview: "Get ready for summer with our biggest sale of the year. Shop now and save up to 50% on selected items...",
    usageCount: 15,
    lastUsed: "2025-07-25",
    createdAt: "2025-06-10",
    isFavorite: true,
  },
  {
    id: "2",
    name: "Welcome Email Series",
    category: "welcome",
    subject: "Welcome to {{company_name}}! 🎉",
    preview: "Hi {{first_name}}, Welcome aboard! We're thrilled to have you join our community...",
    usageCount: 243,
    lastUsed: "2025-07-29",
    createdAt: "2025-03-15",
    isFavorite: true,
  },
  {
    id: "3",
    name: "Order Confirmation",
    category: "transactional",
    subject: "Order #{{order_number}} Confirmed",
    preview: "Thank you for your order! Your order #{{order_number}} has been confirmed and is being processed...",
    usageCount: 1892,
    lastUsed: "2025-07-29",
    createdAt: "2025-01-20",
    isFavorite: false,
  },
  {
    id: "4",
    name: "Monthly Newsletter",
    category: "newsletter",
    subject: "{{month}} Newsletter - What's New",
    preview: "Here's what we've been up to this month, including product updates, tips, and exclusive offers...",
    usageCount: 8,
    lastUsed: "2025-07-01",
    createdAt: "2025-04-05",
    isFavorite: false,
  },
  {
    id: "5",
    name: "Abandoned Cart Reminder",
    category: "transactional",
    subject: "You left something in your cart 🛒",
    preview: "Hi {{first_name}}, We noticed you left some items in your cart. Complete your purchase before they're gone...",
    usageCount: 67,
    lastUsed: "2025-07-28",
    createdAt: "2025-05-12",
    isFavorite: true,
  },
];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const getCategoryBadge = (category: Template["category"]) => {
    const categoryConfig = {
      promotional: { color: "bg-purple-100 text-purple-700", label: "Promotional" },
      transactional: { color: "bg-blue-100 text-blue-700", label: "Transactional" },
      newsletter: { color: "bg-green-100 text-green-700", label: "Newsletter" },
      welcome: { color: "bg-yellow-100 text-yellow-700", label: "Welcome" },
      custom: { color: "bg-gray-100 text-gray-700", label: "Custom" },
    };

    const config = categoryConfig[category];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const toggleFavorite = (templateId: string) => {
    setTemplates(templates.map(template => 
      template.id === templateId 
        ? { ...template, isFavorite: !template.isFavorite }
        : template
    ));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    const matchesFavorites = !showFavoritesOnly || template.isFavorite;
    
    return matchesSearch && matchesCategory && matchesFavorites;
  });

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Design and manage reusable email templates
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Template Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Templates</p>
                <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
              </div>
              <FileText className="text-blue-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Most Used</p>
                <p className="text-lg font-bold text-gray-900">Order Confirmation</p>
                <p className="text-sm text-gray-500">1,892 uses</p>
              </div>
              <Star className="text-yellow-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Last Created</p>
                <p className="text-lg font-bold text-gray-900">5 days ago</p>
                <p className="text-sm text-gray-500">Product Launch</p>
              </div>
              <Clock className="text-green-500 w-8 h-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="promotional">Promotional</SelectItem>
            <SelectItem value="transactional">Transactional</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
            <SelectItem value="welcome">Welcome</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Star className="w-4 h-4 mr-2" />
          Favorites
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                  <div className="flex items-center gap-2 mb-3">
                    {getCategoryBadge(template.category)}
                    <span className="text-sm text-gray-500">
                      Used {template.usageCount} times
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleFavorite(template.id)}
                >
                  {template.isFavorite ? (
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff className="w-5 h-5 text-gray-400" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Subject Line</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    {template.subject}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Preview</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {template.preview}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Created {formatDate(template.createdAt)}</span>
                  {template.lastUsed && (
                    <span>Last used {formatDate(template.lastUsed)}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Use
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="w-4 h-4 mr-2" />
                        Export HTML
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}