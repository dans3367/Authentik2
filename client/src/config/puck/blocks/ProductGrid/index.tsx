import React from "react";
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
        image: { type: "text", label: "Image URL" },
        title: { type: "text", label: "Product Title" },
        description: { type: "textarea", label: "Description" },
        price: { type: "text", label: "Price" },
      },
      defaultItemProps: {
        image: "https://via.placeholder.com/400x400/f5f5f5/cccccc?text=Product+Image",
        title: "Product Name",
        description: "Product description goes here.",
        price: "$99.99",
      },
    },
    columns: { type: "number", label: "Number of columns", min: 1, max: 4 },
    gap: { type: "number", label: "Gap between items (px)", min: 0, max: 100 },
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

    const rows: Product[][] = [];
    for (let i = 0; i < products.length; i += cols) {
      rows.push(products.slice(i, i + cols));
    }

    // Email content area: 600px wrapper - 80px body padding = 520px
    const containerWidth = 520;
    const cellWidth = Math.floor((containerWidth - cellGap * (cols - 1)) / cols);

    // Product card — pure table layout for email client compatibility
    const renderCard = (product: Product) => (
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        width={cellWidth}
        style={{
          width: `${cellWidth}px`,
          borderCollapse: "collapse" as const,
        }}
      >
        <tbody>
          {/* Blue accent top border */}
          <tr>
            <td
              style={{
                height: "3px",
                backgroundColor: "#2563eb",
                fontSize: "1px",
                lineHeight: "1px",
              }}
            >
              {"\u00A0"}
            </td>
          </tr>
          {/* Product image */}
          <tr>
            <td
              style={{
                padding: 0,
                backgroundColor: "#f5f5f5",
                textAlign: "center" as const,
                fontSize: 0,
                lineHeight: 0,
                borderLeft: "1px solid #e5e7eb",
                borderRight: "1px solid #e5e7eb",
              }}
            >
              <img
                src={product.image}
                alt={product.title}
                width={cellWidth - 2}
                height={cellWidth - 2}
                style={{
                  display: "block",
                  width: `${cellWidth - 2}px`,
                  height: "auto",
                  border: 0,
                  outline: "none",
                  textDecoration: "none",
                }}
              />
            </td>
          </tr>
          {/* Product text content */}
          <tr>
            <td
              style={{
                padding: "16px 12px 14px 12px",
                fontFamily: "Arial, Helvetica, sans-serif",
                borderLeft: "1px solid #e5e7eb",
                borderRight: "1px solid #e5e7eb",
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  padding: 0,
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
                  padding: 0,
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
                  padding: 0,
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
    );

    return (
      <Section>
        {/*
          Outer wrapper constrains to email content width.
          Inner table uses table-layout:fixed + colgroup for
          guaranteed column/spacer widths across all email clients.
        */}
        <div style={{ width: `${containerWidth}px`, maxWidth: "100%", margin: "0 auto" }}>
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
            {/* Explicit col widths: product | gap | product | gap | product */}
            <colgroup>
              {Array.from({ length: cols }).flatMap((_, i) => {
                const colEls: React.ReactNode[] = [];
                if (i > 0) {
                  colEls.push(
                    <col key={`gc-${i}`} width={cellGap} style={{ width: `${cellGap}px` }} />
                  );
                }
                colEls.push(
                  <col key={`cc-${i}`} width={cellWidth} style={{ width: `${cellWidth}px` }} />
                );
                return colEls;
              })}
            </colgroup>
            <tbody>
              {rows.flatMap((row, rowIdx) => {
                const totalCols = cols + (cols - 1);
                const trs: React.ReactNode[] = [];

                trs.push(
                  <tr key={`r-${rowIdx}`}>
                    {row.flatMap((product, colIdx) => {
                      const cells: React.ReactNode[] = [];
                      if (colIdx > 0) {
                        cells.push(
                          <td
                            key={`g-${rowIdx}-${colIdx}`}
                            width={cellGap}
                            style={{
                              width: `${cellGap}px`,
                              fontSize: "1px",
                              lineHeight: "1px",
                              msoLineHeightRule: "exactly",
                            } as React.CSSProperties}
                          >
                            {"\u00A0"}
                          </td>
                        );
                      }
                      cells.push(
                        <td
                          key={`c-${rowIdx}-${colIdx}`}
                          width={cellWidth}
                          valign="top"
                          style={{
                            width: `${cellWidth}px`,
                            verticalAlign: "top",
                          }}
                        >
                          {renderCard(product)}
                        </td>
                      );
                      return cells;
                    })}
                    {/* Fill incomplete rows */}
                    {row.length < cols &&
                      Array.from({ length: cols - row.length }).flatMap((_, i) => [
                        <td
                          key={`eg-${rowIdx}-${i}`}
                          width={cellGap}
                          style={{ width: `${cellGap}px` }}
                        />,
                        <td
                          key={`ec-${rowIdx}-${i}`}
                          width={cellWidth}
                          style={{ width: `${cellWidth}px` }}
                        />,
                      ])}
                  </tr>
                );

                // Row spacer
                if (rowIdx < rows.length - 1) {
                  trs.push(
                    <tr key={`rg-${rowIdx}`}>
                      <td
                        colSpan={totalCols}
                        style={{
                          height: `${cellGap}px`,
                          fontSize: "1px",
                          lineHeight: "1px",
                          msoLineHeightRule: "exactly",
                        } as React.CSSProperties}
                      >
                        {"\u00A0"}
                      </td>
                    </tr>
                  );
                }

                return trs;
              })}
            </tbody>
          </table>
        </div>
      </Section>
    );
  },
};

export const ProductGrid = withLayout(ProductGridInner);
