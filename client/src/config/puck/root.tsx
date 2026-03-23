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
    title: "My Newsletter",
    subject: "",
    backgroundColor: "#ffffff",
    bodyBackgroundColor: "#f7fafc",
    footerTextColor: "#64748b",
  },
  fields: {
    title: { type: "text" as const, label: "Newsletter Name" },
    subject: { type: "text" as const, label: "Email Subject Line" },
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
      title: { type: "text" as const, label: t("puckEditor.fields.newsletterName", "Newsletter Name") },
      subject: { type: "text" as const, label: t("puckEditor.fields.emailSubjectLine", "Email Subject Line") },
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
