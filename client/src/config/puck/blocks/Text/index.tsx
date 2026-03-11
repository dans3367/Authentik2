import React from "react";
import { ALargeSmall, AlignLeft } from "lucide-react";

import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { AiTextCreator } from "@/components/puck/AiTextCreator";

export type TextProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  padding?: string;
  size?: "s" | "m";
  color: "default" | "muted";
  maxWidth?: string;
  _aiCreator?: string;
}>;

const TextInner: ComponentConfig<TextProps> = {
  fields: {
    text: {
      type: "textarea",
    },
    _aiCreator: {
      type: "custom",
      label: "AI Creator",
      render: () => <AiTextCreator />,
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
  resolveFields: (data, { fields }) => {
    const t = data.props.text;
    const isHtml = typeof t === "string" && t.includes("<") && t.includes(">");
    if (!isHtml) {
      return {
        ...fields,
        text: { type: "textarea" as const, contentEditable: true },
      };
    }
    return fields;
  },
  defaultProps: {
    align: "left",
    text: "Text",
    size: "m",
    color: "default",
  },
  render: ({ align, color, text, size, maxWidth }) => {
    const textStr = typeof text === "string" ? text : "";
    const isHtml = textStr.includes("<") && textStr.includes(">");
    const baseStyle: React.CSSProperties = {
      ...(align !== "left" ? { textAlign: align } : {}),
      color: color === "default" ? "inherit" : "#6b7280",
      fontSize: size === "m" ? "20px" : "16px",
      fontWeight: 300,
      maxWidth,
    };
    if (isHtml) {
      return (
        <Section maxWidth={maxWidth}>
          <div dangerouslySetInnerHTML={{ __html: textStr }} style={baseStyle} />
        </Section>
      );
    }
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
                style={baseStyle}
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
