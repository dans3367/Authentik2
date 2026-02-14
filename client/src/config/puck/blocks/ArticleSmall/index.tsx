import React from "react";
import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";

export type ArticleSmallProps = {
  label: string;
  title: string;
  description: string;
  linkText: string;
  linkHref: string;
  linkColor: string;
  image: {
    url: string;
    alt: string;
  };
  imagePosition: "left" | "right";
  borderRadius: number;
};

const CONTAINER_WIDTH = 552;
const GAP = 24;

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

export const ArticleSmall: ComponentConfig<ArticleSmallProps> = {
  label: "Article Small",
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
    linkText: { type: "text", label: "Link Text" },
    linkHref: { type: "text", label: "Link URL" },
    linkColor: { type: "text", label: "Link Color (hex)" },
    imagePosition: {
      type: "radio",
      label: "Image Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    borderRadius: { type: "number", label: "Image Border Radius (px)", min: 0, max: 50 },
  },
  defaultProps: {
    label: "What's new",
    title: "Versatile Comfort",
    description:
      "Experience ultimate comfort and versatility with our furniture collection, designed to adapt to your ever-changing needs.",
    linkText: "Read more",
    linkHref: "#",
    linkColor: "#4f46e5",
    image: {
      url: "https://placehold.co/240x240/e2e8f0/64748b?text=Image",
      alt: "Article image",
    },
    imagePosition: "right",
    borderRadius: 8,
  },
  render: ({ label, title, description, linkText, linkHref, linkColor, image, imagePosition, borderRadius }) => {
    const color = linkColor || "#4f46e5";
    const radius = borderRadius ?? 8;
    const imgWidth = Math.floor((CONTAINER_WIDTH - GAP) * 0.4);
    const textWidth = CONTAINER_WIDTH - GAP - imgWidth;

    const textCell = (
      <td
        width={textWidth}
        valign="top"
        style={{
          width: `${textWidth}px`,
          verticalAlign: "top",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {label && (
          <p
            style={{
              margin: "0 0 6px 0",
              padding: "0",
              fontSize: "14px",
              fontWeight: 700,
              lineHeight: "1.4",
              color: color,
              fontFamily: "Arial, Helvetica, sans-serif",
              letterSpacing: "0.03em",
            }}
          >
            {label}
          </p>
        )}

        <h3
          style={{
            margin: "0 0 10px 0",
            padding: "0",
            fontSize: "22px",
            fontWeight: 800,
            lineHeight: "1.25",
            color: "#0f0f0f",
            fontFamily: "Arial, Helvetica, sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: "0 0 16px 0",
            padding: "0",
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: "1.55",
            color: "#6b7280",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          {description}
        </p>

        <a
          href={getSafeHref(linkHref)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: color,
            fontFamily: "Arial, Helvetica, sans-serif",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {linkText}
        </a>
      </td>
    );

    const gapCell = (
      <td
        width={GAP}
        style={{
          width: `${GAP}px`,
          fontSize: "1px",
          lineHeight: "1px",
        }}
      >
        {"\u00A0"}
      </td>
    );

    const imageCell = (
      <td
        width={imgWidth}
        valign="top"
        style={{
          width: `${imgWidth}px`,
          verticalAlign: "top",
        }}
      >
        {image?.url && (
          <img
            src={image.url}
            alt={image.alt || title}
            width={imgWidth}
            style={{
              display: "block",
              width: `${imgWidth}px`,
              height: "auto",
              maxWidth: "100%",
              border: 0,
              outline: "none",
              textDecoration: "none",
              borderRadius: radius ? `${radius}px` : undefined,
            }}
          />
        )}
      </td>
    );

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
                {imagePosition === "left" ? (
                  <>
                    {imageCell}
                    {gapCell}
                    {textCell}
                  </>
                ) : (
                  <>
                    {textCell}
                    {gapCell}
                    {imageCell}
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    );
  },
};
