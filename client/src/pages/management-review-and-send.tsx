import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useTenantPlan } from "@/hooks/useTenantPlan";
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
    KeyRound,
    Fingerprint,
    Lock,
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

export default function ManagementReviewAndSend() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { user } = useReduxAuth();
    const queryClient = useQueryClient();

    const [, setLocation] = useLocation();
    const { planName } = useTenantPlan();
    const isFreePlan = planName.toLowerCase().includes("free");

    const currentUser = user as { id: string; role?: string } | null;
    const isAdmin = currentUser?.role === "Owner" || currentUser?.role === "Administrator";

    // Reviewer state
    const [reviewerEnabled, setReviewerEnabled] = useState(false);
    const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
    const [reviewerHasChanges, setReviewerHasChanges] = useState(false);

    // Send confirmation state
    const [sendConfirmEnabled, setSendConfirmEnabled] = useState(false);
    const [sendConfirmHasChanges, setSendConfirmHasChanges] = useState(false);

    const hasChanges = (!isFreePlan && reviewerHasChanges) || sendConfirmHasChanges;

    // Fetch reviewer settings
    const { data: reviewerSettings, isLoading: reviewerLoading } = useQuery<ReviewerSettings>({
        queryKey: ["/api/newsletters/reviewer-settings"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/newsletters/reviewer-settings");
            return res.json();
        },
    });

    // Fetch send confirmation settings
    const { data: sendConfirmSettings, isLoading: sendConfirmLoading } = useQuery<{ enabled: boolean }>({
        queryKey: ["/api/newsletters/send-confirmation-settings"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/newsletters/send-confirmation-settings");
            return res.json();
        },
    });

    // Fetch tenant users for reviewer selection
    const { data: usersData } = useQuery<{ users: ReviewerUser[] }>({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            return res.json();
        },
    });

    // Initialize reviewer form from settings
    useEffect(() => {
        if (reviewerSettings && !reviewerHasChanges) {
            setReviewerEnabled(reviewerSettings.enabled);
            setSelectedReviewerId(reviewerSettings.reviewerId);
        }
    }, [reviewerSettings, reviewerHasChanges]);

    // Initialize send confirmation form from settings
    useEffect(() => {
        if (sendConfirmSettings && !sendConfirmHasChanges) {
            setSendConfirmEnabled(sendConfirmSettings.enabled);
        }
    }, [sendConfirmSettings, sendConfirmHasChanges]);

    // Save reviewer mutation
    const saveReviewerMutation = useMutation({
        mutationFn: async (data: { enabled: boolean; reviewerId: string | null }) => {
            const res = await apiRequest("PUT", "/api/newsletters/reviewer-settings", data);
            return res.json();
        },
        onSuccess: (data: ReviewerSettings) => {
            queryClient.setQueryData(["/api/newsletters/reviewer-settings"], data);
            setReviewerHasChanges(false);
        },
    });

    // Save send confirmation mutation
    const saveSendConfirmMutation = useMutation({
        mutationFn: async (data: { enabled: boolean }) => {
            const res = await apiRequest("PUT", "/api/newsletters/send-confirmation-settings", data);
            return res.json();
        },
        onSuccess: (data: { enabled: boolean }) => {
            queryClient.setQueryData(["/api/newsletters/send-confirmation-settings"], data);
            queryClient.invalidateQueries({ queryKey: ["/api/newsletters/page-data"] });
            setSendConfirmHasChanges(false);
        },
    });

    const isSaving = saveReviewerMutation.isPending || saveSendConfirmMutation.isPending;

    const handleSave = async () => {
        if (!isFreePlan && reviewerEnabled && !selectedReviewerId) {
            toast({
                title: t("newsletterReviewer.reviewerRequired", "Reviewer required"),
                description: t("newsletterReviewer.reviewerRequiredDesc", "Please select a reviewer before enabling the approval workflow"),
                variant: "destructive",
            });
            return;
        }

        try {
            const promises: Promise<unknown>[] = [];
            if (!isFreePlan && reviewerHasChanges) {
                promises.push(saveReviewerMutation.mutateAsync({ enabled: reviewerEnabled, reviewerId: selectedReviewerId }));
            }
            if (sendConfirmHasChanges) {
                promises.push(saveSendConfirmMutation.mutateAsync({ enabled: sendConfirmEnabled }));
            }
            await Promise.all(promises);
            toast({
                title: t("newsletterReviewer.settingsSaved", "Settings saved"),
                description: t("reviewAndSend.savedDesc", "Review & send settings have been updated."),
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to save settings";
            toast({
                title: t("common.error", "Error"),
                description: message,
                variant: "destructive",
            });
        }
    };

    const handleReset = () => {
        if (reviewerSettings) {
            setReviewerEnabled(reviewerSettings.enabled);
            setSelectedReviewerId(reviewerSettings.reviewerId);
            setReviewerHasChanges(false);
        }
        if (sendConfirmSettings) {
            setSendConfirmEnabled(sendConfirmSettings.enabled);
            setSendConfirmHasChanges(false);
        }
        toast({
            title: t("newsletterReviewer.changesDiscarded", "Changes discarded"),
            description: t("newsletterReviewer.changesDiscardedDesc", "Reverted to the last saved settings."),
        });
    };

    // Get all users except the current user (can't review your own)
    const availableReviewers = (usersData?.users || []).filter(
        (u: ReviewerUser) => ["Owner", "Administrator", "Manager"].includes(u.role) && u.id !== currentUser?.id
    );

    const selectedReviewer = availableReviewers.find((u: ReviewerUser) => u.id === selectedReviewerId);

    const isLoading = reviewerLoading || sendConfirmLoading;

    if (isLoading) {
        return (
            <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col items-center justify-center min-h-[400px]">
                        <FileCheck2 className="w-10 h-10 animate-bounce text-primary mb-4" />
                        <p className="text-muted-foreground animate-pulse">{t("reviewAndSend.loading", "Loading settings...")}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <Card>
                        <CardContent className="py-8">
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <ShieldAlert className="h-8 w-8 text-orange-500" />
                                <p className="font-medium text-sm">{t("newsletterReviewer.permissionDenied", "Permission Denied")}</p>
                                <p className="text-xs text-muted-foreground max-w-xs">
                                    {t("reviewAndSend.permissionDeniedDesc", "You need Owner or Administrator access to manage review and send settings.")}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-medium">
                                {t("reviewAndSend.title", "Review & Send")}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t("reviewAndSend.description", "Configure reviewer approval workflow and identity verification for sending newsletters.")}
                            </p>
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={!hasChanges || isSaving}
                                className="flex-1 sm:flex-none"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {t("newsletterReviewer.discard", "Discard")}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving || (!isFreePlan && reviewerEnabled && selectedReviewerId === currentUser?.id)}
                                className="flex-1 sm:flex-none"
                            >
                                {isSaving ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        {t("newsletterReviewer.saving", "Saving...")}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Save className="w-4 h-4" />
                                        {t("newsletterReviewer.saveChanges", "Save Changes")}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Reviewer Approval Section */}
                    {isFreePlan ? (
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-8">
                                <div className="text-center">
                                    <ShieldCheck className="mx-auto h-12 w-12 text-amber-500 dark:text-amber-400 mb-4" />
                                    <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                        {t("reviewAndSend.upgradeRequired", "Upgrade Required")}
                                    </h2>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                                        {t("reviewAndSend.upgradeDescription", {
                                            planName,
                                            defaultValue: "Your current plan ({{planName}}) does not include the reviewer approval workflow. Upgrade to Plus or Pro to add a quality control step before newsletters are sent.",
                                        })}
                                    </p>
                                    <Button
                                        onClick={() => setLocation("/profile?tab=subscription")}
                                        className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {t("reviewAndSend.upgradePlan", "Upgrade Plan")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        {/* Left: Reviewer Settings */}
                        <div className="xl:col-span-5 space-y-6">
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                        {t("newsletterReviewer.workflowTitle", "Approval Workflow")}
                                    </CardTitle>
                                    <CardDescription>
                                        {t("newsletterReviewer.workflowDesc", "When enabled, newsletters must be approved by the designated reviewer before they can be sent.")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                        <div className="space-y-1">
                                            <Label htmlFor="reviewer-enabled" className="text-sm font-medium cursor-pointer">
                                                {t("newsletterReviewer.requireApproval", "Require reviewer approval")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("newsletterReviewer.requireApprovalDesc", "Newsletters will need approval before sending")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="reviewer-enabled"
                                            checked={reviewerEnabled}
                                            onCheckedChange={(checked) => { setReviewerEnabled(checked); setReviewerHasChanges(true); }}
                                        />
                                    </div>

                                    <Separator />

                                    {/* Reviewer Selection */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">
                                            {t("newsletterReviewer.designatedReviewer", "Designated Reviewer")}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("newsletterReviewer.designatedReviewerDesc", "Select the team member who will review and approve newsletters. Only Owners, Administrators, and Managers are eligible.")}
                                        </p>
                                        <Select
                                            value={selectedReviewerId || "none"}
                                            onValueChange={(value) => { setSelectedReviewerId(value === "none" ? null : value); setReviewerHasChanges(true); }}
                                            disabled={!reviewerEnabled}
                                        >
                                            <SelectTrigger className="h-12">
                                                <SelectValue placeholder={t("newsletterReviewer.selectReviewer", "Select a reviewer...")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-muted-foreground">
                                                    {t("newsletterReviewer.noReviewerSelected", "No reviewer selected")}
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
                                        {reviewerEnabled && selectedReviewer && (
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

                                        {reviewerEnabled && !selectedReviewerId && (
                                            <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-900/10">
                                                <div className="flex items-start gap-2">
                                                    <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                                        {t("newsletterReviewer.mustSelectReviewer", "You must select a reviewer before saving. The reviewer will be notified when a newsletter is submitted for approval.")}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Current status indicator */}
                                    {reviewerSettings && (
                                        <div className="pt-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <div className={`w-2 h-2 rounded-full ${reviewerSettings.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
                                                <span>
                                                    {reviewerSettings.enabled ? t("newsletterReviewer.currentlyEnabled", "Currently enabled") : t("newsletterReviewer.currentlyDisabled", "Currently disabled")}
                                                    {reviewerSettings.reviewer ? ` — ${t("newsletterReviewer.reviewerLbl", "Reviewer")}: ${reviewerSettings.reviewer.email}` : ""}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: How reviewer works */}
                        <div className="xl:col-span-7">
                            <Card className="border-0 shadow-sm h-full">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-blue-600" />
                                        {t("newsletterReviewer.howItWorksTitle", "How It Works")}
                                    </CardTitle>
                                    <CardDescription>
                                        {t("newsletterReviewer.howItWorksDesc", "The reviewer approval workflow adds a quality control step before newsletters are sent to your contacts.")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
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
                                                    {t("newsletterReviewer.step1Title", "Create Newsletter")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("newsletterReviewer.step1Desc1", "Team members create and design their newsletter as usual using the editor. The newsletter stays in ")}<Badge variant="outline" className="text-[10px] py-0 px-1.5">{t("newsletterReviewer.draft", "Draft")}</Badge>{t("newsletterReviewer.step1Desc2", " status.")}
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
                                                    {t("newsletterReviewer.step2Title", "Submit for Review")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("newsletterReviewer.step2Desc1", "Instead of sending immediately, the creator submits the newsletter for review. The status changes to ")}<Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-700">{t("newsletterReviewer.pendingReview", "Pending Review")}</Badge>{t("newsletterReviewer.step2Desc2", ".")}
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
                                                    {t("newsletterReviewer.step3Title", "Reviewer Approves or Rejects")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("newsletterReviewer.step3Desc1", "The designated reviewer reviews the content and either approves it (moving to ")}<Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-300 text-emerald-700">{t("newsletterReviewer.readyToSend", "Ready to Send")}</Badge>{t("newsletterReviewer.step3Desc2", ") or rejects it with notes (returning to ")}<Badge variant="outline" className="text-[10px] py-0 px-1.5">{t("newsletterReviewer.draft", "Draft")}</Badge>{t("newsletterReviewer.step3Desc3", ").")}
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
                                                    {t("newsletterReviewer.step4Title", "Send Newsletter")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("newsletterReviewer.step4Desc", "Once approved, the newsletter can be sent to recipients following the normal sending process.")}
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
                                                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{t("newsletterReviewer.approvedTitle", "Approved")}</span>
                                            </div>
                                            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                                {t("newsletterReviewer.approvedDesc", "Newsletter moves to \"Ready to Send\" and can be deployed to recipients.")}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-lg border border-red-200 bg-red-50/30 dark:border-red-800/30 dark:bg-red-900/10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <XCircle className="w-5 h-5 text-red-600" />
                                                <span className="text-sm font-semibold text-red-800 dark:text-red-200">{t("newsletterReviewer.rejectedTitle", "Rejected")}</span>
                                            </div>
                                            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                                                {t("newsletterReviewer.rejectedDesc", "Newsletter returns to \"Draft\" with reviewer feedback for the creator to address.")}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    )}

                    <Separator />

                    {/* Send Confirmation Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        {/* Left: Send Confirmation Settings */}
                        <div className="xl:col-span-5 space-y-6">
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-blue-600" />
                                        {t("sendConfirmation.verificationTitle", "Identity Verification")}
                                    </CardTitle>
                                    <CardDescription>
                                        {t("sendConfirmation.verificationDesc", "When enabled, users must verify their identity with their account password or 2FA code before sending or scheduling any newsletter.")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                        <div className="space-y-1">
                                            <Label htmlFor="send-confirm-enabled" className="text-sm font-medium cursor-pointer">
                                                {t("sendConfirmation.requireVerification", "Require identity verification")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("sendConfirmation.requireVerificationDesc", "Users must confirm password or 2FA before sending")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="send-confirm-enabled"
                                            checked={sendConfirmEnabled}
                                            onCheckedChange={(checked) => { setSendConfirmEnabled(checked); setSendConfirmHasChanges(true); }}
                                        />
                                    </div>

                                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-900/10">
                                        <div className="flex items-start gap-2">
                                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                {t("sendConfirmation.methodNote", "The verification method is determined automatically per user: if a user has 2FA enabled, they will be asked for their TOTP code. Otherwise, they will be asked for their account password.")}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Current status indicator */}
                                    <div className="pt-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <div className={`w-2 h-2 rounded-full ${sendConfirmSettings?.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
                                            <span>
                                                {sendConfirmSettings?.enabled
                                                    ? t("sendConfirmation.currentlyEnabled", "Currently enabled")
                                                    : t("sendConfirmation.currentlyDisabled", "Currently disabled")}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: How send confirmation works */}
                        <div className="xl:col-span-7">
                            <Card className="border-0 shadow-sm h-full">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <KeyRound className="w-5 h-5 text-blue-600" />
                                        {t("sendConfirmation.howItWorksTitle", "How It Works")}
                                    </CardTitle>
                                    <CardDescription>
                                        {t("sendConfirmation.howItWorksDesc", "An extra layer of security that prevents unauthorized or accidental newsletter sends.")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
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
                                                    <Send className="w-4 h-4 text-blue-500" />
                                                    {t("sendConfirmation.step1Title", "Click Send or Schedule")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("sendConfirmation.step1Desc", "The user goes through the normal send wizard: selecting recipients, reviewing details, then clicks Send Now or Schedule.")}
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
                                                    <KeyRound className="w-4 h-4 text-amber-500" />
                                                    {t("sendConfirmation.step2Title", "Verify Identity")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("sendConfirmation.step2Desc", "A confirmation dialog appears asking the user to enter their account password, or their 2FA TOTP code if they have two-factor authentication enabled.")}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 3 */}
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                                                    3
                                                </div>
                                            </div>
                                            <div className="pb-2">
                                                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                                    <Fingerprint className="w-4 h-4 text-emerald-500" />
                                                    {t("sendConfirmation.step3Title", "Newsletter Dispatched")}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t("sendConfirmation.step3Desc", "Once verified, the newsletter is sent or scheduled as normal. The verification token is valid for 5 minutes and single-use.")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="my-6" />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-900/10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <KeyRound className="w-5 h-5 text-blue-600" />
                                                <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t("sendConfirmation.passwordMethod", "Password")}</span>
                                            </div>
                                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                                {t("sendConfirmation.passwordMethodDesc", "Used when the user does not have 2FA enabled. Verifies the account password.")}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-lg border border-violet-200 bg-violet-50/30 dark:border-violet-800/30 dark:bg-violet-900/10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Fingerprint className="w-5 h-5 text-violet-600" />
                                                <span className="text-sm font-semibold text-violet-800 dark:text-violet-200">{t("sendConfirmation.totpMethod", "2FA (TOTP)")}</span>
                                            </div>
                                            <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
                                                {t("sendConfirmation.totpMethodDesc", "Used when the user has two-factor authentication enabled. Verifies a time-based one-time password.")}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
