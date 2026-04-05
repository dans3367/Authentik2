import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Save,
    RotateCcw,
    ShieldCheck,
    ShieldAlert,
    KeyRound,
    Fingerprint,
    Lock,
    Send,
    Info,
} from "lucide-react";

export default function ManagementNewsletterSendConfirmation() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { user } = useReduxAuth();
    const queryClient = useQueryClient();

    const currentUser = user as { id: string; role?: string } | null;
    const isAdmin = currentUser?.role === "Owner" || currentUser?.role === "Administrator";

    const [enabled, setEnabled] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const { data: settings, isLoading } = useQuery<{ enabled: boolean }>({
        queryKey: ["/api/newsletters/send-confirmation-settings"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/newsletters/send-confirmation-settings");
            return res.json();
        },
    });

    useEffect(() => {
        if (settings && !hasChanges) {
            setEnabled(settings.enabled);
        }
    }, [settings, hasChanges]);

    const saveMutation = useMutation({
        mutationFn: async (data: { enabled: boolean }) => {
            const res = await apiRequest("PUT", "/api/newsletters/send-confirmation-settings", data);
            return res.json();
        },
        onSuccess: (data: { enabled: boolean }) => {
            queryClient.setQueryData(["/api/newsletters/send-confirmation-settings"], data);
            queryClient.invalidateQueries({ queryKey: ["/api/newsletters/page-data"] });
            setHasChanges(false);
            toast({
                title: t("sendConfirmation.settingsSaved", "Settings saved"),
                description: data.enabled
                    ? t("sendConfirmation.enabledDesc", "Password/2FA confirmation is now required before sending newsletters.")
                    : t("sendConfirmation.disabledDesc", "Password/2FA confirmation is no longer required."),
            });
        },
        onError: (error: Error) => {
            toast({
                title: t("common.error", "Error"),
                description: error.message || t("sendConfirmation.errorDesc", "Failed to save settings"),
                variant: "destructive",
            });
        },
    });

    const handleSave = () => {
        saveMutation.mutate({ enabled });
    };

    const handleReset = () => {
        if (settings) {
            setEnabled(settings.enabled);
            setHasChanges(false);
            toast({
                title: t("sendConfirmation.changesDiscarded", "Changes discarded"),
                description: t("sendConfirmation.changesDiscardedDesc", "Reverted to the last saved settings."),
            });
        }
    };

    const handleEnabledChange = (checked: boolean) => {
        setEnabled(checked);
        setHasChanges(true);
    };

    if (isLoading) {
        return (
            <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col items-center justify-center min-h-[400px]">
                        <KeyRound className="w-10 h-10 animate-bounce text-primary mb-4" />
                        <p className="text-muted-foreground animate-pulse">{t("sendConfirmation.loading", "Loading settings...")}</p>
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
                                <p className="font-medium text-sm">{t("sendConfirmation.permissionDenied", "Permission Denied")}</p>
                                <p className="text-xs text-muted-foreground max-w-xs">
                                    {t("sendConfirmation.permissionDeniedDesc", "You need Owner or Administrator access to manage send confirmation settings.")}
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
                                {t("sendConfirmation.title", "Send Confirmation")}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t("sendConfirmation.description", "Require identity verification before sending or scheduling newsletters.")}
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
                                {t("sendConfirmation.discard", "Discard")}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!hasChanges || saveMutation.isPending}
                                className="flex-1 sm:flex-none"
                            >
                                {saveMutation.isPending ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        {t("sendConfirmation.saving", "Saving...")}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Save className="w-4 h-4" />
                                        {t("sendConfirmation.saveChanges", "Save Changes")}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        {/* Left: Settings */}
                        <div className="xl:col-span-5 space-y-6">
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
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
                                            checked={enabled}
                                            onCheckedChange={handleEnabledChange}
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
                                            <div className={`w-2 h-2 rounded-full ${settings?.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
                                            <span>
                                                {settings?.enabled
                                                    ? t("sendConfirmation.currentlyEnabled", "Currently enabled")
                                                    : t("sendConfirmation.currentlyDisabled", "Currently disabled")}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: How it works */}
                        <div className="xl:col-span-7">
                            <Card className="border-0 shadow-sm h-full">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-blue-600" />
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
