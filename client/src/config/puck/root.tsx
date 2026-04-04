import { DefaultRootProps } from "@puckeditor/core";
import { TFunction } from "i18next";

export type RootProps = DefaultRootProps & {
  subject?: string;
  backgroundColor?: string;
  bodyBackgroundColor?: string;
  footerTextColor?: string;
};

const colorPickerRender = ({ value, onChange, field }: { value: string | undefined; onChange: (val: string | undefined) => void; field: { label?: string } }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    {field.label && (
      <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
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
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          cursor: "pointer",
          backgroundColor: "#fff",
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
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          outline: "none",
        }}
      />
    </div>
  </div>
);

/** Mutable validation state that field renderers read on each render. */
export const rootFieldErrors: { title: boolean } = { title: false };

const textWithPlaceholderRender = (placeholder: string, errorKey?: keyof typeof rootFieldErrors) => ({ value, onChange, field }: { value: string | undefined; onChange: (val: string) => void; field: { label?: string } }) => {
  const hasError = errorKey ? rootFieldErrors[errorKey] : false;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {field.label && (
        <label style={{ fontSize: "13px", fontWeight: 500, color: hasError ? "#dc2626" : "#374151", transition: "color 0.2s" }}>
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
          border: `1px solid ${hasError ? "#dc2626" : "#d1d5db"}`,
          borderRadius: "6px",
          outline: "none",
          transition: "border-color 0.2s ease",
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
