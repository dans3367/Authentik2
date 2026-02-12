import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";
import { withLayout, WithLayout } from "../../components/Layout";

type Product = {
  image: string;
  title: string;
  description: string;
  price: string;
};

export type ProductGridProps = WithLayout<{
  products: Product[];
  columns: number;
  gap: number;
}>;

const ProductGridInner: ComponentConfig<ProductGridProps> = {
  fields: {
    products: {
      type: "array",
      arrayFields: {
        image: {
          type: "text",
          label: "Image URL",
        },
        title: {
          type: "text",
          label: "Product Title",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        price: {
          type: "text",
          label: "Price",
        },
      },
      defaultItemProps: {
        image: "https://via.placeholder.com/400x400/f5f5f5/cccccc?text=Product+Image",
        title: "Product Name",
        description: "Product description goes here.",
        price: "$99.99",
      },
    },
    columns: {
      type: "number",
      label: "Number of columns",
      min: 1,
      max: 4,
    },
    gap: {
      type: "number",
      label: "Gap between items (px)",
      min: 0,
      max: 100,
    },
  },
  defaultProps: {
    products: [
      {
        image: "https://via.placeholder.com/400x400/f5f5f5/cccccc?text=Headphones",
        title: "AeroSound Pro Headphones",
        description: "Premium noise-canceling audio with comfortable memory foam earcups.",
        price: "$199.99",
      },
      {
        image: "https://via.placeholder.com/400x400/f5f5f5/cccccc?text=Serum",
        title: "Botanical Facial Serum",
        description: "Hydrating and anti-aging formula with natural plant extracts.",
        price: "$45.50",
      },
      {
        image: "https://via.placeholder.com/400x400/f5f5f5/cccccc?text=Coffee+Maker",
        title: "MiniBrew Portable Espresso",
        description: "Enjoy rich, cafe-style espresso anywhere, anytime.",
        price: "$89.00",
      },
    ],
    columns: 3,
    gap: 24,
  },
  render: ({ products, columns, gap }) => {
    const cols = Math.max(1, Math.min(4, Math.round(columns ?? 3)));
    const cellGap = Math.max(0, gap ?? 24);
    const halfGap = Math.floor(cellGap / 2);

    // Build rows of products based on column count
    const rows: Product[][] = [];
    for (let i = 0; i < products.length; i += cols) {
      rows.push(products.slice(i, i + cols));
    }

    // Percentage width for each column
    const cellWidthPct = `${Math.floor(100 / cols)}%`;

    return (
      <Section>
        {/* 
          Email-compatible table layout wrapped in a fluid container.
          - Outer div: max-width 600px for desktop, width 100% to scale on mobile.
          - Inner table: table-layout:fixed with percentage column widths.
          - Tables naturally scale down when their container shrinks on mobile.
          - No media queries needed — works in Gmail, Outlook, Apple Mail.
        */}
        <div
          style={{
            width: "600px",
            maxWidth: "100%",
            margin: "0 auto",
          }}
        >
          <table
            role="presentation"
            cellPadding="0"
            cellSpacing="0"
            border={0}
            width="100%"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed" as const,
            }}
          >
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((product, colIdx) => (
                    <td
                      key={colIdx}
                      width={cellWidthPct}
                      style={{
                        width: cellWidthPct,
                        verticalAlign: "top",
                        paddingLeft: colIdx > 0 ? `${halfGap}px` : "0",
                        paddingRight: colIdx < cols - 1 ? `${halfGap}px` : "0",
                        paddingBottom: rowIdx < rows.length - 1 ? `${cellGap}px` : "0",
                      }}
                    >
                      {/* Product card */}
                      <table
                        role="presentation"
                        cellPadding="0"
                        cellSpacing="0"
                        border={0}
                        width="100%"
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          backgroundColor: "#ffffff",
                          borderTop: "3px solid #2563eb",
                          borderLeft: "1px solid #e5e7eb",
                          borderRight: "1px solid #e5e7eb",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        <tbody>
                          {/* Product image */}
                          <tr>
                            <td
                              style={{
                                padding: "0",
                                backgroundColor: "#f5f5f5",
                                textAlign: "center" as const,
                                fontSize: "0",
                                lineHeight: "0",
                              }}
                            >
                              <img
                                src={product.image}
                                alt={product.title}
                                width="200"
                                height="auto"
                                style={{
                                  display: "block",
                                  width: "100%",
                                  height: "auto",
                                  maxWidth: "100%",
                                  border: "0",
                                  outline: "none",
                                  textDecoration: "none",
                                }}
                              />
                            </td>
                          </tr>
                          {/* Product content */}
                          <tr>
                            <td
                              style={{
                                padding: "16px 12px 14px 12px",
                                fontFamily: "Arial, Helvetica, sans-serif",
                              }}
                            >
                              <h3
                                style={{
                                  margin: "0",
                                  padding: "0",
                                  fontSize: "16px",
                                  fontWeight: 700,
                                  lineHeight: "1.3",
                                  color: "#0f0f0f",
                                  fontFamily: "Arial, Helvetica, sans-serif",
                                  letterSpacing: "-0.01em",
                                }}
                              >
                                {product.title}
                              </h3>
                              <p
                                style={{
                                  margin: "6px 0 0 0",
                                  padding: "0",
                                  fontSize: "13px",
                                  lineHeight: "1.5",
                                  color: "#737373",
                                  fontFamily: "Arial, Helvetica, sans-serif",
                                  fontWeight: 400,
                                }}
                              >
                                {product.description}
                              </p>
                              <p
                                style={{
                                  margin: "10px 0 0 0",
                                  padding: "0",
                                  fontSize: "16px",
                                  fontWeight: 700,
                                  lineHeight: "1.2",
                                  color: "#0f0f0f",
                                  fontFamily: "Arial, Helvetica, sans-serif",
                                  letterSpacing: "-0.02em",
                                }}
                              >
                                {product.price}
                              </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  ))}
                  {/* Fill empty cells if row is incomplete */}
                  {row.length < cols &&
                    Array.from({ length: cols - row.length }).map((_, i) => (
                      <td
                        key={`empty-${i}`}
                        width={cellWidthPct}
                        style={{
                          width: cellWidthPct,
                          paddingLeft: `${halfGap}px`,
                        }}
                      />
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    );
  },
};

export const ProductGrid = withLayout(ProductGridInner);
