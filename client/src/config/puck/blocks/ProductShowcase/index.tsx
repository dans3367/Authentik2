import React from "react";
import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";
import { withLayout, WithLayout } from "../../components/Layout";

const isSafeImageUrl = (value: string) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isSafeCtaUrl = (value: string) => {
  if (!value) return false;
  try {
    const url = new URL(value, "https://example.com");
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
};

export type ProductShowcaseProps = WithLayout<{
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  imageAlt: string;
  backgroundColor: string;
  textColor: string;
  ctaColor: string;
  borderRadius: number;
  imageBorderRadius: number;
}>;

const ProductShowcaseInner: ComponentConfig<ProductShowcaseProps> = {
  label: "Product Showcase",
  fields: {
    title: {
      type: "text",
      label: "Title",
    },
    description: {
      type: "textarea",
      label: "Description",
    },
    ctaText: {
      type: "text",
      label: "CTA Text",
    },
    ctaUrl: {
      type: "text",
      label: "CTA Link URL",
    },
    imageUrl: {
      type: "text",
      label: "Image URL",
    },
    imageAlt: {
      type: "text",
      label: "Image Alt Text",
    },
    backgroundColor: {
      type: "custom",
      label: "Background Color",
      render: ({ value, onChange }) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="color"
            value={value || "#333333"}
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
            value={value || "#333333"}
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
    textColor: {
      type: "text",
      label: "Text Color (hex)",
    },
    ctaColor: {
      type: "text",
      label: "CTA Text Color (hex)",
    },
    borderRadius: {
      type: "number",
      label: "Card Border Radius (px)",
      min: 0,
      max: 40,
    },
    imageBorderRadius: {
      type: "number",
      label: "Image Border Radius (px)",
      min: 0,
      max: 40,
    },
  },
  defaultProps: {
    title: "Coffee Storage",
    description: "Keep your coffee fresher for longer with innovative technology.",
    ctaText: "Shop now →",
    ctaUrl: "#",
    imageUrl: "https://placehold.co/260x280/d4c4a8/d4c4a8?text=+",
    imageAlt: "Product image",
    backgroundColor: "#333333",
    textColor: "#ffffff",
    ctaColor: "#ffffff",
    borderRadius: 12,
    imageBorderRadius: 12,
  },
  render: ({
    title,
    description,
    ctaText,
    ctaUrl,
    imageUrl,
    imageAlt,
    backgroundColor,
    textColor,
    ctaColor,
    borderRadius,
    imageBorderRadius,
    puck,
  }) => {
    const safeImageUrl = isSafeImageUrl(imageUrl)
      ? imageUrl
      : "https://placehold.co/260x280/d4c4a8/d4c4a8?text=+";
    const safeCtaUrl = isSafeCtaUrl(ctaUrl) ? ctaUrl : "#";
    const bgColor = backgroundColor || "#333333";
    const txtColor = textColor || "#ffffff";
    const linkColor = ctaColor || "#ffffff";
    const cardRadius = Math.max(0, borderRadius ?? 12);
    const imgRadius = Math.max(0, imageBorderRadius ?? 12);

    // Email content area: 600px email wrapper, 24px Section padding each side
    const containerWidth = 552;
    const textColWidth = 280;
    const gapWidth = 20;
    const imageColWidth = containerWidth - textColWidth - gapWidth;

    return (
      <Section>
        <div
          style={{
            width: `${containerWidth}px`,
            maxWidth: "100%",
            margin: "0 auto",
          }}
        >
          {/*
            Outer card table — provides the rounded background.
            Using a wrapping table with bgcolor for maximum email client support.
          */}
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            width={containerWidth}
            {...({ bgcolor: bgColor } as any)}
            style={{
              width: `${containerWidth}px`,
              borderCollapse: "separate" as const,
              borderSpacing: 0,
              borderRadius: `${cardRadius}px`,
              backgroundColor: bgColor,
              overflow: "hidden",
            }}
          >
            <tbody>
              <tr>
                <td
                  {...({ bgcolor: bgColor } as any)}
                  style={{
                    padding: 0,
                    borderRadius: `${cardRadius}px`,
                    backgroundColor: bgColor,
                  }}
                >
                  {/*
                    Inner layout table — two columns: text left, image right.
                    Uses fixed table layout for reliable widths across email clients.
                  */}
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                    width={containerWidth}
                    style={{
                      width: `${containerWidth}px`,
                      borderCollapse: "collapse" as const,
                      tableLayout: "fixed" as const,
                    }}
                  >
                    <colgroup>
                      <col
                        width={textColWidth}
                        style={{ width: `${textColWidth}px` }}
                      />
                      <col
                        width={gapWidth}
                        style={{ width: `${gapWidth}px` }}
                      />
                      <col
                        width={imageColWidth}
                        style={{ width: `${imageColWidth}px` }}
                      />
                    </colgroup>
                    <tbody>
                      <tr>
                        {/* Text column */}
                        <td
                          width={textColWidth}
                          valign="middle"
                          style={{
                            width: `${textColWidth}px`,
                            verticalAlign: "middle",
                            padding: "40px 0 40px 40px",
                            fontFamily: "Arial, Helvetica, sans-serif",
                          }}
                        >
                          <h2
                            style={{
                              margin: 0,
                              padding: 0,
                              fontSize: "28px",
                              fontWeight: 800,
                              lineHeight: "1.15",
                              color: txtColor,
                              fontFamily: "Arial, Helvetica, sans-serif",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {title}
                          </h2>
                          <p
                            style={{
                              margin: "14px 0 0 0",
                              padding: 0,
                              fontSize: "15px",
                              lineHeight: "1.5",
                              color: txtColor,
                              fontFamily: "Arial, Helvetica, sans-serif",
                              fontWeight: 400,
                              opacity: 0.8,
                            }}
                          >
                            {description}
                          </p>
                          <p
                            style={{
                              margin: "18px 0 0 0",
                              padding: 0,
                            }}
                          >
                            <a
                              href={safeCtaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: "15px",
                                fontWeight: 700,
                                lineHeight: "1.4",
                                color: linkColor,
                                fontFamily: "Arial, Helvetica, sans-serif",
                                textDecoration: "none",
                                ...(puck.isEditing ? { pointerEvents: "none" as const } : {}),
                              }}
                              tabIndex={puck.isEditing ? -1 : undefined}
                            >
                              {ctaText}
                            </a>
                          </p>
                        </td>

                        {/* Gap column */}
                        <td
                          width={gapWidth}
                          style={{
                            width: `${gapWidth}px`,
                            fontSize: "1px",
                            lineHeight: "1px",
                            msoLineHeightRule: "exactly",
                          } as React.CSSProperties}
                        >
                          {"\u00A0"}
                        </td>

                        {/* Image column */}
                        <td
                          width={imageColWidth}
                          valign="middle"
                          style={{
                            width: `${imageColWidth}px`,
                            verticalAlign: "middle",
                            padding: "24px 24px 24px 0",
                          }}
                        >
                          <img
                            src={safeImageUrl}
                            alt={imageAlt}
                            width={imageColWidth - 24}
                            style={{
                              display: "block",
                              width: `${imageColWidth - 24}px`,
                              height: "auto",
                              maxWidth: "100%",
                              border: 0,
                              borderRadius: `${imgRadius}px`,
                              outline: "none",
                              textDecoration: "none",
                            }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    );
  },
};

export const ProductShowcase = withLayout(ProductShowcaseInner);
