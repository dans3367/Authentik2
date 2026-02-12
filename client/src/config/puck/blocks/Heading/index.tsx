import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";

export type HeadingProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  level?: "1" | "2" | "3" | "4" | "5" | "6";
  size: "xxxl" | "xxl" | "xl" | "l" | "m" | "s" | "xs";
}>;

const sizeOptions = [
  { value: "xxxl", label: "XXXL" },
  { value: "xxl", label: "XXL" },
  { value: "xl", label: "XL" },
  { value: "l", label: "L" },
  { value: "m", label: "M" },
  { value: "s", label: "S" },
  { value: "xs", label: "XS" },
];

const levelOptions = [
  { label: "", value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

const HeadingInternal: ComponentConfig<HeadingProps> = {
  fields: {
    text: {
      type: "textarea",
      contentEditable: true,
    },
    size: {
      type: "select",
      options: sizeOptions,
    },
    level: {
      type: "select",
      options: levelOptions,
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
  },
  defaultProps: {
    align: "left",
    text: "Heading",
    size: "m",
    layout: {
      padding: "8px",
    },
  },
  render: ({ align, text, size, level }) => {
    const sizeMap = {
      xxxl: "64px",
      xxl: "48px",
      xl: "36px",
      l: "30px",
      m: "24px",
      s: "20px",
      xs: "16px",
    };
    
    const Tag = level ? (`h${level}` as any) : "h2";
    
    return (
      <Section>
        <Tag style={{ 
          display: "flex",
          fontSize: sizeMap[size],
          fontWeight: 700,
          margin: 0,
          textAlign: align,
          width: "100%",
          justifyContent:
            align === "center"
              ? "center"
              : align === "right"
              ? "flex-end"
              : "flex-start",
        }}>
          {text}
        </Tag>
      </Section>
    );
  },
};

export const Heading = withLayout(HeadingInternal);
