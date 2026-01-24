import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Edit,
  Palette,
  Save,
  Eye,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface MasterEmailDesign {
  id: string;
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerText?: string;
  footerText?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  updatedAt: string;
}

const PRESET_COLORS = [
  "#EF4444", "#EC4899", "#A855F7", "#6366F1", "#3B82F6",
  "#0EA5E9", "#06B6D4", "#14B8A6", "#22C55E", "#84CC16",
  "#FACC15", "#F59E0B", "#F97316", "#EA580C", "#8B5E3C",
  "#64748B", "#111827", "#10B981", "#9333EA", "#2563EB",
];

const FONT_OPTIONS = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, sans-serif", label: "Helvetica" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
];

const mockMasterDesign: MasterEmailDesign = {
  id: "master-1",
  companyName: "Your Company",
  primaryColor: "#3B82F6",
  secondaryColor: "#1E40AF",
  accentColor: "#10B981",
  fontFamily: "Arial, sans-serif",
  headerText: "Welcome to our newsletter",
  footerText: "© 2025 Your Company. All rights reserved.",
  socialLinks: {},
  updatedAt: new Date().toISOString(),
};

export default function ManagementEmailDesign() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const [secondaryColor, setSecondaryColor] = useState("#1E40AF");
  const [accentColor, setAccentColor] = useState("#10B981");
  const [fontFamily, setFontFamily] = useState("Arial, sans-serif");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const { data: masterDesign, isLoading } = useQuery({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      return mockMasterDesign;
    },
  });

  useState(() => {
    if (masterDesign) {
      setCompanyName(masterDesign.companyName);
      setLogoUrl(masterDesign.logoUrl || "");
      setPrimaryColor(masterDesign.primaryColor);
      setSecondaryColor(masterDesign.secondaryColor);
      setAccentColor(masterDesign.accentColor);
      setFontFamily(masterDesign.fontFamily);
      setHeaderText(masterDesign.headerText || "");
      setFooterText(masterDesign.footerText || "");
      setFacebookUrl(masterDesign.socialLinks?.facebook || "");
      setTwitterUrl(masterDesign.socialLinks?.twitter || "");
      setInstagramUrl(masterDesign.socialLinks?.instagram || "");
      setLinkedinUrl(masterDesign.socialLinks?.linkedin || "");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (designData: Partial<MasterEmailDesign>) => {
      return { success: true, design: designData };
    },
    onSuccess: async () => {
      setIsEditing(false);
      await qc.invalidateQueries({ queryKey: ["/api/master-email-design"] });
      toast({ title: t('management.emailDesign.toasts.updated') });
    },
    onError: (e: any) => toast({ title: t('management.emailDesign.toasts.error'), description: e?.message || t('management.emailDesign.toasts.updateError'), variant: "destructive" }),
  });

  const handleSave = () => {
    const designData: Partial<MasterEmailDesign> = {
      companyName,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      headerText,
      footerText,
      socialLinks: {
        facebook: facebookUrl,
        twitter: twitterUrl,
        instagram: instagramUrl,
        linkedin: linkedinUrl,
      },
      updatedAt: new Date().toISOString(),
    };
    updateMutation.mutate(designData);
  };

  const handleCancel = () => {
    if (masterDesign) {
      setCompanyName(masterDesign.companyName);
      setLogoUrl(masterDesign.logoUrl || "");
      setPrimaryColor(masterDesign.primaryColor);
      setSecondaryColor(masterDesign.secondaryColor);
      setAccentColor(masterDesign.accentColor);
      setFontFamily(masterDesign.fontFamily);
      setHeaderText(masterDesign.headerText || "");
      setFooterText(masterDesign.footerText || "");
      setFacebookUrl(masterDesign.socialLinks?.facebook || "");
      setTwitterUrl(masterDesign.socialLinks?.twitter || "");
      setInstagramUrl(masterDesign.socialLinks?.instagram || "");
      setLinkedinUrl(masterDesign.socialLinks?.linkedin || "");
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Mail className="w-8 h-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">{t('management.emailDesign.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('management.emailDesign.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-1" /> {t('management.emailDesign.editDesign')}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                {t('management.emailDesign.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {updateMutation.isPending ? t('management.emailDesign.saving') : t('management.emailDesign.saveChanges')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('management.emailDesign.brandInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">{t('management.emailDesign.brandInfo.companyName')}</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.brandInfo.companyNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">{t('management.emailDesign.brandInfo.logoUrl')}</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.brandInfo.logoUrlPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontFamily">{t('management.emailDesign.brandInfo.fontFamily')}</Label>
                <select
                  id="fontFamily"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  disabled={!isEditing}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('management.emailDesign.colorScheme.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('management.emailDesign.colorScheme.primaryColor')}</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-200"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div className="grid grid-cols-5 gap-2 flex-1">
                    {PRESET_COLORS.slice(0, 10).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setPrimaryColor(color)}
                        disabled={!isEditing}
                        className={`h-8 w-8 rounded-full ${primaryColor === color ? "ring-2 ring-offset-2 ring-primary" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                        style={{ backgroundColor: color }}
                        aria-label={`Choose primary color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('management.emailDesign.colorScheme.secondaryColor')}</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-200"
                    style={{ backgroundColor: secondaryColor }}
                  />
                  <div className="grid grid-cols-5 gap-2 flex-1">
                    {PRESET_COLORS.slice(10, 20).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSecondaryColor(color)}
                        disabled={!isEditing}
                        className={`h-8 w-8 rounded-full ${secondaryColor === color ? "ring-2 ring-offset-2 ring-primary" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                        style={{ backgroundColor: color }}
                        aria-label={`Choose secondary color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('management.emailDesign.colorScheme.accentColor')}</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-200"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="grid grid-cols-5 gap-2 flex-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAccentColor(color)}
                        disabled={!isEditing}
                        className={`h-8 w-8 rounded-full ${accentColor === color ? "ring-2 ring-offset-2 ring-primary" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                        style={{ backgroundColor: color }}
                        aria-label={`Choose accent color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('management.emailDesign.emailContent.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headerText">{t('management.emailDesign.emailContent.headerText')}</Label>
                <Input
                  id="headerText"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.emailContent.headerTextPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="footerText">{t('management.emailDesign.emailContent.footerText')}</Label>
                <Textarea
                  id="footerText"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.emailContent.footerTextPlaceholder')}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('management.emailDesign.socialMedia.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="facebook">{t('management.emailDesign.socialMedia.facebookUrl')}</Label>
                <Input
                  id="facebook"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.socialMedia.facebookPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter">{t('management.emailDesign.socialMedia.twitterUrl')}</Label>
                <Input
                  id="twitter"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.socialMedia.twitterPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">{t('management.emailDesign.socialMedia.instagramUrl')}</Label>
                <Input
                  id="instagram"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.socialMedia.instagramPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">{t('management.emailDesign.socialMedia.linkedinUrl')}</Label>
                <Input
                  id="linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={!isEditing}
                  placeholder={t('management.emailDesign.socialMedia.linkedinPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {t('management.emailDesign.preview.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-white">
                <div
                  className="p-6 text-center"
                  style={{ backgroundColor: primaryColor, color: "white" }}
                >
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      className="h-12 mx-auto mb-3"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <h1 className="text-2xl font-bold" style={{ fontFamily }}>
                    {companyName || "Your Company"}
                  </h1>
                  {headerText && (
                    <p className="mt-2 text-sm opacity-90" style={{ fontFamily }}>
                      {headerText}
                    </p>
                  )}
                </div>

                <div className="p-6" style={{ fontFamily }}>
                  <div
                    className="p-4 rounded-lg mb-4"
                    style={{ backgroundColor: secondaryColor, color: "white" }}
                  >
                    <h2 className="text-lg font-semibold mb-2">{t('management.emailDesign.preview.sampleContent')}</h2>
                    <p className="text-sm opacity-90">
                      {t('management.emailDesign.preview.sampleDescription')}
                    </p>
                  </div>

                  <button
                    className="w-full py-3 px-6 rounded-lg font-medium text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {t('management.emailDesign.preview.ctaButton')}
                  </button>
                </div>

                <div
                  className="p-6 text-center text-sm"
                  style={{ backgroundColor: "#f3f4f6", fontFamily }}
                >
                  {(facebookUrl || twitterUrl || instagramUrl || linkedinUrl) && (
                    <div className="flex justify-center gap-4 mb-4">
                      {facebookUrl && (
                        <a href={facebookUrl} className="text-gray-600 hover:text-gray-900">
                          Facebook
                        </a>
                      )}
                      {twitterUrl && (
                        <a href={twitterUrl} className="text-gray-600 hover:text-gray-900">
                          Twitter
                        </a>
                      )}
                      {instagramUrl && (
                        <a href={instagramUrl} className="text-gray-600 hover:text-gray-900">
                          Instagram
                        </a>
                      )}
                      {linkedinUrl && (
                        <a href={linkedinUrl} className="text-gray-600 hover:text-gray-900">
                          LinkedIn
                        </a>
                      )}
                    </div>
                  )}
                  <p className="text-gray-600">
                    {footerText || "© 2025 Your Company. All rights reserved."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('management.emailDesign.designInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('management.emailDesign.designInfo.lastUpdated')}</span>
                <span className="font-medium">
                  {masterDesign?.updatedAt
                    ? new Date(masterDesign.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : t('management.emailDesign.designInfo.never')}
                </span>
              </div>
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('management.emailDesign.designInfo.description')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
