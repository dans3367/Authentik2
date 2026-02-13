import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";
import { withLayout, WithLayout } from "../../components/Layout";

type ImageItem = {
  src: string;
  alt: string;
  href?: string;
};

export type ImageProps = WithLayout<{
  images: ImageItem[];
  align: "left" | "center" | "right";
  sizing: "auto" | "preset" | "fill" | "fixed";
  autoSize?: "small" | "medium" | "large" | "xlarge";
  width?: number;
  height?: number;
  gap?: number;
  borderRadius?: number;
  caption?: string;
}>;

const AUTO_SIZES: Record<string, number> = {
  small: 128,
  medium: 192,
  large: 256,
  xlarge: 320,
};

// Email content area: 600px wrapper - 80px body padding = 520px
const CONTAINER_WIDTH = 520;

const ImageInner: ComponentConfig<ImageProps> = {
  fields: {
    images: {
      type: "array",
      label: "Images",
      getItemSummary: (item, i) => item.alt || `Image #${(i ?? 0) + 1}`,
      defaultItemProps: {
        src: "https://via.placeholder.com/520x300/e2e8f0/64748b?text=Image",
        alt: "Image",
      },
      arrayFields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt Text" },
        href: { type: "text", label: "Link URL (optional)" },
      },
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    sizing: {
      type: "select",
      label: "Sizing Mode",
      options: [
        { label: "Auto (original size)", value: "auto" },
        { label: "Preset sizes", value: "preset" },
        { label: "Fill (full width)", value: "fill" },
        { label: "Fixed", value: "fixed" },
      ],
    },
    autoSize: {
      type: "radio",
      label: "Size",
      options: [
        { label: "Small", value: "small" },
        { label: "Medium", value: "medium" },
        { label: "Large", value: "large" },
        { label: "X-Large", value: "xlarge" },
      ],
    },
    width: { type: "number", label: "Width (px)", min: 10, max: 600 },
    height: { type: "number", label: "Height (px)", min: 10, max: 1200 },
    gap: { type: "number", label: "Gap between images (px)", min: 0, max: 48 },
    borderRadius: { type: "number", label: "Border Radius (px)", min: 0, max: 50 },
    caption: { type: "textarea", label: "Caption (optional)" },
  },
  defaultProps: {
    images: [
      {
        src: "https://via.placeholder.com/520x300/e2e8f0/64748b?text=Your+Image",
        alt: "Image",
      },
    ],
    align: "center",
    sizing: "fill",
    autoSize: "xlarge",
    width: 520,
    height: 300,
    gap: 12,
    borderRadius: 0,
  },
  resolveFields: (data, { fields }) => {
    const isSingle = (data.props.images?.length ?? 1) <= 1;
    if (data.props.sizing === "preset") {
      const { width, height, ..._rest } = fields;
      // Hide gap if single image
      if (isSingle) { const { gap, ...rest } = _rest; return rest; }
      return _rest;
    }
    if (data.props.sizing === "fixed") {
      const { autoSize, ..._rest } = fields;
      if (isSingle) { const { gap, ...rest } = _rest; return rest; }
      return _rest;
    }
    // auto or fill — hide all size controls
    const { width, height, autoSize, ..._rest } = fields;
    if (isSingle) { const { gap, ...rest } = _rest; return rest; }
    return _rest;
  },
  render: ({ images, align, sizing, autoSize, width, height, gap, borderRadius, caption }) => {
    const count = images.length || 1;
    const cellGap = gap ?? 12;
    const totalGap = cellGap * (count - 1);

    const getImgWidth = () => {
      if (sizing === "fill") return Math.floor((CONTAINER_WIDTH - totalGap) / count);
      if (sizing === "preset") return AUTO_SIZES[autoSize ?? "xlarge"];
      if (sizing === "fixed") return Math.min(width ?? 520, CONTAINER_WIDTH);
      return undefined; // auto
    };

    const imgWidth = getImgWidth();
    const tdAlign = align === "left" ? "left" : align === "right" ? "right" : "center";

    const renderImage = (item: ImageItem, idx: number) => {
      const imgStyle: React.CSSProperties = {
        display: "block",
        border: 0,
        outline: "none",
        textDecoration: "none",
        maxWidth: "100%",
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        ...(sizing === "fill" && { width: `${imgWidth}px` }),
        ...(sizing === "preset" && { width: `${imgWidth}px`, height: "auto" }),
        ...(sizing === "fixed" && {
          width: `${imgWidth}px`,
          height: height ? `${height}px` : "auto",
        }),
      };

      const imgEl = (
        <img
          src={item.src}
          alt={item.alt}
          {...(imgWidth ? { width: imgWidth } : {})}
          {...(sizing === "fixed" && height ? { height } : {})}
          style={imgStyle}
        />
      );

      return item.href ? (
        <a key={idx} href={item.href} target="_blank" style={{ textDecoration: "none" }}>
          {imgEl}
        </a>
      ) : (
        <React.Fragment key={idx}>{imgEl}</React.Fragment>
      );
    };

    return (
      <Section>
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          width="100%"
          style={{ borderCollapse: "collapse" as const }}
        >
          <tbody>
            <tr>
              {images.map((item, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && cellGap > 0 && (
                    <td style={{ width: `${cellGap}px`, fontSize: 0, lineHeight: 0 }}>{"\u00A0"}</td>
                  )}
                  <td
                    align={tdAlign}
                    style={{
                      padding: 0,
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: 0,
                      lineHeight: 0,
                    }}
                  >
                    {renderImage(item, idx)}
                  </td>
                </React.Fragment>
              ))}
            </tr>
            {caption && (
              <tr>
                <td
                  colSpan={images.length * 2 - 1}
                  align={tdAlign}
                  style={{
                    padding: "8px 0 0 0",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: "13px",
                    lineHeight: "1.4",
                    color: "#6b7280",
                  }}
                >
                  {caption}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>
    );
  },
};

export const Image = withLayout(ImageInner);
