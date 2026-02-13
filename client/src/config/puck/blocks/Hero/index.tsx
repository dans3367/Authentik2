import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";

export type HeroProps = {
  title: string;
  description: string;
  align?: string;
  padding: string;
  image?: {
    mode?: "inline" | "background";
    url?: string;
  };
  buttons: {
    label: string;
    href: string;
    variant?: "primary" | "secondary";
  }[];
};

// Email content area: 600px wrapper - 80px body padding = 520px
const CONTAINER_WIDTH = 520;

const getSafeHref = (href: string) => {
  const trimmed = href?.trim();
  if (!trimmed) {
    return "#";
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : "#";
  } catch {
    const lower = trimmed.toLowerCase();
    return lower.startsWith("http://") || lower.startsWith("https://") ? trimmed : "#";
  }
};

export const Hero: ComponentConfig<HeroProps> = {
  fields: {
    title: { type: "text", contentEditable: true },
    description: { type: "textarea", contentEditable: true },
    buttons: {
      type: "array",
      min: 1,
      max: 4,
      getItemSummary: (item) => item.label || "Button",
      arrayFields: {
        label: { type: "text", contentEditable: true },
        href: { type: "text" },
        variant: {
          type: "select",
          options: [
            { label: "primary", value: "primary" },
            { label: "secondary", value: "secondary" },
          ],
        },
      },
      defaultItemProps: {
        label: "Button",
        href: "#",
      },
    },
    align: {
      type: "radio",
      options: [
        { label: "left", value: "left" },
        { label: "center", value: "center" },
      ],
    },
    image: {
      type: "object",
      objectFields: {
        url: { type: "text", label: "Image URL" },
        mode: {
          type: "radio",
          options: [
            { label: "inline", value: "inline" },
            { label: "bg", value: "background" },
          ],
        },
      },
    },
    padding: { type: "text" },
  },
  defaultProps: {
    title: "Hero",
    align: "left",
    description: "Description",
    buttons: [{ label: "Learn more", href: "#" }],
    padding: "64px",
  },
  render: ({ align, title, description, buttons, padding, image }) => {
    const textAlign = (align === "center" ? "center" : "left") as React.CSSProperties["textAlign"];
    const padPx = padding || "64px";
    const hasInlineImage = align !== "center" && image?.mode === "inline" && image?.url;
    const hasBgImage = image?.mode === "background" && image?.url;

    // Button styles
    const primaryBtn: React.CSSProperties = {
      display: "inline-block",
      padding: "14px 28px",
      backgroundColor: "#2563eb",
      color: "#ffffff",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "16px",
      fontWeight: 700,
      textDecoration: "none",
      borderRadius: "6px",
      lineHeight: "1",
      msoLineHeightRule: "exactly",
    } as React.CSSProperties;

    const secondaryBtn: React.CSSProperties = {
      ...primaryBtn,
      backgroundColor: "transparent",
      color: "#2563eb",
      border: "2px solid #2563eb",
    };

    // Render a single VML-safe button (works in Outlook + all webmail)
    const renderButton = (btn: HeroProps["buttons"][number], idx: number) => (
      <a
        key={idx}
        href={getSafeHref(btn.href)}
        style={btn.variant === "secondary" ? secondaryBtn : primaryBtn}
        target="_blank"
        rel="noopener noreferrer"
      >
        {btn.label}
      </a>
    );

    // Content column width when inline image is present
    const contentWidth = hasInlineImage ? Math.floor(CONTAINER_WIDTH * 0.55) : CONTAINER_WIDTH;
    const imageWidth = hasInlineImage ? CONTAINER_WIDTH - contentWidth - 24 : 0; // 24px gap

    return (
      <Section>
        <div style={{ width: `${CONTAINER_WIDTH}px`, maxWidth: "100%", margin: "0 auto" }}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            width={CONTAINER_WIDTH}
            style={{
              width: `${CONTAINER_WIDTH}px`,
              borderCollapse: "collapse" as const,
              tableLayout: "fixed" as const,
            }}
          >
            <tbody>
              <tr>
                <td
                  width={CONTAINER_WIDTH}
                  style={{
                    width: `${CONTAINER_WIDTH}px`,
                    padding: `${padPx} 0`,
                    textAlign,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    ...(hasBgImage
                      ? {
                          backgroundImage: `url('${image!.url}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                        }
                      : {}),
                  }}
                >
                  {/* Inner layout table for content + optional inline image */}
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                    width="100%"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse" as const,
                    }}
                  >
                    <tbody>
                      <tr>
                        {/* Text content column */}
                        <td
                          width={contentWidth}
                          valign="middle"
                          style={{
                            width: `${contentWidth}px`,
                            verticalAlign: "middle",
                            textAlign,
                          }}
                        >
                          {/* Title */}
                          <h1
                            style={{
                              margin: 0,
                              padding: 0,
                              fontSize: "36px",
                              fontWeight: 700,
                              lineHeight: "1.15",
                              color: hasBgImage ? "#ffffff" : "#0f0f0f",
                              fontFamily: "Arial, Helvetica, sans-serif",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {title}
                          </h1>

                          {/* Description */}
                          <p
                            style={{
                              margin: "16px 0 0 0",
                              padding: 0,
                              fontSize: "16px",
                              lineHeight: "1.5",
                              color: hasBgImage ? "rgba(255,255,255,0.85)" : "#6b7280",
                              fontFamily: "Arial, Helvetica, sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            {description}
                          </p>

                          {/* Buttons */}
                          {buttons.length > 0 && (
                            <table
                              role="presentation"
                              cellPadding={0}
                              cellSpacing={0}
                              border={0}
                              style={{
                                borderCollapse: "collapse" as const,
                                marginTop: "24px",
                                ...(align === "center"
                                  ? { marginLeft: "auto", marginRight: "auto" }
                                  : {}),
                              }}
                            >
                              <tbody>
                                <tr>
                                  {buttons.map((btn, i) => (
                                    <React.Fragment key={i}>
                                      {i > 0 && (
                                        <td
                                          style={{
                                            width: "12px",
                                            fontSize: "1px",
                                            lineHeight: "1px",
                                          }}
                                        >
                                          {"\u00A0"}
                                        </td>
                                      )}
                                      <td>{renderButton(btn, i)}</td>
                                    </React.Fragment>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </td>

                        {/* Inline image column */}
                        {hasInlineImage && (
                          <>
                            {/* Gap */}
                            <td
                              width={24}
                              style={{
                                width: "24px",
                                fontSize: "1px",
                                lineHeight: "1px",
                              }}
                            >
                              {"\u00A0"}
                            </td>
                            <td
                              width={imageWidth}
                              valign="middle"
                              style={{
                                width: `${imageWidth}px`,
                                verticalAlign: "middle",
                              }}
                            >
                              <img
                                src={image!.url}
                                alt={title}
                                width={imageWidth}
                                style={{
                                  display: "block",
                                  width: `${imageWidth}px`,
                                  height: "auto",
                                  maxWidth: "100%",
                                  border: 0,
                                  borderRadius: "8px",
                                  outline: "none",
                                  textDecoration: "none",
                                }}
                              />
                            </td>
                          </>
                        )}
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
