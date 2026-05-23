import { useSyncExternalStore } from "react";
import { TFunction } from "i18next";
import type { RootProps } from "./puck-shared";
import { getRootFieldErrorState, rootFieldErrors, subscribeRootFieldErrors } from "./root-field-errors";
import { useTheme } from "@/contexts/ThemeContext";

const colorPickerRender = ({ value, onChange, field }: { value: string | undefined; onChange: (val: string | undefined) => void; field: { label?: string } }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const labelColor = isDark ? "#d1d5db" : "#374151";
  const inputBg = isDark ? "var(--card)" : "#ffffff";
  const inputColor = isDark ? "#e5e7eb" : "#111827";
  const borderColor = isDark ? "var(--border)" : "#d1d5db";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {field.label && (
        <label style={{ fontSize: "13px", fontWeight: 500, color: labelColor }}>
          {field.label}
        </label>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.currentTarget.value)}
          style={{
            width: "36px",
            height: "36px",
            padding: "2px",
            border: `1px solid ${borderColor}`,
            borderRadius: "6px",
            cursor: "pointer",
            backgroundColor: inputBg,
          }}
        />
        <input
          type="text"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.currentTarget.value)}
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: "13px",
            fontFamily: "monospace",
            border: `1px solid ${borderColor}`,
            borderRadius: "6px",
            outline: "none",
            backgroundColor: inputBg,
            color: inputColor,
          }}
        />
      </div>
    </div>
  );
};

function useRootFieldErrors() {
  return useSyncExternalStore(subscribeRootFieldErrors, getRootFieldErrorState);
}

const textWithPlaceholderRender = (placeholder: string, errorKey?: keyof typeof rootFieldErrors) => ({ value, onChange, field }: { value: string | undefined; onChange: (val: string) => void; field: { label?: string } }) => {
  const fieldErrors = useRootFieldErrors();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const hasError = errorKey ? fieldErrors[errorKey] : false;
  const labelColor = hasError ? "#dc2626" : isDark ? "#d1d5db" : "#374151";
  const inputBg = isDark ? "hsl(215, 20%, 16%)" : "#ffffff";
  const inputColor = isDark ? "#e5e7eb" : "#111827";
  const borderColor = hasError ? "#dc2626" : isDark ? "hsl(215, 20%, 25%)" : "#d1d5db";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {field.label && (
        <label style={{ fontSize: "13px", fontWeight: 500, color: labelColor, transition: "color 0.2s" }}>
          {field.label}{hasError ? <span style={{ color: "#dc2626" }}> * required</span> : ""}
        </label>
      )}
      <input
        type="text"
        value={value || ""}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          if (errorKey && e.currentTarget.value.trim()) rootFieldErrors[errorKey] = false;
        }}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "6px 8px",
          fontSize: "13px",
          border: `1px solid ${borderColor}`,
          borderRadius: "6px",
          outline: "none",
          transition: "border-color 0.2s ease",
          backgroundColor: inputBg,
          color: inputColor,
        }}
      />
    </div>
  );
};

const rootRender = ({ backgroundColor, puck: { renderDropZone: DropZone } }: any) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "auto",
        backgroundColor: backgroundColor || "#ffffff",
      }}
    >
      <DropZone zone="default-zone" style={{ paddingBottom: "25px" }} />
    </div>
  );
};

export const Root = {
  defaultProps: {
    title: "",
    subject: "",
    backgroundColor: "#ffffff",
    bodyBackgroundColor: "#f7fafc",
    footerTextColor: "#64748b",
  },
  fields: {
    title: { type: "custom" as const, label: "Newsletter Name", render: textWithPlaceholderRender("Enter newsletter name...", "title") },
    subject: { type: "custom" as const, label: "Email Subject Line", render: textWithPlaceholderRender("Enter email subject line...") },
    backgroundColor: {
      type: "custom" as const,
      label: "Content Background Color",
      render: colorPickerRender,
    },
    bodyBackgroundColor: {
      type: "custom" as const,
      label: "Page Background Color",
      render: colorPickerRender,
    },
    footerTextColor: {
      type: "custom" as const,
      label: "Footer Text Color",
      render: colorPickerRender,
    },
  },
  render: rootRender,
};

export function createTranslatedRoot(t: TFunction) {
  return {
    ...Root,
    fields: {
      title: { type: "custom" as const, label: t("puckEditor.fields.newsletterName", "Newsletter Name"), render: textWithPlaceholderRender(t("puckEditor.placeholders.newsletterName", "Enter newsletter name..."), "title") },
      subject: { type: "custom" as const, label: t("puckEditor.fields.emailSubjectLine", "Email Subject Line"), render: textWithPlaceholderRender(t("puckEditor.placeholders.emailSubjectLine", "Enter email subject line...")) },
      backgroundColor: {
        type: "custom" as const,
        label: t("puckEditor.fields.contentBackgroundColor", "Content Background Color"),
        render: colorPickerRender,
      },
      bodyBackgroundColor: {
        type: "custom" as const,
        label: t("puckEditor.fields.bodyBackgroundColor", "Page Background Color"),
        render: colorPickerRender,
      },
      footerTextColor: {
        type: "custom" as const,
        label: t("puckEditor.fields.footerTextColor", "Footer Text Color"),
        render: colorPickerRender,
      },
    },
  };
}

export default Root;
