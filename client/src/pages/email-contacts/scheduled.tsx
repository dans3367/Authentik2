import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, Send, Calendar, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TemplateSelector } from "@/components/TemplateSelector";

interface ScheduledEmail {
  id: string;
  to: string[];
  subject: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  providerId?: string;
  metadata?: Record<string, any>;
  html?: string;
  text?: string;
}

export default function ScheduledEmailsTimelinePage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ queueId?: string; subject: string; content: string; date: string; time: string }>({ subject: "", content: "", date: "", time: "" });

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ scheduled: ScheduledEmail[]}>({
    queryKey: ["/api/email-contacts", id, "scheduled"],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/email-contacts/${id}/scheduled`);
      if (!res.ok) {
        throw new Error("Failed to load scheduled emails");
      }
      return res.json();
    },
    // Ensure we always fetch fresh data on mount, focus, and reconnect
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 15000,
  });

  const scheduled = data?.scheduled || [];

  const openEdit = (item: ScheduledEmail) => {
    const dt = new Date(item.scheduledAt);
    const yyyy = dt.toISOString().slice(0, 10);
    const hhmm = dt.toISOString().slice(11, 16);
    setForm({ queueId: item.id, subject: item.subject || "", content: item.html || "", date: yyyy, time: hhmm });
    setEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!form.queueId) return;
      const scheduleAt = new Date(`${form.date}T${form.time || "00:00"}`).toISOString();
      const res = await apiRequest("PUT", `/api/email-contacts/${id}/scheduled/${form.queueId}`, {
        subject: form.subject,
        html: form.content,
        scheduleAt,
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      setEditOpen(false);
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const res = await apiRequest("DELETE", `/api/email-contacts/${id}/scheduled/${queueId}`);
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      setDeleteOpen(null);
      refetch();
    },
  });

  const handleTemplateSelect = (template: { subject: string; content: string }) => {
    setForm({ ...form, subject: template.subject, content: template.content });
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate(`/email-contacts/view/${id}`)} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contact
            </Button>
            <h1 className="text-2xl font-bold">Scheduled Emails</h1>
            <p className="text-gray-600 dark:text-gray-400">Upcoming scheduled sends for this contact</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
            <Button onClick={() => navigate(`/email-contacts/view/${id}/schedule`)}>
              <Clock className="w-4 h-4 mr-2" /> New Scheduled Email
            </Button>
          </div>
        </div>

        {/* Loading/Error */}
        {isLoading && (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        {error && (
          <Card>
            <CardContent className="text-red-600 p-6">Failed to load scheduled emails.</CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No scheduled emails for this contact.
              </div>
            ) : (
              <div className="space-y-6">
                {scheduled.map((item, idx) => (
                  <div key={item.id} className="relative pl-8">
                    {/* Line */}
                    {idx !== scheduled.length - 1 && (
                      <div className="absolute left-3 top-5 bottom-[-12px] w-px bg-gray-200 dark:bg-gray-700" />
                    )}
                    {/* Dot */}
                    <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-blue-600" />
                    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{new Date(item.scheduledAt).toLocaleString()}</Badge>
                            <Badge variant="secondary">{item.status === 'retrying' ? 'Scheduled' : item.status}</Badge>
                          </div>
                          <div className="mt-2 font-medium truncate">{item.subject}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <Mail className="h-4 w-4" /> to {item.to?.[0] || "(unknown)"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-gray-500 whitespace-nowrap">Created {new Date(item.createdAt).toLocaleString()}</div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                            <Button variant="outline" size="sm" className="text-red-600" onClick={() => setDeleteOpen(item.id)}>Delete</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Scheduled Email</DialogTitle>
              <DialogDescription>Update subject, content, or schedule time.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Message Content</Label>
                <TemplateSelector onSelect={handleTemplateSelect} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input className="mt-2" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea className="mt-2 min-h-[140px]" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" className="mt-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input type="time" className="mt-2" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteOpen} onOpenChange={(o) => { if (!o) setDeleteOpen(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Scheduled Email</DialogTitle>
              <DialogDescription>This will remove the scheduled email from the queue.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteOpen(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => deleteOpen && deleteMutation.mutate(deleteOpen)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
