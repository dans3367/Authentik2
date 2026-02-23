/**
 * ReactionInsightsSection
 * 
 * Premium UI component displaying newsletter reaction analytics.
 * Shows emoji breakdown, sentiment score, and recent reactions.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Smile, TrendingUp, Heart, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Reaction metadata ──────────────────────────────────────────────────

const REACTION_CONFIG = {
    love_it: {
        emoji: '❤️',
        label: 'Love it',
        gradient: 'from-rose-500 to-pink-600',
        bgLight: 'bg-rose-50',
        bgDark: 'dark:bg-rose-950/30',
        textColor: 'text-rose-600 dark:text-rose-400',
        barColor: 'from-rose-400 to-pink-500',
        borderColor: 'border-rose-200 dark:border-rose-800/50',
    },
    liked_it: {
        emoji: '👍',
        label: 'Liked it',
        gradient: 'from-blue-500 to-indigo-600',
        bgLight: 'bg-blue-50',
        bgDark: 'dark:bg-blue-950/30',
        textColor: 'text-blue-600 dark:text-blue-400',
        barColor: 'from-blue-400 to-indigo-500',
        borderColor: 'border-blue-200 dark:border-blue-800/50',
    },
    cool: {
        emoji: '😎',
        label: 'Cool',
        gradient: 'from-amber-500 to-orange-600',
        bgLight: 'bg-amber-50',
        bgDark: 'dark:bg-amber-950/30',
        textColor: 'text-amber-600 dark:text-amber-400',
        barColor: 'from-amber-400 to-orange-500',
        borderColor: 'border-amber-200 dark:border-amber-800/50',
    },
    dont_agree: {
        emoji: '🤔',
        label: "Don't agree",
        gradient: 'from-purple-500 to-violet-600',
        bgLight: 'bg-purple-50',
        bgDark: 'dark:bg-purple-950/30',
        textColor: 'text-purple-600 dark:text-purple-400',
        barColor: 'from-purple-400 to-violet-500',
        borderColor: 'border-purple-200 dark:border-purple-800/50',
    },
    dislike: {
        emoji: '👎',
        label: 'Dislike',
        gradient: 'from-red-500 to-rose-600',
        bgLight: 'bg-red-50',
        bgDark: 'dark:bg-red-950/30',
        textColor: 'text-red-600 dark:text-red-400',
        barColor: 'from-red-400 to-rose-500',
        borderColor: 'border-red-200 dark:border-red-800/50',
    },
} as const;

type ReactionType = keyof typeof REACTION_CONFIG;

interface ReactionStats {
    newsletterId: string;
    reactionsEnabled: boolean;
    totalReactions: number;
    counts: Record<string, number>;
    sentimentScore: number;
    dominantReaction: string | null;
    recentReactions: {
        id: string;
        recipientEmail: string;
        reactionType: string;
        reactedAt: string;
    }[];
    reactionMeta: Record<string, { emoji: string; label: string }>;
}

// ── Sentiment helpers ──────────────────────────────────────────────────

function getSentimentLabel(score: number): { label: string; color: string; emoji: string } {
    if (score >= 4.5) return { label: 'Outstanding', color: 'text-emerald-600 dark:text-emerald-400', emoji: '🌟' };
    if (score >= 3.5) return { label: 'Very Positive', color: 'text-green-600 dark:text-green-400', emoji: '😊' };
    if (score >= 2.5) return { label: 'Neutral', color: 'text-amber-600 dark:text-amber-400', emoji: '😐' };
    if (score >= 1.5) return { label: 'Mixed', color: 'text-orange-600 dark:text-orange-400', emoji: '🤨' };
    return { label: 'Negative', color: 'text-red-600 dark:text-red-400', emoji: '😔' };
}

function getSentimentGradient(score: number): string {
    if (score >= 4) return 'from-emerald-400 to-green-500';
    if (score >= 3) return 'from-amber-400 to-yellow-500';
    if (score >= 2) return 'from-orange-400 to-amber-500';
    return 'from-red-400 to-rose-500';
}

// ── Component ──────────────────────────────────────────────────────────

interface Props {
    newsletterId: string;
}

export function ReactionInsightsSection({ newsletterId }: Props) {
    const { data: stats, isLoading, error, refetch, isFetching } = useQuery<ReactionStats>({
        queryKey: ['newsletter-reactions', newsletterId],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/newsletter-reactions/${newsletterId}/stats`);
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30 seconds
        staleTime: 0, // Always consider data stale so refetches work immediately
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Smile className="h-5 w-5 text-pink-500" strokeWidth={1.5} />
                        Reader Reactions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-5 gap-3">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-24 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-32 rounded-xl" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-dashed border-red-300 dark:border-red-700">
                <CardContent className="py-8 text-center">
                    <Smile className="h-10 w-10 text-red-300 dark:text-red-600 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-red-500 dark:text-red-400 mb-3">
                        Failed to load reaction data
                    </p>
                    <button
                        onClick={() => refetch()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Try again
                    </button>
                </CardContent>
            </Card>
        );
    }

    if (!stats) {
        return null;
    }

    if (!stats.reactionsEnabled) {
        return (
            <Card className="border-dashed border-gray-300 dark:border-gray-700">
                <CardContent className="py-8 text-center">
                    <Smile className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Reader reactions are disabled for this newsletter
                    </p>
                </CardContent>
            </Card>
        );
    }

    const totalReactions = stats.totalReactions;
    const sentiment = getSentimentLabel(stats.sentimentScore);
    const sentimentPercent = totalReactions > 0 ? ((stats.sentimentScore / 5) * 100) : 0;

    const orderedReactions: ReactionType[] = ['love_it', 'liked_it', 'cool', 'dont_agree', 'dislike'];

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                            <Smile className="h-4 w-4 text-white" strokeWidth={1.5} />
                        </div>
                        Reader Reactions
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {totalReactions > 0 && (
                            <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
                                {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
                            </Badge>
                        )}
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                            title="Refresh reactions"
                        >
                            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
                <CardDescription className="mt-1.5">
                    How your readers are feeling about this newsletter
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {totalReactions === 0 ? (
                    <div className="text-center py-8 px-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">💬</span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
                            No Reactions Yet
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                            Reactions will appear here as readers respond to your newsletter. Reactions typically start arriving within a few hours of sending.
                        </p>
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                            {isFetching ? 'Checking...' : 'Check for reactions'}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Reaction Breakdown */}
                        <div className="space-y-3">
                            {orderedReactions.map((type) => {
                                const config = REACTION_CONFIG[type];
                                const count = stats.counts[type] || 0;
                                const percent = totalReactions > 0 ? Math.round((count / totalReactions) * 100) : 0;

                                return (
                                    <div key={type} className="group">
                                        <div className="flex items-center gap-3">
                                            {/* Emoji + Label */}
                                            <div className={`flex items-center gap-2 min-w-[120px] p-2 rounded-lg ${config.bgLight} ${config.bgDark} border ${config.borderColor}`}>
                                                <span className="text-xl">{config.emoji}</span>
                                                <span className={`text-xs font-semibold ${config.textColor}`}>{config.label}</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="flex-1">
                                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3.5 overflow-hidden">
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${config.barColor} rounded-full transition-all duration-1000 ease-out`}
                                                        style={{ width: `${Math.max(percent > 0 ? 3 : 0, percent)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Count + Percentage */}
                                            <div className="flex items-center gap-2 min-w-[70px] justify-end">
                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{count}</span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">({percent}%)</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sentiment Score & Dominant Reaction */}
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Sentiment Score */}
                            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800/30 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="h-4 w-4 text-indigo-500" strokeWidth={1.5} />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sentiment Score</span>
                                </div>
                                <div className="flex items-end gap-3 mb-3">
                                    <span className="text-3xl">{sentiment.emoji}</span>
                                    <div>
                                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                            {stats.sentimentScore.toFixed(1)}
                                            <span className="text-base font-normal text-gray-400 dark:text-gray-500">/5</span>
                                        </p>
                                        <p className={`text-sm font-semibold ${sentiment.color}`}>{sentiment.label}</p>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full bg-gradient-to-r ${getSentimentGradient(stats.sentimentScore)} rounded-full transition-all duration-1000`}
                                        style={{ width: `${sentimentPercent}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1.5">
                                    <span className="text-[10px] text-gray-400">Negative</span>
                                    <span className="text-[10px] text-gray-400">Positive</span>
                                </div>
                            </div>

                            {/* Dominant Reaction */}
                            {stats.dominantReaction && REACTION_CONFIG[stats.dominantReaction as ReactionType] && (
                                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800/30 p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Heart className="h-4 w-4 text-rose-500" strokeWidth={1.5} />
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dominant Reaction</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${REACTION_CONFIG[stats.dominantReaction as ReactionType].gradient} flex items-center justify-center shadow-lg`}>
                                            <span className="text-3xl">{REACTION_CONFIG[stats.dominantReaction as ReactionType].emoji}</span>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                                {REACTION_CONFIG[stats.dominantReaction as ReactionType].label}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {stats.counts[stats.dominantReaction]} of {totalReactions} readers
                                                ({totalReactions > 0 ? Math.round((stats.counts[stats.dominantReaction] / totalReactions) * 100) : 0}%)
                                            </p>
                                        </div>
                                    </div>

                                    {/* Positive vs Negative breakdown */}
                                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <ThumbsUp className="h-3 w-3 text-green-500" strokeWidth={1.5} />
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Positive: <span className="font-semibold text-green-600 dark:text-green-400">
                                                        {(stats.counts['love_it'] || 0) + (stats.counts['liked_it'] || 0) + (stats.counts['cool'] || 0)}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <ThumbsDown className="h-3 w-3 text-red-500" strokeWidth={1.5} />
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Negative: <span className="font-semibold text-red-600 dark:text-red-400">
                                                        {(stats.counts['dont_agree'] || 0) + (stats.counts['dislike'] || 0)}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recent Reactions */}
                        {stats.recentReactions.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                                    <span>Recent Reactions</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        Latest {Math.min(stats.recentReactions.length, 10)}
                                    </Badge>
                                </h4>
                                <div className="space-y-2">
                                    {stats.recentReactions.slice(0, 10).map((reaction) => {
                                        const config = REACTION_CONFIG[reaction.reactionType as ReactionType];
                                        if (!config) return null;

                                        return (
                                            <div
                                                key={reaction.id}
                                                className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                                            >
                                                <span className="text-lg">{config.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                                        {reaction.recipientEmail}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`text-[10px] px-1.5 py-0 h-5 ${config.bgLight} ${config.bgDark} ${config.textColor} border ${config.borderColor}`}>
                                                        {config.label}
                                                    </Badge>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                                        {formatDistanceToNow(new Date(reaction.reactedAt + 'Z'), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
