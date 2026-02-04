import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Calendar, Globe, Monitor, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FormResponse {
  id: string;
  formId: string;
  responseData: string;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

interface FormResponsesProps {
  formId: string;
  formTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

interface FormElement {
  id: string;
  type: string;
  label?: string;
  placeholder?: string;
}

export function FormResponses({ formId, formTitle, isOpen, onClose }: FormResponsesProps) {
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch form responses
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/forms/${formId}/responses`, page],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/forms/${formId}/responses?page=${page}&limit=${limit}`);
      return response.json();
    },
    enabled: isOpen && !!formId,
  });

  // Fetch form details to get field labels
  const { data: formData } = useQuery({
    queryKey: [`/api/forms/${formId}`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/forms/${formId}`);
      return response.json();
    },
    enabled: isOpen && !!formId,
  });

  const responses: FormResponse[] = data?.responses || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  // Parse form elements to get field labels
  const getFieldLabels = (): Record<string, string> => {
    if (!formData?.formData) return {};
    try {
      const parsed = JSON.parse(formData.formData);
      const elements: FormElement[] = parsed.elements || [];
      const labels: Record<string, string> = {};
      elements.forEach((el) => {
        if (el.id && el.label) {
          labels[el.id] = el.label;
        }
      });
      return labels;
    } catch {
      return {};
    }
  };

  const fieldLabels = getFieldLabels();

  // Parse response data and render it
  const renderResponseData = (responseDataStr: string) => {
    try {
      const data = JSON.parse(responseDataStr);
      if (typeof data === 'object' && data !== null) {
        return (
          <div className="space-y-2">
            {Object.entries(data).map(([key, value]) => {
              const label = fieldLabels[key] || key;
              const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
              return (
                <div key={key} className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{displayValue || '—'}</span>
                </div>
              );
            })}
          </div>
        );
      }
      return <span className="text-sm text-gray-600">{responseDataStr}</span>;
    } catch {
      return <span className="text-sm text-gray-600">{responseDataStr}</span>;
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Parse user agent for display
  const parseUserAgent = (ua?: string) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Browser';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Responses for "{formTitle}"
            <Badge variant="secondary" className="ml-2">
              {pagination.total} total
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading responses...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">Failed to load responses</p>
            </div>
          ) : responses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No responses yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Responses will appear here when users submit the form
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {responses.map((response, index) => (
                <AccordionItem
                  key={response.id}
                  value={response.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          #{(page - 1) * limit + index + 1}
                        </span>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <Calendar className="h-4 w-4" />
                          {formatDate(response.submittedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {response.ipAddress && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Globe className="h-3 w-3" />
                            {response.ipAddress}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Monitor className="h-3 w-3" />
                          {parseUserAgent(response.userAgent)}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Card className="bg-gray-50 dark:bg-gray-800/30 border-0">
                      <CardContent className="pt-4">
                        {renderResponseData(response.responseData)}
                      </CardContent>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
