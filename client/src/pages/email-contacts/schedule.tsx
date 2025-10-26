import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Calendar, Clock, Mail, AlertTriangle } from "lucide-react";
import { TemplateSelector } from "@/components/TemplateSelector";

export default function ScheduleContactEmailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isUsingTemplate, setIsUsingTemplate] = useState(false);

  // Load contact for context and validation
  const { data: contactResp, isLoading: contactLoading, error: contactError } = useQuery({
    queryKey: ["/api/email-contacts", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/email-contacts/${id}`);
      if (!res.ok) throw new Error("Failed to load contact");
      return res.json();
    },
  });

  const contact = (contactResp as any)?.contact;

  // Bounce/suppression check
  const { data: bouncedCheck } = useQuery({
    queryKey: ["/api/bounced-emails/check", contact?.email],
    enabled: !!contact?.email,
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest("GET", `/api/bounced-emails/check/${encodeURIComponent(String(queryKey[1]))}`);
      return res.json();
    },
  });

  const isSuppressed = contact?.status === "unsubscribed" || contact?.status === "bounced" || !!bouncedCheck?.isBounced;

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      // Build ISO datetime from date + time
      const dt = new Date(`${date}T${time || "00:00"}`);
      return apiRequest("POST", `/api/email-contacts/${id}/schedule`, {
        subject,
        html: content,
        scheduleAt: dt.toISOString(),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      navigate(`/email-contacts/view/${id}`);
    },
  });

  const scheduleDisabledReason = (() => {
    if (contact?.status === "unsubscribed") return "This contact has unsubscribed from emails.";
    if (contact?.status === "bounced" || !!bouncedCheck?.isBounced) return "This address is bounced or globally suppressed.";
    return undefined;
  })();

  const canSubmit = !!subject && !!content && !!date && !!id && !isSuppressed;

  const handleTemplateSelect = (template: { subject: string; content: string }) => {
    setSubject(template.subject);
    setContent(template.content);
    setIsUsingTemplate(true);
  };

  const handleUseCustomMessage = () => {
    setIsUsingTemplate(false);
    // Clear content if switching from template
    if (isUsingTemplate) {
      setSubject("");
      setContent("");
    }
  };

  if (contactLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (contactError || !contact) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(`/email-contacts/view/${id}`)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contact
          </Button>
          <Alert>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load contact.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate(`/email-contacts/view/${id}`)} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contact
            </Button>
            <h1 className="text-2xl font-bold">Schedule Email</h1>
            <p className="text-gray-600 dark:text-gray-400">Send a B2C email to {contact.email} at a later time.</p>
          </div>
        </div>

        {isSuppressed && (
          <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm font-medium">Sending disabled</AlertTitle>
            <AlertDescription className="text-sm">{scheduleDisabledReason}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Message</CardTitle>
            <div className="flex gap-2">
              {isUsingTemplate && (
                <Button variant="outline" type="button" onClick={handleUseCustomMessage}>
                  Use Custom Message
                </Button>
              )}
              <TemplateSelector onSelect={handleTemplateSelect} channel="individual" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>To</Label>
              <Input value={contact.email} disabled className="mt-2" />
            </div>
            <div>
              <Label>Subject</Label>
              <Input 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                placeholder="Subject..." 
                className="mt-2" 
                disabled={isUsingTemplate}
              />
            </div>
            <div>
              <Label>Content</Label>
              {isUsingTemplate ? (
                <div 
                  className="mt-2 min-h-[220px] p-3 rounded-md border border-input bg-gray-50 dark:bg-gray-900 text-sm overflow-auto"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <Textarea 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  placeholder="Write your email..." 
                  className="mt-2 min-h-[220px]" 
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`/email-contacts/view/${id}`)}>
            Cancel
          </Button>
          <Button onClick={() => scheduleMutation.mutate()} disabled={!canSubmit || scheduleMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            <Clock className="w-4 h-4 mr-2" /> {scheduleMutation.isPending ? "Scheduling..." : "Schedule Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
