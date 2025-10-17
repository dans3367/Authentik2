import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  
  // Use the form server URL - defaults to localhost:3004 if not configured
  const formServerUrl = import.meta.env.VITE_FORMS_URL || 'http://localhost:3004';
  const formUrl = `${formServerUrl}/form/${formId}`;

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsGenerating(true);

        // Generate actual QR code using the qrcode library
        const qrCodeDataUrl = await QRCode.toDataURL(formUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });

        setQrCodeUrl(qrCodeDataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
        toast({
          title: "Error",
          description: "Failed to generate QR code",
          variant: "destructive",
        });
        // Fallback to placeholder if QR generation fails
        setQrCodeUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2E0YWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5RVIgQ29kZSBBdmFpbGFibGUgU29vbjwvdGV4dD4KPC9zdmc+');
      } finally {
        setIsGenerating(false);
      }
    };

    if (formId) {
      generateQRCode();
    }
  }, [formId, formServerUrl, toast]);

  const fallbackCopy = (text: string) => {
    // Prefer copying from the visible input to give visual feedback
    if (inputRef.current) {
      const input = inputRef.current;
      input.focus();
      input.select();
      // For iOS support
      input.setSelectionRange(0, input.value.length);
      const ok = document.execCommand('copy');
      // Clear selection
      input.setSelectionRange(0, 0);
      if (!ok) throw new Error('execCommand copy failed');
      return;
    }

    // Hidden textarea fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('execCommand copy failed');
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(formUrl);
      } else {
        // In non-secure contexts or older browsers, use fallback
        fallbackCopy(formUrl);
      }
      toast({
        title: "Copied!",
        description: "Form URL copied to clipboard.",
      });
    } catch (error) {
      console.error('Clipboard copy failed, attempting fallback:', error);
      try {
        fallbackCopy(formUrl);
        toast({
          title: "Copied!",
          description: "Form URL copied to clipboard.",
        });
      } catch (err2) {
        console.error('Clipboard fallback copy failed:', err2);
        toast({
          title: "Error",
          description: "Failed to copy URL. Please select the URL and press Ctrl/Cmd+C.",
          variant: "destructive",
        });
      }
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
            ref={inputRef}
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
};