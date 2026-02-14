import { ComponentConfig } from "@puckeditor/core";

export type ButtonProps = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export const Button: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: {
      type: "text",
      placeholder: "Lorem ipsum...",
      contentEditable: true,
    },
    href: { type: "text" },
    variant: {
      type: "radio",
      options: [
        { label: "primary", value: "primary" },
        { label: "secondary", value: "secondary" },
      ],
    },
  },
  defaultProps: {
    label: "Button",
    href: "#",
    variant: "primary",
  },
  render: ({ href, variant, label, puck }) => {
    const isPrimary = variant === "primary";
    return (
      <div style={{ display: "inline-block" }}>
        <a
          href={puck.isEditing ? "#" : href}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: "6px",
            backgroundColor: isPrimary ? "#2563eb" : "#ffffff",
            color: isPrimary ? "#ffffff" : "#2563eb",
            border: isPrimary ? "none" : "2px solid #2563eb",
            cursor: "pointer",
          }}
          tabIndex={puck.isEditing ? -1 : undefined}
        >
          {label}
        </a>
      </div>
    );
  },
};
