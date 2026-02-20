/**
 * Live Newsletter Tracking Panel
 * 
 * Real-time dashboard component showing newsletter send progress,
 * delivery stats, and a live event feed powered by Convex.
 */

import { useNewsletterStats, useNewsletterEvents, useStatusBreakdown } from "@/hooks/useNewsletterTracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Send,
  CheckCircle,
  Eye,
  MousePointer,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  Mail,
  ShieldOff,
} from "lucide-react";

interface LiveTrackingPanelProps {
  newsletterId: string;
}

function formatEventDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const eventTypeConfig: Record<string, { icon: typeof Send; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-gray-500", label: "Queued" },
  sent: { icon: Send, color: "text-blue-500", label: "Sent" },
  delivered: { icon: CheckCircle, color: "text-green-500", label: "Delivered" },
  opened: { icon: Eye, color: "text-purple-500", label: "Opened" },
  clicked: { icon: MousePointer, color: "text-indigo-500", label: "Clicked" },
  bounced: { icon: AlertTriangle, color: "text-orange-500", label: "Bounced" },
  complained: { icon: XCircle, color: "text-red-500", label: "Complained" },
  suppressed: { icon: ShieldOff, color: "text-yellow-600", label: "Suppressed" },
  failed: { icon: XCircle, color: "text-red-600", label: "Failed" },
  unsubscribed: { icon: XCircle, color: "text-yellow-600", label: "Unsubscribed" },
};

export function LiveTrackingPanel({ newsletterId }: LiveTrackingPanelProps) {
  const stats = useNewsletterStats(newsletterId);
  const breakdown = useStatusBreakdown(newsletterId);
  const events = useNewsletterEvents(newsletterId, { limit: 20 });

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Activity className="h-4 w-4 animate-pulse mr-2" />
        Loading live tracking...
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tracking data yet.</p>
        <p className="text-xs mt-1">Data will appear here once the newsletter starts sending.</p>
      </div>
    );
  }

  const progress = stats.totalRecipients > 0
    ? Math.round(((stats.sent + stats.failed + (stats.suppressed ?? 0)) / stats.totalRecipients) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Status & Progress */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Tracking
            </CardTitle>
            <Badge
              variant={
                stats.status === "completed" ? "default" :
                stats.status === "sending" ? "secondary" : "outline"
              }
            >
              {stats.status === "sending" && (
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              {stats.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.sent + stats.failed + (stats.suppressed ?? 0)} / {stats.totalRecipients} processed</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {stats.lastEventAt && (
              <p className="text-xs text-muted-foreground">
                Last event: {formatTimeAgo(stats.lastEventAt)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Send} label="Sent" value={stats.sent} color="text-blue-500" />
        <StatCard icon={CheckCircle} label="Delivered" value={stats.delivered} color="text-green-500" />
        <StatCard icon={Eye} label="Unique Opens" value={stats.uniqueOpens} color="text-purple-500" />
        <StatCard icon={MousePointer} label="Unique Clicks" value={stats.uniqueClicks} color="text-indigo-500" />
      </div>

      {/* Rates */}
      {breakdown && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <RateItem label="Delivery Rate" value={breakdown.rates.deliveryRate} />
              <RateItem label="Open Rate" value={breakdown.rates.openRate} />
              <RateItem label="Click Rate" value={breakdown.rates.clickRate} />
              <RateItem label="Bounce Rate" value={breakdown.rates.bounceRate} negative />
              <RateItem label="Suppression Rate" value={breakdown.rates.suppressionRate} negative />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={AlertTriangle} label="Bounced" value={stats.bounced} color="text-orange-500" small />
        <StatCard icon={ShieldOff} label="Suppressed" value={stats.suppressed ?? 0} color="text-yellow-600" small />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} color="text-red-500" small />
        <StatCard icon={XCircle} label="Complained" value={stats.complained} color="text-red-600" small />
      </div>

      {/* Live Event Feed */}
      {events && events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Events
              {stats.status === "sending" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {events.map((event) => {
                const config = eventTypeConfig[event.eventType] || eventTypeConfig.sent;
                const Icon = config.icon;
                return (
                  <div
                    key={event._id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded text-xs hover:bg-muted/50 transition-colors"
                  >
                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${config.color}`} />
                    <span className="font-medium min-w-[70px]">{config.label}</span>
                    <span className="text-muted-foreground truncate flex-1">
                      {event.recipientEmail}
                    </span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {formatEventDateTime(event.occurredAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  small,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  color: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className={small ? "p-3" : "p-4"}>
        <div className="flex items-center gap-2">
          <Icon className={`${small ? "h-3.5 w-3.5" : "h-4 w-4"} ${color}`} />
          <div>
            <p className={`${small ? "text-lg" : "text-2xl"} font-bold`}>
              {value.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RateItem({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  const numValue = parseFloat(value);
  const colorClass = negative
    ? numValue > 5 ? "text-red-600" : "text-green-600"
    : numValue > 20 ? "text-green-600" : numValue > 10 ? "text-yellow-600" : "text-muted-foreground";

  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${colorClass}`}>{value}%</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
