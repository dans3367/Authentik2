import { DefaultRootProps } from "@puckeditor/core";

export type RootProps = DefaultRootProps & {
  backgroundColor?: string;
};

export const Root = {
  defaultProps: {
    title: "My Newsletter",
    backgroundColor: "#ffffff",
  },
  fields: {
    title: { type: "text", label: "Page Title" },
    backgroundColor: {
      type: "custom",
      label: "Background Color",
      render: ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
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
      ),
    },
  },
  render: ({ backgroundColor, puck: { renderDropZone: DropZone } }: any) => {
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
  },
};

export default Root;
