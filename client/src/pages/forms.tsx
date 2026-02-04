import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Calendar, User, MoreVertical, Eye, Edit, Trash2, RefreshCw, QrCode, LayoutDashboard, FileText } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { FormPreviewModal } from '@/components/form-preview-modal';
import { FormQRCode } from '@/components/form-builder/form-qr-code';
import { FormResponses } from '@/components/form-builder/form-responses';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Form {
  id: string;
  title: string;
  description: string;
  formData: string;
  theme: string;
  tags?: string[];
  isActive: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

// Helper function to get theme preview classes
const getThemePreview = (themeId: string): string => {
  const themePreviewMap: Record<string, string> = {
    'minimal': 'bg-white border border-gray-200 shadow-sm',
    'modern': 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500',
    'glassmorphism': 'bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl border border-white/20 shadow-lg',
    'professional': 'bg-gray-50 border-l-4 border-blue-600 shadow-sm',
    'playful': 'bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400',
    'elegant': 'bg-gradient-to-r from-gray-900 to-gray-700 border border-yellow-400/20',
    'modern-bold': 'bg-gradient-to-br from-orange-500 via-red-500 to-purple-600',
    'neon': 'bg-black border-2 border-cyan-400 shadow-cyan-400/50 shadow-lg',
    'nature': 'bg-gradient-to-r from-green-500 to-emerald-600',
    'luxury': 'bg-gradient-to-r from-purple-900 to-indigo-900 border border-yellow-400/30',
    'retro': 'bg-gradient-to-r from-orange-400 to-pink-500 border-4 border-yellow-300',
    'neo-modern': 'bg-gradient-to-br from-slate-800 via-gray-800 to-black border border-green-400/30',
    'aurora': 'bg-[radial-gradient(120%_120%_at_0%_0%,_#7dd3fc_0%,_transparent_40%),_radial-gradient(120%_120%_at_100%_0%,_#c084fc_0%,_transparent_40%),_radial-gradient(120%_120%_at_100%_100%,_#fca5a5_0%,_transparent_40%),_radial-gradient(120%_120%_at_0%_100%,_#86efac_0%,_transparent_40%)]',
    'cosmic': 'bg-gradient-to-br from-purple-900 via-indigo-900 to-black',
    'brutalist': 'bg-gray-800 border-4 border-black',
    'pastel-dream': 'bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200'
  };

  return themePreviewMap[themeId] || themePreviewMap['minimal'];
};

// Helper function to get theme-specific preview content
const getThemePreviewContent = (themeId: string) => {
  switch (themeId) {
    case 'neon':
      return (
        <div className="text-cyan-400 font-bold text-sm tracking-wider drop-shadow-lg">
          CYBER<span className="text-green-400">FORM</span>
        </div>
      );
    case 'nature':
      return (
        <div className="text-green-800 font-semibold text-sm">
          🌿 Natural Form 🌿
        </div>
      );
    case 'luxury':
      return (
        <div className="text-yellow-400 font-light text-sm tracking-widest font-serif">
          LUXURY DESIGN
        </div>
      );
    case 'glassmorphism':
      return (
        <div className="text-white/90 font-semibold text-sm tracking-wide">
          Glassmorphism
        </div>
      );
    case 'retro':
      return (
        <div className="text-white font-black text-sm tracking-wider transform -skew-x-12 uppercase">
          80S STYLE
        </div>
      );
    case 'cosmic':
      return (
        <div className="text-purple-300 font-bold text-sm tracking-wider drop-shadow-lg">
          <span className="text-cyan-400">✦</span> COSMIC <span className="text-pink-400">✦</span>
        </div>
      );
    case 'brutalist':
      return (
        <div className="text-white font-black text-sm tracking-wider uppercase border-2 border-white px-2 py-1">
          BRUTALIST
        </div>
      );
    case 'pastel-dream':
      return (
        <div className="text-purple-600 font-medium text-sm tracking-wide">
          ✨ Pastel Dreams ✨
        </div>
      );
    case 'professional':
      return (
        <div className="text-blue-600 font-semibold text-sm">
          PROFESSIONAL
        </div>
      );
    case 'playful':
      return (
        <div className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          🎨 PLAYFUL 🎨
        </div>
      );
    case 'elegant':
      return (
        <div className="text-yellow-400 font-light text-sm tracking-widest font-serif">
          ELEGANT
        </div>
      );
    case 'neo-modern':
      return (
        <div className="text-green-400 font-mono font-bold text-sm tracking-wider">
          &gt; NEO_MODERN.exe
        </div>
      );
    case 'modern-bold':
      return (
        <div className="text-white font-black text-sm tracking-wider drop-shadow-lg">
          MODERN BOLD
        </div>
      );
    case 'aurora':
      return (
        <div className="text-slate-800 font-extrabold text-sm tracking-wide">
          Aurora
        </div>
      );
    case 'modern':
      return (
        <div className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          MODERN
        </div>
      );
    case 'minimal':
      return (
        <div className="text-gray-800 font-light text-sm tracking-wide">
          MINIMAL
        </div>
      );
    default:
      return (
        <div className="text-white font-semibold opacity-90 text-sm">Form Theme</div>
      );
  }
};

export default function Forms2() {
  const { isAuthenticated, isLoading: authLoading, isInitialized } = useReduxAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewForm, setPreviewForm] = useState<any>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Forms", icon: Edit }
  ]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [qrForm, setQrForm] = useState<Form | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [responsesForm, setResponsesForm] = useState<Form | null>(null);
  const [isResponsesModalOpen, setIsResponsesModalOpen] = useState(false);

  // Handle refresh with timestamp update
  const handleRefresh = () => {
    refetch();
    setLastRefreshedAt(new Date());
  };

  // Format time for display
  const formatRefreshTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Fetch forms data
  const { data: formsData, isLoading: formsLoading, error: formsError, refetch } = useQuery({
    queryKey: ['/api/forms'],
    queryFn: async () => {
      console.log('Forms: Fetching forms from API...');
      const response = await apiRequest('GET', '/api/forms');
      const data = await response.json();
      console.log('Forms: Received forms data:', data);
      return data;
    },
    enabled: isAuthenticated && isInitialized, // Wait for both authentication and initialization
    staleTime: 30000, // Cache for 30 seconds
  });

  const forms: Form[] = formsData?.forms || [];

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      const response = await apiRequest('DELETE', `/api/forms/${formId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({
        title: "Success",
        description: "Form deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form",
        variant: "destructive",
      });
    },
  });

  // Handle form actions
  const handleViewForm = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    console.log('Forms: handleViewForm called with formId:', formId);
    console.log('Forms: Found form:', form);

    if (form) {
      setPreviewForm(form);
      setIsPreviewModalOpen(true);
    } else {
      console.error('Forms: Form not found for ID:', formId);
      toast({
        title: "Error",
        description: "Form not found",
        variant: "destructive",
      });
    }
  };

  const handleEditForm = (formId: string) => {
    setLocation(`/forms/${formId}/edit`);
  };

  const handleDeleteForm = (formId: string) => {
    deleteFormMutation.mutate(formId);
  };

  const handleQRForm = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setQrForm(form);
      setIsQRModalOpen(true);
    } else {
      toast({
        title: "Error",
        description: "Form not found",
        variant: "destructive",
      });
    }
  };

  const handleViewResponses = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setResponsesForm(form);
      setIsResponsesModalOpen(true);
    } else {
      toast({
        title: "Error",
        description: "Form not found",
        variant: "destructive",
      });
    }
  };

  // Handle authentication errors after forms query fails (if any)
  if (isInitialized && formsError && (formsError.message?.includes('401') || formsError.message?.includes('Authentication failed'))) {
    setLocation('/auth');
    return null;
  }

  // Show loading while authentication is being determined
  if (!isInitialized || authLoading) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-500" />
            <span className="ml-4 text-gray-600 dark:text-gray-400">Authenticating...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while forms are being fetched
  if (formsLoading) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">Forms</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Create and manage custom forms to collect information and responses
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={formsLoading}
                className="flex items-center"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${formsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/forms/add">
                <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Form
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-500" />
            <span className="ml-4 text-gray-600 dark:text-gray-400">Loading forms...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if forms failed to load
  if (formsError) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">Forms</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Create and manage custom forms to collect information and responses
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={formsLoading}
                className="flex items-center"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${formsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/forms/add">
                <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Form
                </Button>
              </Link>
            </div>
          </div>
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardContent className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">Failed to load forms</p>
              <Button onClick={() => refetch()} variant="outline">Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">Forms</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create and manage custom forms to collect information and responses
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshedAt && (
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                Last refreshed at {formatRefreshTime(lastRefreshedAt)}
              </span>
            )}
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={formsLoading}
              className="flex items-center"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${formsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/forms/add">
              <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                <Plus className="mr-2 h-4 w-4" />
                Add Form
              </Button>
            </Link>
          </div>
        </div>

        {forms.length === 0 ? (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardContent className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-300 mb-4">No forms created yet</p>
              <Link href="/forms/add">
                <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Create your first form</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => {
              // Parse theme data to get theme info
              let themeData: { id: string; name: string; preview?: string } = { id: 'minimal', name: 'Unknown' };
              try {
                const parsed = JSON.parse(form.theme);
                themeData = {
                  id: parsed.id || 'minimal',
                  name: parsed.name || parsed.id || 'Unknown',
                  preview: getThemePreview(parsed.id || 'minimal')
                };
              } catch (e) {
                themeData = { id: 'minimal', name: form.theme || 'Unknown', preview: getThemePreview('minimal') };
              }

              // Parse form data to get element count
              let elementCount = 0;
              try {
                const formData = JSON.parse(form.formData);
                elementCount = formData.elements?.length || 0;
              } catch (e) {
                elementCount = 0;
              }

              return (
                <Card key={form.id} className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300 group overflow-hidden rounded-none">
                  {/* Theme Preview Header */}
                  <div className={`h-20 relative flex items-center justify-center overflow-hidden ${themeData.preview} rounded-none`}>
                    <div className="text-center px-4">
                      {/* Theme-specific preview content */}
                      {getThemePreviewContent(themeData.id)}
                    </div>
                    {/* Dropdown Menu positioned over theme preview */}
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 bg-black/20 hover:bg-black/30 text-white/90 hover:text-white backdrop-blur-sm rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewForm(form.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQRForm(form.id)}>
                            <QrCode className="mr-2 h-4 w-4" />
                            QR
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewResponses(form.id)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Responses ({form.responseCount})
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditForm(form.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-red-600 dark:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the form "{form.title}" and all its responses.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteForm(form.id)}
                                  className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                                  disabled={deleteFormMutation.isPending}
                                >
                                  {deleteFormMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    'Delete Form'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <CardHeader className="pb-3">
                    <CardTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold">
                      {form.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {themeData.name}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${form.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                        {form.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {form.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                        {form.description}
                      </p>
                    )}

                    {/* Tags */}
                    {form.tags && form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.tags.slice(0, 3).map((tagId) => (
                          <span
                            key={tagId}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            Tag {tagId.slice(0, 8)}
                          </span>
                        ))}
                        {form.tags.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            +{form.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <User className="mr-1 h-3 w-3" />
                          {elementCount} field{elementCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(form.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {form.responseCount} response{form.responseCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Preview Modal */}
      {previewForm && (
        <FormPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false);
            setPreviewForm(null);
          }}
          form={previewForm}
          formSettings={{
            showProgressBar: true,
            showFormTitle: true,
            allowSaveProgress: false
          }}
        />
      )}

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {qrForm ? `QR Code for "${qrForm.title}"` : 'QR Code'}
            </DialogTitle>
          </DialogHeader>
          {qrForm && (
            <FormQRCode
              formId={qrForm.id}
              formTitle={qrForm.title}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Form Responses Modal */}
      {responsesForm && (
        <FormResponses
          formId={responsesForm.id}
          formTitle={responsesForm.title}
          isOpen={isResponsesModalOpen}
          onClose={() => {
            setIsResponsesModalOpen(false);
            setResponsesForm(null);
          }}
        />
      )}
    </div>
  );
}