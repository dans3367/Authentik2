import React from "react";
import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";

export type FeaturedArticleProps = {
  label: string;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  buttonColor: string;
  image: {
    url: string;
    alt: string;
  };
  borderRadius: number;
};

const CONTAINER_WIDTH = 552;

const getSafeHref = (href: string) => {
  const trimmed = href?.trim();
  if (!trimmed) return "#";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : "#";
  } catch {
    return "#";
  }
};

export const FeaturedArticle: ComponentConfig<FeaturedArticleProps> = {
  fields: {
    image: {
      type: "object",
      objectFields: {
        url: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt Text" },
      },
    },
    label: { type: "text", label: "Label" },
    title: { type: "text", label: "Title", contentEditable: true },
    description: { type: "textarea", label: "Description", contentEditable: true },
    buttonText: { type: "text", label: "Button Text" },
    buttonHref: { type: "text", label: "Button URL" },
    buttonColor: { type: "text", label: "Button Color (hex)" },
    borderRadius: { type: "number", label: "Image Border Radius (px)", min: 0, max: 50 },
  },
  defaultProps: {
    label: "Our new article",
    title: "Designing with Furniture",
    description:
      "Unleash your inner designer as we explore how furniture plays a vital role in creating stunning interiors, offering insights into choosing the right pieces, arranging them harmoniously, and infusing your space with personality.",
    buttonText: "Read more",
    buttonHref: "#",
    buttonColor: "#4f46e5",
    image: {
      url: "https://placehold.co/552x320/e2e8f0/64748b?text=Featured+Image",
      alt: "Featured article",
    },
    borderRadius: 12,
  },
  render: ({ label, title, description, buttonText, buttonHref, buttonColor, image, borderRadius }) => {
    const radius = borderRadius ?? 12;
    const color = buttonColor || "#4f46e5";

    return (
      <Section>
        <div style={{ maxWidth: `${CONTAINER_WIDTH}px`, width: "100%", margin: "0 auto" }}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            width="100%"
            style={{
              width: "100%",
              maxWidth: `${CONTAINER_WIDTH}px`,
              borderCollapse: "collapse" as const,
            }}
          >
            <tbody>
              {image?.url && (
                <tr>
                  <td
                    align="center"
                    style={{ padding: "0 0 24px 0" }}
                  >
                    <img
                      src={image.url}
                      alt={image.alt || title}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "auto",
                        maxWidth: "100%",
                        border: 0,
                        outline: "none",
                        textDecoration: "none",
                        borderRadius: radius ? `${radius}px` : undefined,
                      }}
                    />
                  </td>
                </tr>
              )}

              {label && (
                <tr>
                  <td
                    align="center"
                    style={{
                      padding: "0 0 8px 0",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: "14px",
                      fontWeight: 700,
                      lineHeight: "1.4",
                      color: color,
                      textAlign: "center",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.03em",
                    }}
                  >
                    {label}
                  </td>
                </tr>
              )}

              <tr>
                <td
                  align="center"
                  style={{
                    padding: "0 0 12px 0",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: "28px",
                    fontWeight: 800,
                    lineHeight: "1.2",
                    color: "#0f0f0f",
                    textAlign: "center",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {title}
                </td>
              </tr>

              <tr>
                <td
                  align="center"
                  style={{
                    padding: "0 24px 24px 24px",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: "16px",
                    fontWeight: 400,
                    lineHeight: "1.6",
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  {description}
                </td>
              </tr>

              <tr>
                <td align="center" style={{ padding: "0 0 8px 0" }}>
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                    style={{
                      borderCollapse: "collapse" as const,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td>
                          <a
                            href={getSafeHref(buttonHref)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-block",
                              padding: "14px 36px",
                              backgroundColor: color,
                              color: "#ffffff",
                              fontFamily: "Arial, Helvetica, sans-serif",
                              fontSize: "16px",
                              fontWeight: 700,
                              textDecoration: "none",
                              borderRadius: "6px",
                              lineHeight: "1",
                              msoLineHeightRule: "exactly",
                            } as React.CSSProperties}
                          >
                            {buttonText}
                          </a>
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
