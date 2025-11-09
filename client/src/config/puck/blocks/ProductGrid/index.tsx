import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "../../lib/get-class-name-factory";
import { Section } from "../../components/Section";
import { withLayout, WithLayout } from "../../components/Layout";

const getClassName = getClassNameFactory("ProductGrid", styles);

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
    const sanitizedColumns = Math.max(1, Math.min(4, Math.round(columns ?? 3)));
    const sanitizedGap = Math.max(0, gap ?? 0);
    const gridClassName = getClassName({ [`cols-${sanitizedColumns}`]: true });

    return (
      <Section>
        <div
          className={gridClassName}
          style={{
            gap: `${sanitizedGap}px`,
          }}
        >
          {products.map((product, index) => (
            <div key={index} className={getClassName("item")}>
              <div className={getClassName("image-wrapper")}>
                <img
                  src={product.image}
                  alt={product.title}
                  className={getClassName("image")}
                />
              </div>
              <div className={getClassName("content")}>
                <h3 className={getClassName("title")}>{product.title}</h3>
                <p className={getClassName("description")}>{product.description}</p>
                <p className={getClassName("price")}>{product.price}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  },
};

export const ProductGrid = withLayout(ProductGridInner);
