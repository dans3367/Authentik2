/**
 * ActivityFeed Component
 * 
 * Displays a timeline of activity logs with user information, timestamps, and change details.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { useEntityActivityLogs } from "@/hooks/useActivityLogs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Plus,
    Pencil,
    Trash2,
    Send,
    Calendar,
    Archive,
    XCircle,
    Activity,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityLogWithUser } from "@shared/schema";

interface ActivityFeedProps {
    entityType: string;
    entityId: string;
    limit?: number;
    className?: string;
}

// Activity type to icon mapping
const activityIcons: Record<string, React.ReactNode> = {
    created: <Plus className="h-4 w-4" />,
    updated: <Pencil className="h-4 w-4" />,
    deleted: <Trash2 className="h-4 w-4" />,
    sent: <Send className="h-4 w-4" />,
    scheduled: <Calendar className="h-4 w-4" />,
    archived: <Archive className="h-4 w-4" />,
    cancelled: <XCircle className="h-4 w-4" />,
};

// Activity type to color mapping
const activityColors: Record<string, string> = {
    created: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    updated: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    deleted: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    sent: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    scheduled: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    archived: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

interface ActivityItemProps {
    activity: ActivityLogWithUser;
}

function ActivityItem({ activity }: ActivityItemProps) {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);

    const hasChanges = activity.changes && Object.keys(activity.changes).length > 0;

    const icon = activityIcons[activity.activityType] || <Activity className="h-4 w-4" />;
    const colorClass = activityColors[activity.activityType] || "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400";

    const userName = activity.user?.firstName && activity.user?.lastName
        ? `${activity.user.firstName} ${activity.user.lastName}`
        : activity.user?.email || t('activityFeed.unknownUser');

    const userInitials = activity.user?.firstName && activity.user?.lastName
        ? `${activity.user.firstName[0]}${activity.user.lastName[0]}`
        : activity.user?.email?.[0]?.toUpperCase() || '?';

    const formattedTime = activity.createdAt
        ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
        : '';

    return (
        <div className="flex gap-3 py-3 group">
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colorClass)}>
                    {icon}
                </div>
                <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-2 group-last:hidden" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={activity.user?.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs bg-gray-100 dark:bg-gray-800">
                                {userInitials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                            {userName}
                        </span>
                        <Badge variant="outline" className={cn("text-xs shrink-0", colorClass)}>
                            {t(`activityFeed.types.${activity.activityType}`, { defaultValue: activity.activityType })}
                        </Badge>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                        {formattedTime}
                    </span>
                </div>

                {activity.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {activity.description}
                    </p>
                )}

                {/* Expandable changes section */}
                {hasChanges && (
                    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                {isOpen ? (
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                ) : (
                                    <ChevronRight className="h-3 w-3 mr-1" />
                                )}
                                {t('activityFeed.viewChanges', { count: Object.keys(activity.changes!).length })}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
                                {Object.entries(activity.changes!).map(([field, values]) => {
                                    const changeValues = values as unknown as { old: any; new: any };
                                    return (
                                        <div key={field} className="flex items-start gap-2 text-sm">
                                            <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[100px]">
                                                {t(`activityFeed.fields.${field}`, { defaultValue: field })}:
                                            </span>
                                            <div className="flex-1">
                                                <span className="line-through text-gray-400 dark:text-gray-500">
                                                    {formatValue(changeValues.old)}
                                                </span>
                                                <span className="mx-2 text-gray-400">→</span>
                                                <span className="text-gray-900 dark:text-gray-100">
                                                    {formatValue(changeValues.new)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </div>
        </div>
    );
}

function formatValue(value: any): string {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function ActivityFeedSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ActivityFeed({ entityType, entityId, limit = 20, className }: ActivityFeedProps) {
    const { t } = useTranslation();
    const { data, isLoading, error } = useEntityActivityLogs(entityType, entityId, { limit });

    if (isLoading) {
        return <ActivityFeedSkeleton />;
    }

    if (error) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('activityFeed.errorLoading')}</p>
            </div>
        );
    }

    if (!data?.logs.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Activity className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('activityFeed.noActivity')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    {t('activityFeed.noActivityDescription')}
                </p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-0", className)}>
            {data.logs.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
            ))}

            {data.pagination.hasMore && (
                <div className="pt-4 text-center">
                    <Button variant="ghost" size="sm" className="text-gray-500">
                        {t('activityFeed.loadMore')}
                    </Button>
                </div>
            )}
        </div>
    );
}
