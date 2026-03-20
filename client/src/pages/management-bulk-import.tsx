import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Papa from "papaparse";

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; email?: string; reason: string }>;
  hasMoreErrors?: boolean;
}

interface PreviewRow {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  status?: string;
  [key: string]: string | undefined;
}

export default function ManagementBulkImport() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setError(null);

    Papa.parse<PreviewRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      preview: 5,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError('Failed to parse CSV: ' + results.errors[0].message);
          return;
        }
        setHeaders(results.meta.fields || []);
        setPreview(results.data);
      },
    });

    // Count total rows
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setTotalRows(results.data.length);
      },
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && (dropped.type === 'text/csv' || dropped.name.toLowerCase().endsWith('.csv'))) {
      processFile(dropped);
    } else {
      setError('Please upload a CSV file');
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/email-contacts/bulk-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Import failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Network error — please try again');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview([]);
    setHeaders([]);
    setTotalRows(0);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const template = 'email,first_name,last_name,phone_number,date_of_birth,address,city,state,zip_code,country\njohn@example.com,John,Doe,(555) 123-4567,1990-01-15,123 Main St,Springfield,IL,62701,US\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Map of recognized columns with friendly labels
  const knownColumns: Record<string, string> = {
    email: 'Email', email_address: 'Email', 'e-mail': 'Email', e_mail: 'Email',
    first_name: 'First Name', firstname: 'First Name', first: 'First Name', given_name: 'First Name',
    last_name: 'Last Name', lastname: 'Last Name', last: 'Last Name', surname: 'Last Name', family_name: 'Last Name',
    phone: 'Phone', phone_number: 'Phone', phonenumber: 'Phone', telephone: 'Phone', mobile: 'Phone',
    date_of_birth: 'Date of Birth', dob: 'Date of Birth', dateofbirth: 'Date of Birth', birthday: 'Date of Birth', birth_date: 'Date of Birth', birthdate: 'Date of Birth',
    address: 'Address', street: 'Address', street_address: 'Address',
    city: 'City', town: 'City',
    state: 'State', province: 'State', region: 'State',
    zip: 'ZIP Code', zip_code: 'ZIP Code', zipcode: 'ZIP Code', postal_code: 'ZIP Code', postalcode: 'ZIP Code',
    country: 'Country',
    status: 'Status',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Contacts
          </CardTitle>
          <CardDescription>
            Upload a CSV file to import contacts in bulk. The file should include headers like email, first_name, last_name, phone_number, date_of_birth, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template download */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
            <span className="text-sm text-muted-foreground">Use this template as a starting point</span>
          </div>

          {/* Drop zone */}
          {!file && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Drop your CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Maximum 5,000 contacts per file, 10MB limit</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Selected file info */}
          {file && !result && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB — {totalRows} row{totalRows !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear} disabled={uploading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Column recognition */}
          {headers.length > 0 && !result && (
            <div>
              <p className="text-sm font-medium mb-2">Detected Columns:</p>
              <div className="flex flex-wrap gap-2">
                {headers.map((h) => {
                  const recognized = knownColumns[h];
                  return (
                    <Badge key={h} variant={recognized ? 'default' : 'secondary'}>
                      {recognized ? `${recognized} (${h})` : h}
                      {!recognized && (
                        <span className="ml-1 text-xs opacity-70">— ignored</span>
                      )}
                    </Badge>
                  );
                })}
              </div>
              {!headers.some(h => ['email', 'email_address', 'e-mail', 'e_mail'].includes(h)) && (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>
                    No email column detected. Your CSV must include an "email" column.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && !result && (
            <div>
              <p className="text-sm font-medium mb-2">Preview (first {preview.length} rows):</p>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      {headers.filter(h => knownColumns[h]).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">
                          {knownColumns[h]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {headers.filter(h => knownColumns[h]).map((h) => (
                          <td key={h} className="px-3 py-2 max-w-[200px] truncate">
                            {row[h] || <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload button */}
          {file && !result && (
            <Button onClick={handleUpload} disabled={uploading} className="w-full sm:w-auto">
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing {totalRows} contacts...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {totalRows} Contact{totalRows !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <Alert variant={result.created > 0 ? 'default' : 'destructive'}>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Import complete: <strong>{result.created}</strong> contact{result.created !== 1 ? 's' : ''} created
                  {result.skipped > 0 && <>, <strong>{result.skipped}</strong> skipped</>}
                  {' '}out of <strong>{result.total}</strong> total rows.
                </AlertDescription>
              </Alert>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{result.created} created</span>
                  <span>{result.skipped} skipped</span>
                </div>
                <Progress value={result.total > 0 ? (result.created / result.total) * 100 : 0} />
              </div>

              {/* Error details */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Skipped Rows ({result.errors.length}{result.hasMoreErrors ? '+' : ''})
                  </p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-muted sticky top-0">
                          <th className="px-3 py-2 text-left font-medium">Row</th>
                          <th className="px-3 py-2 text-left font-medium">Email</th>
                          <th className="px-3 py-2 text-left font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((err, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5">{err.row || '—'}</td>
                            <td className="px-3 py-1.5">{err.email || '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={handleClear}>
                Import Another File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supported CSV Columns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">email</code> <span className="text-muted-foreground">— required</span></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">first_name</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">last_name</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">phone_number</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">date_of_birth</code> <span className="text-muted-foreground">— YYYY-MM-DD or MM/DD/YYYY</span></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">address</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">city</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">state</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">zip_code</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">country</code></div>
            <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">status</code> <span className="text-muted-foreground">— defaults to "active"</span></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Column headers are flexible — e.g., "Email Address", "First Name", "DOB", "Phone" all work.
            Unrecognized columns are ignored. Duplicate emails (already in your contacts or within the file) are skipped.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
