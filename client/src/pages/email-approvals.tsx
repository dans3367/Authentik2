import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { ShieldCheck, Mail, Clock, CheckCircle, XCircle, Link as LinkIcon } from "lucide-react";

type TrackingEntry = {
  id: string;
  emailId: string;
  status: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "awaiting_approval") return { className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", icon: <Clock className="h-3 w-3" /> };
  if (s === "approved") return { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: <ShieldCheck className="h-3 w-3" /> };
  if (s === "sent") return { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: <CheckCircle className="h-3 w-3" /> };
  if (s === "failed" || s === "approval_timeout") return { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: <XCircle className="h-3 w-3" /> };
  return { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: <Mail className="h-3 w-3" /> };
}

export default function EmailApprovalsPage() {
  const { toast } = useToast();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  const { data: trackingData, isLoading } = useQuery({
    queryKey: ["/go-server-tracking", accessToken],
    queryFn: async () => {
      if (!accessToken) return { entries: [], count: 0 };
      const response = await fetch("https://tenginew.zendwise.work/api/email-tracking", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch tracking entries");
      return response.json();
    },
    enabled: !!accessToken,
    refetchInterval: 10_000,
  });

  const approvalEntries: TrackingEntry[] = useMemo(() => {
    const entries: TrackingEntry[] = trackingData?.entries || [];
    return entries.filter((e) => e?.metadata?.requiresReviewerApproval === true);
  }, [trackingData]);

  // Note: Reviewer notifications are now handled automatically by Temporal workflows
  // This manual resend functionality is deprecated in favor of the integrated approach

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review & Approvals</h1>
          <p className="text-sm text-muted-foreground">View approval status and copy approval links</p>
        </div>
      </div>

      <Card className="shadow-lg border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Approvals Queue
          </CardTitle>
          <CardDescription>Campaigns requiring reviewer approval</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600" /> Loading approvals...
            </div>
          ) : approvalEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns awaiting approval.</p>
          ) : (
            <div className="space-y-4">
              {approvalEntries.map((entry) => {
                const badge = getStatusBadge(entry.status);
                const reviewerId = entry?.metadata?.reviewerId as string | undefined;
                const reviewerLabel = entry?.metadata?.reviewerEmail || reviewerId || "Unknown reviewer";
                const subject = entry?.metadata?.subject as string | undefined;
                return (
                  <div key={entry.id} className="p-4 border rounded-lg bg-card">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={`${badge.className} gap-1`}>{badge.icon}<span>{entry.status}</span></Badge>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{entry.emailId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {subject ? <span>Subject: {subject} • </span> : null}
                          Reviewer: {reviewerLabel}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated: {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry?.metadata?.approveUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(entry.metadata.approveUrl);
                                toast({ title: "Link copied" });
                              } catch {}
                            }}
                          >
                            <LinkIcon className="h-4 w-4 mr-1" /> Copy Link
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <Separator />
              <div className="text-xs text-muted-foreground">Showing {approvalEntries.length} approval item(s)</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}







