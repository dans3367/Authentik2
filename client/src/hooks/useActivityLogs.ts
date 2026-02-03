/**
 * useActivityLogs Hook
 * 
 * React Query hook for fetching activity logs with filtering and pagination support.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ActivityLogWithUser } from "@shared/schema";

export interface ActivityLogFilters {
    entityType?: string;
    entityId?: string;
    activityType?: string;
    limit?: number;
    offset?: number;
}

export interface ActivityLogsResponse {
    logs: ActivityLogWithUser[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
}

/**
 * Fetch activity logs with optional filtering
 */
export function useActivityLogs(filters: ActivityLogFilters = {}) {
    const queryParams = new URLSearchParams();

    if (filters.entityType) queryParams.set('entityType', filters.entityType);
    if (filters.entityId) queryParams.set('entityId', filters.entityId);
    if (filters.activityType) queryParams.set('activityType', filters.activityType);
    if (filters.limit) queryParams.set('limit', String(filters.limit));
    if (filters.offset) queryParams.set('offset', String(filters.offset));

    const queryString = queryParams.toString();
    const url = `/api/activity-logs${queryString ? `?${queryString}` : ''}`;

    return useQuery<ActivityLogsResponse>({
        queryKey: ['activity-logs', filters],
        queryFn: async () => {
            const response = await apiRequest('GET', url);
            return response.json();
        },
        staleTime: 30 * 1000, // 30 seconds
    });
}

/**
 * Fetch activity logs for a specific entity
 */
export function useEntityActivityLogs(
    entityType: string,
    entityId: string,
    options: { limit?: number; offset?: number; enabled?: boolean } = {}
) {
    const { limit = 20, offset = 0, enabled = true } = options;

    return useQuery<ActivityLogsResponse>({
        queryKey: ['activity-logs', 'entity', entityType, entityId, { limit, offset }],
        queryFn: async () => {
            const response = await apiRequest(
                'GET',
                `/api/activity-logs/entity/${entityType}/${entityId}?limit=${limit}&offset=${offset}`
            );
            return response.json();
        },
        enabled: enabled && !!entityType && !!entityId,
        staleTime: 30 * 1000,
    });
}
