import { ALargeSmall, AlignLeft } from "lucide-react";

import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";

export type TextProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  padding?: string;
  size?: "s" | "m";
  color: "default" | "muted";
  maxWidth?: string;
}>;

const TextInner: ComponentConfig<TextProps> = {
  fields: {
    text: {
      type: "textarea",
      contentEditable: true,
    },
    size: {
      type: "select",
      labelIcon: <ALargeSmall size={16} />,
      options: [
        { label: "S", value: "s" },
        { label: "M", value: "m" },
      ],
    },
    align: {
      type: "radio",
      labelIcon: <AlignLeft size={16} />,
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    color: {
      type: "radio",
      options: [
        { label: "Default", value: "default" },
        { label: "Muted", value: "muted" },
      ],
    },
    maxWidth: { type: "text" },
  },
  defaultProps: {
    align: "left",
    text: "Text",
    size: "m",
    color: "default",
  },
  render: ({ align, color, text, size, maxWidth }) => {
    return (
      <Section maxWidth={maxWidth}>
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          role="presentation"
          style={{ borderCollapse: "collapse" as const }}
        >
          <tbody>
            <tr>
              <td
                {...(align !== "left" ? { align } : {})}
                style={{
                  ...(align !== "left" ? { textAlign: align } : {}),
                  color:
                    color === "default" ? "inherit" : "#6b7280",
                  fontSize: size === "m" ? "20px" : "16px",
                  fontWeight: 300,
                  maxWidth,
                }}
              >
                {text}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    );
  },
};

export const Text = withLayout(TextInner);
