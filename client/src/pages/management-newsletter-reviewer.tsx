import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Save,
    RotateCcw,
    ShieldCheck,
    ShieldAlert,
    UserCheck,
    FileCheck2,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    Send,
    Info,
} from "lucide-react";

interface ReviewerUser {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string;
    role: string;
    avatarUrl: string | null;
}

interface ReviewerSettings {
    enabled: boolean;
    reviewerId: string | null;
    reviewer: ReviewerUser | null;
}

function getUserInitials(firstName?: string | null, lastName?: string | null, name?: string | null): string {
    if (firstName || lastName) {
        return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
    }
    if (name) {
        return name.split(" ").map((n) => n.charAt(0)).join("").toUpperCase().slice(0, 2);
    }
    return "?";
}

function getRoleBadgeStyle(role: string) {
    switch (role) {
        case "Owner":
            return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
        case "Administrator":
            return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
        case "Manager":
            return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
        default:
            return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
}

export default function ManagementNewsletterReviewer() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { user } = useReduxAuth();
    const queryClient = useQueryClient();

    const currentUser = user as { id: string; role?: string } | null;
    const isAdmin = currentUser?.role === "Owner" || currentUser?.role === "Administrator";

    // Form state
    const [enabled, setEnabled] = useState(false);
    const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch reviewer settings
    const { data: settings, isLoading: settingsLoading } = useQuery<ReviewerSettings>({
        queryKey: ["/api/newsletters/reviewer-settings"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/newsletters/reviewer-settings");
            return res.json();
        },
    });

    // Fetch tenant users for reviewer selection
    const { data: usersData, isLoading: usersLoading } = useQuery<{ users: ReviewerUser[] }>({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            return res.json();
        },
    });

    // Initialize form from settings
    useEffect(() => {
        if (settings && !hasChanges) {
            setEnabled(settings.enabled);
            setSelectedReviewerId(settings.reviewerId);
        }
    }, [settings, hasChanges]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (data: { enabled: boolean; reviewerId: string | null }) => {
            const res = await apiRequest("PUT", "/api/newsletters/reviewer-settings", data);
            return res.json();
        },
        onSuccess: (data: ReviewerSettings) => {
            queryClient.setQueryData(["/api/newsletters/reviewer-settings"], data);
            setHasChanges(false);
            toast({
                title: "Settings saved",
                description: data.enabled
                    ? `Newsletter reviewer approval enabled${data.reviewer ? ` with ${data.reviewer.email}` : ""}`
                    : "Newsletter reviewer approval disabled",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save reviewer settings",
                variant: "destructive",
            });
        },
    });

    const handleSave = () => {
        if (enabled && !selectedReviewerId) {
            toast({
                title: "Reviewer required",
                description: "Please select a reviewer before enabling the approval workflow",
                variant: "destructive",
            });
            return;
        }
        saveMutation.mutate({ enabled, reviewerId: selectedReviewerId });
    };

    const handleReset = () => {
        if (settings) {
            setEnabled(settings.enabled);
            setSelectedReviewerId(settings.reviewerId);
            setHasChanges(false);
            toast({
                title: "Changes discarded",
                description: "Reverted to the last saved settings.",
            });
        }
    };

    const handleEnabledChange = (checked: boolean) => {
        setEnabled(checked);
        setHasChanges(true);
    };

    const handleReviewerChange = (value: string) => {
        setSelectedReviewerId(value === "none" ? null : value);
        setHasChanges(true);
    };

    // Get all users except the current user (can't review your own)
    const availableReviewers = (usersData?.users || []).filter(
        (u: ReviewerUser) => ["Owner", "Administrator", "Manager"].includes(u.role)
    );

    const selectedReviewer = availableReviewers.find((u: ReviewerUser) => u.id === selectedReviewerId);

    if (settingsLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <FileCheck2 className="w-10 h-10 animate-bounce text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Loading reviewer settings...</p>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex flex-col items-center gap-2 py-4 text-center">
                        <ShieldAlert className="h-8 w-8 text-orange-500" />
                        <p className="font-medium text-sm">Permission Denied</p>
                        <p className="text-xs text-muted-foreground max-w-xs">
                            You need Owner or Administrator access to manage newsletter reviewer settings.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <UserCheck className="w-6 h-6 text-primary" />
                        Newsletter Reviewer
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Configure a reviewer who must approve newsletters before they can be sent.
                    </p>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={!hasChanges || saveMutation.isPending}
                        className="flex-1 sm:flex-none"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Discard
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || saveMutation.isPending}
                        className="flex-1 sm:flex-none"
                    >
                        {saveMutation.isPending ? (
                            <span className="flex items-center gap-2">
                                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                Saving...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                Save Changes
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Left: Settings */}
                <div className="xl:col-span-5 space-y-6">
                    {/* Enable/Disable Card */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                Approval Workflow
                            </CardTitle>
                            <CardDescription>
                                When enabled, newsletters must be approved by the designated reviewer before they can be sent.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                <div className="space-y-1">
                                    <Label htmlFor="reviewer-enabled" className="text-sm font-medium cursor-pointer">
                                        Require reviewer approval
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Newsletters will need approval before sending
                                    </p>
                                </div>
                                <Switch
                                    id="reviewer-enabled"
                                    checked={enabled}
                                    onCheckedChange={handleEnabledChange}
                                />
                            </div>

                            <Separator />

                            {/* Reviewer Selection */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">
                                    Designated Reviewer
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Select the team member who will review and approve newsletters. Only Owners, Administrators, and Managers are eligible.
                                </p>
                                <Select
                                    value={selectedReviewerId || "none"}
                                    onValueChange={handleReviewerChange}
                                    disabled={!enabled}
                                >
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Select a reviewer..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-muted-foreground">
                                            No reviewer selected
                                        </SelectItem>
                                        {availableReviewers.map((u: ReviewerUser) => (
                                            <SelectItem key={u.id} value={u.id} className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
                                                    </span>
                                                    <Badge variant="secondary" className={`text-[10px] ${getRoleBadgeStyle(u.role)}`}>
                                                        {u.role}
                                                    </Badge>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Selected reviewer preview */}
                                {enabled && selectedReviewer && (
                                    <div className="mt-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-900/10">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border-2 border-emerald-200 dark:border-emerald-700">
                                                {selectedReviewer.avatarUrl ? (
                                                    <AvatarImage src={selectedReviewer.avatarUrl} alt={selectedReviewer.name} />
                                                ) : null}
                                                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-sm font-semibold">
                                                    {getUserInitials(selectedReviewer.firstName, selectedReviewer.lastName, selectedReviewer.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 truncate">
                                                    {selectedReviewer.name || `${selectedReviewer.firstName || ""} ${selectedReviewer.lastName || ""}`.trim()}
                                                </p>
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                                                    {selectedReviewer.email}
                                                </p>
                                            </div>
                                            <Badge variant="secondary" className={`text-[10px] ${getRoleBadgeStyle(selectedReviewer.role)}`}>
                                                {selectedReviewer.role}
                                            </Badge>
                                        </div>
                                    </div>
                                )}

                                {enabled && !selectedReviewerId && (
                                    <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-900/10">
                                        <div className="flex items-start gap-2">
                                            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                                You must select a reviewer before saving. The reviewer will be notified when a newsletter is submitted for approval.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Current status indicator */}
                            {settings && (
                                <div className="pt-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <div className={`w-2 h-2 rounded-full ${settings.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
                                        <span>
                                            Currently {settings.enabled ? "enabled" : "disabled"}
                                            {settings.reviewer ? ` — Reviewer: ${settings.reviewer.email}` : ""}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: How it works */}
                <div className="xl:col-span-7">
                    <Card className="border-0 shadow-sm h-full">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Eye className="w-5 h-5 text-blue-600" />
                                How It Works
                            </CardTitle>
                            <CardDescription>
                                The reviewer approval workflow adds a quality control step before newsletters are sent to your contacts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Workflow steps */}
                            <div className="space-y-0">
                                {/* Step 1 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                                            1
                                        </div>
                                        <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-2" />
                                    </div>
                                    <div className="pb-6">
                                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            <FileCheck2 className="w-4 h-4 text-blue-500" />
                                            Create Newsletter
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            Team members create and design their newsletter as usual using the editor. The newsletter stays in <Badge variant="outline" className="text-[10px] py-0 px-1.5">Draft</Badge> status.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-semibold text-sm">
                                            2
                                        </div>
                                        <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-2" />
                                    </div>
                                    <div className="pb-6">
                                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-amber-500" />
                                            Submit for Review
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            Instead of sending immediately, the creator submits the newsletter for review. The status changes to <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-700">Pending Review</Badge>.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                                            3
                                        </div>
                                        <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-2" />
                                    </div>
                                    <div className="pb-6">
                                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 text-emerald-500" />
                                            Reviewer Approves or Rejects
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            The designated reviewer reviews the content and either approves it (moving to <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-300 text-emerald-700">Ready to Send</Badge>) or rejects it with notes (returning to <Badge variant="outline" className="text-[10px] py-0 px-1.5">Draft</Badge>).
                                        </p>
                                    </div>
                                </div>

                                {/* Step 4 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 font-semibold text-sm">
                                            4
                                        </div>
                                    </div>
                                    <div className="pb-2">
                                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            <Send className="w-4 h-4 text-violet-500" />
                                            Send Newsletter
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            Once approved, the newsletter can be sent to recipients following the normal sending process.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-6" />

                            {/* Decision outcomes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 dark:border-emerald-800/30 dark:bg-emerald-900/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Approved</span>
                                    </div>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                        Newsletter moves to "Ready to Send" and can be deployed to recipients.
                                    </p>
                                </div>

                                <div className="p-4 rounded-lg border border-red-200 bg-red-50/30 dark:border-red-800/30 dark:bg-red-900/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="w-5 h-5 text-red-600" />
                                        <span className="text-sm font-semibold text-red-800 dark:text-red-200">Rejected</span>
                                    </div>
                                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                                        Newsletter returns to "Draft" with reviewer feedback for the creator to address.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
