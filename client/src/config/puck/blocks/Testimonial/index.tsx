import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";

export type TestimonialProps = {
  quote: string;
  authorName: string;
  authorTitle: string;
  authorImage: string;
  align: "left" | "center";
  padding: string;
};

const CONTAINER_WIDTH = 552;

export const Testimonial: ComponentConfig<TestimonialProps> = {
  label: "Testimonial",
  fields: {
    quote: {
      type: "textarea",
      contentEditable: true,
    },
    authorName: {
      type: "text",
      label: "Author Name",
      contentEditable: true,
    },
    authorTitle: {
      type: "text",
      label: "Author Title",
      contentEditable: true,
    },
    authorImage: {
      type: "text",
      label: "Author Image URL",
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
    padding: { type: "text", label: "Padding" },
  },
  defaultProps: {
    quote:
      "Design is not just what it looks like and feels like. Design is how it works. The people who are crazy enough to think they can change the world are the ones who do.",
    authorName: "Steve Jobs",
    authorTitle: "Co-founder of Apple",
    authorImage: "",
    align: "center",
    padding: "40px",
  },
  render: ({ quote, authorName, authorTitle, authorImage, align, padding }) => {
    const textAlign = align || "center";
    const padPx = padding || "40px";

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
              maxWidth: "100%",
              borderCollapse: "collapse" as const,
              tableLayout: "fixed" as const,
            }}
          >
            <tbody>
              <tr>
                <td
                  width={CONTAINER_WIDTH}
                  align={textAlign}
                  style={{
                    width: `${CONTAINER_WIDTH}px`,
                    padding: `${padPx} 0`,
                    textAlign,
                    fontFamily: "Arial, Helvetica, sans-serif",
                  }}
                >
                  {/* Quote with decorative marks in separate table cells */}
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
                        <td
                          width={24}
                          valign="top"
                          style={{
                            width: "24px",
                            verticalAlign: "top",
                            fontSize: "32px",
                            lineHeight: "1",
                            color: "#d1d5db",
                            fontFamily: "Georgia, 'Times New Roman', Times, serif",
                            paddingTop: "4px",
                            userSelect: "none" as const,
                          }}
                        >
                          {"\u201C"}
                        </td>
                        <td
                          valign="top"
                          style={{
                            verticalAlign: "top",
                            fontFamily: "Georgia, 'Times New Roman', Times, serif",
                          }}
                        >
                          <p
                            style={{
                              margin: "0",
                              padding: "0",
                              fontSize: "18px",
                              lineHeight: "1.6",
                              color: "#1f2937",
                              fontFamily: "Georgia, 'Times New Roman', Times, serif",
                              fontWeight: 400,
                              fontStyle: "italic",
                              textAlign,
                            }}
                          >
                            {quote}
                          </p>
                        </td>
                        <td
                          width={24}
                          valign="bottom"
                          style={{
                            width: "24px",
                            verticalAlign: "bottom",
                            fontSize: "32px",
                            lineHeight: "1",
                            color: "#d1d5db",
                            fontFamily: "Georgia, 'Times New Roman', Times, serif",
                            paddingBottom: "4px",
                            userSelect: "none" as const,
                          }}
                        >
                          {"\u201D"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Spacer */}
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
                        <td
                          style={{
                            height: "24px",
                            fontSize: "1px",
                            lineHeight: "1px",
                          }}
                        >
                          {"\u00A0"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Author row using table for email compat */}
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                    style={{
                      borderCollapse: "collapse" as const,
                      ...(textAlign === "center"
                        ? { marginLeft: "auto", marginRight: "auto" }
                        : {}),
                    }}
                  >
                    <tbody>
                      <tr>
                        {/* Author image */}
                        {authorImage && (
                          <>
                            <td
                              width={44}
                              height={44}
                              valign="middle"
                              style={{
                                width: "44px",
                                height: "44px",
                                verticalAlign: "middle",
                              }}
                            >
                              {/*[if mso]>
                              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="width:44px;height:44px;" arcsize="50%" strokecolor="#e5e7eb" strokeweight="1px" fillcolor="#f3f4f6">
                              <v:fill type="frame" src="${authorImage}" />
                              </v:roundrect>
                              <![endif]*/}
                              {/*[if !mso]><!*/}
                              <img
                                src={authorImage}
                                alt={authorName}
                                width={44}
                                height={44}
                                style={{
                                  display: "block",
                                  width: "44px",
                                  height: "44px",
                                  borderRadius: "50%",
                                  border: "1px solid #e5e7eb",
                                  objectFit: "cover" as const,
                                }}
                              />
                              {/*<![endif]*/}
                            </td>
                            {/* Gap between image and text */}
                            <td
                              width={12}
                              style={{
                                width: "12px",
                                fontSize: "1px",
                                lineHeight: "1px",
                              }}
                            >
                              {"\u00A0"}
                            </td>
                          </>
                        )}
                        {/* Author name + title */}
                        <td
                          valign="middle"
                          style={{
                            verticalAlign: "middle",
                            fontFamily: "Arial, Helvetica, sans-serif",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "15px",
                              fontWeight: 700,
                              color: "#1f2937",
                              lineHeight: "1.3",
                            }}
                          >
                            {authorName}
                          </span>
                          {authorTitle && (
                            <>
                              <span
                                style={{
                                  fontSize: "15px",
                                  color: "#9ca3af",
                                  padding: "0 6px",
                                }}
                              >
                                &bull;
                              </span>
                              <span
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 400,
                                  color: "#6b7280",
                                  lineHeight: "1.3",
                                }}
                              >
                                {authorTitle}
                              </span>
                            </>
                          )}
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
