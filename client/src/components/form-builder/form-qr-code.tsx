import { useEffect, useState } from 'react';
// Note: QRCode removed - qrcode package was removed during JWT cleanup
// TODO: Re-add QR code functionality if needed
import { Button } from '@/components/ui/button';
import { Copy, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FormQRCodeProps {
  formId: string;
  formTitle: string;
}

export function FormQRCode({ formId, formTitle }: FormQRCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);
  const { toast } = useToast();
  
  const formUrl = `${import.meta.env.VITE_FORMS_URL}/form/${formId}`;

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsGenerating(true);
        // TODO: Re-implement QR code generation
        // For now, just set a placeholder
        setQrCodeUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2E0YWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5RVIgQ29kZSBBdmFpbGFibGUgU29vbjwvdGV4dD4KPC9zdmc+');
      } finally {
        setIsGenerating(false);
      }
    };

    if (formId) {
      generateQRCode();
    }
  }, [formId, formUrl, toast]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      toast({
        title: "Copied!",
        description: "Form URL copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `${formTitle}-qr-code.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const openFormUrl = () => {
    window.open(formUrl, '_blank');
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-muted-foreground">Generating QR code...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      {/* QR Code Display */}
      <div className="relative">
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-100">
          {qrCodeUrl && (
            <img 
              src={qrCodeUrl} 
              alt={`QR Code for ${formTitle}`}
              className="w-64 h-64"
            />
          )}
        </div>
      </div>

      {/* Form URL Display */}
      <div className="w-full max-w-md">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Shareable Form URL
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={formUrl}
            readOnly
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-sm font-mono"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="shrink-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          variant="outline"
          onClick={downloadQRCode}
          className="flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Download QR Code</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={openFormUrl}
          className="flex items-center space-x-2"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Open Form</span>
        </Button>
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground max-w-md">
        <p className="mb-2">
          <strong>Share your form:</strong>
        </p>
        <ul className="text-left space-y-1">
          <li>• Scan the QR code with any smartphone camera</li>
          <li>• Copy and share the URL directly</li>
          <li>• Download the QR code to print or embed</li>
        </ul>
      </div>
    </div>
  );
}