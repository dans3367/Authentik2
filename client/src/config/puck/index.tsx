import { TFunction } from "i18next";

import { Button } from "./blocks/Button";
import { Card } from "./blocks/Card";
import { Grid } from "./blocks/Grid";
import { Hero } from "./blocks/Hero";
import { Heading } from "./blocks/Heading";
import { Flex } from "./blocks/Flex";
import { Logos } from "./blocks/Logos";
import { Stats } from "./blocks/Stats";
import { Text } from "./blocks/Text";
import { RichText } from "./blocks/RichText";
import { Space } from "./blocks/Space";
import { ProductGrid } from "./blocks/ProductGrid";
import { ProductShowcase } from "./blocks/ProductShowcase";
import { ImageBlock } from "./blocks/Image";
import { Testimonial } from "./blocks/Testimonial";
import { FeaturedArticle } from "./blocks/FeaturedArticle";
import { ArticleSmall } from "./blocks/ArticleSmall";

import { createTranslatedRoot } from "./root";
import Root from "./root";
import { UserConfig } from "./types";
import { initialData } from "./initial-data";

// Helper: deep-clone a field definition and override its label
function tField(field: any, label: string): any {
  return { ...field, label };
}

// Helper: translate options array
function tOptions(options: any[], translations: Record<string, string>): any[] {
  return options.map((opt: any) => ({
    ...opt,
    label: translations[opt.value] ?? opt.label,
  }));
}

// Helper: translate fields that have a label property
function translateFields(fields: any, fieldTranslations: Record<string, string>): any {
  const result: any = {};
  for (const [key, field] of Object.entries(fields as Record<string, any>)) {
    if (fieldTranslations[key] && field && typeof field === "object") {
      result[key] = { ...field, label: fieldTranslations[key] };
    } else {
      result[key] = field;
    }
  }
  return result;
}

/**
 * Build a translated Puck config. Call this with the `t` function from useLanguage/useTranslation.
 * The `t` function is called at build-time (when the language changes), so all labels are resolved.
 */
export function createConfig(t: TFunction): UserConfig {
  const o = (key: string, fallback: string) => t(`puckEditor.options.${key}`, fallback);
  const f = (key: string, fallback: string) => t(`puckEditor.fields.${key}`, fallback);
  const c = (key: string, fallback: string) => t(`puckEditor.components.${key}`, fallback);

  const alignOptions = [
    { label: o("left", "Left"), value: "left" },
    { label: o("center", "Center"), value: "center" },
    { label: o("right", "Right"), value: "right" },
  ];

  return {
    root: createTranslatedRoot(t),
    categories: {
      layout: {
        title: t("puckEditor.categories.layout", "Layout"),
        components: ["Grid", "Flex", "Space"],
      },
      typography: {
        title: t("puckEditor.categories.typography", "Typography"),
        components: ["Heading", "Text", "RichText"],
      },
      interactive: {
        title: t("puckEditor.categories.interactive", "Actions"),
        components: ["Button"],
      },
      content: {
        title: t("puckEditor.categories.content", "Content"),
        components: ["ProductGrid", "ProductShowcase", "Image"],
      },
      other: {
        title: t("puckEditor.categories.other", "Other"),
        components: ["Card", "Hero", "Logos", "Stats", "Testimonial", "FeaturedArticle", "ArticleSmall"],
      },
    },
    components: {
      Button: {
        ...Button,
        label: c("button", "Button"),
        fields: {
          ...Button.fields,
          label: { ...(Button.fields as any).label },
          href: { ...(Button.fields as any).href },
          variant: {
            ...(Button.fields as any).variant,
            options: [
              { label: o("primary", "primary"), value: "primary" },
              { label: o("secondary", "secondary"), value: "secondary" },
            ],
          },
        },
      } as any,
      Card: {
        ...Card,
        label: c("card", "Card"),
      } as any,
      Grid: {
        ...Grid,
        label: c("grid", "Grid"),
      } as any,
      Hero: {
        ...Hero,
        label: c("hero", "Hero"),
        fields: {
          ...Hero.fields,
          title: { ...(Hero.fields as any).title },
          description: { ...(Hero.fields as any).description },
          buttons: {
            ...(Hero.fields as any).buttons,
            arrayFields: {
              ...(Hero.fields as any).buttons.arrayFields,
              href: { ...(Hero.fields as any).buttons.arrayFields.href },
              variant: {
                ...(Hero.fields as any).buttons.arrayFields.variant,
                options: [
                  { label: o("primary", "primary"), value: "primary" },
                  { label: o("secondary", "secondary"), value: "secondary" },
                ],
              },
            },
          },
          align: {
            ...(Hero.fields as any).align,
            options: [
              { label: o("left", "left"), value: "left" },
              { label: o("center", "center"), value: "center" },
            ],
          },
          image: {
            ...(Hero.fields as any).image,
            objectFields: {
              url: { ...(Hero.fields as any).image.objectFields.url, label: f("imageUrl", "Image URL") },
              mode: {
                ...(Hero.fields as any).image.objectFields.mode,
                options: [
                  { label: o("inline", "inline"), value: "inline" },
                  { label: o("background", "bg"), value: "background" },
                ],
              },
            },
          },
          padding: { ...(Hero.fields as any).padding, label: f("padding", "Padding") },
        },
      } as any,
      Heading: {
        ...Heading,
        label: c("heading", "Heading"),
        fields: {
          ...(Heading as any).fields,
          text: { ...(Heading as any).fields.text },
          size: { ...(Heading as any).fields.size, label: f("size", "Size") },
          level: { ...(Heading as any).fields.level, label: f("level", "Level") },
          align: {
            ...(Heading as any).fields.align,
            label: f("align", "Alignment"),
            options: alignOptions,
          },
        },
      } as any,
      Flex: {
        ...Flex,
        label: c("flex", "Flex"),
        fields: {
          ...(Flex as any).fields,
          direction: {
            ...(Flex as any).fields.direction,
            label: f("direction", "Direction"),
            options: [
              { label: o("row", "Row"), value: "row" },
              { label: o("column", "Column"), value: "column" },
            ],
          },
          justifyContent: {
            ...(Flex as any).fields.justifyContent,
            label: f("justifyContent", "Justify Content"),
            options: [
              { label: o("start", "Start"), value: "start" },
              { label: o("center", "Center"), value: "center" },
              { label: o("end", "End"), value: "end" },
            ],
          },
          gap: { ...(Flex as any).fields.gap, label: f("gap", "Gap") },
          wrap: {
            ...(Flex as any).fields.wrap,
            label: f("wrap", "Wrap"),
          },
          items: (Flex as any).fields.items,
        },
      } as any,
      Logos: {
        ...Logos,
        label: c("logos", "Logos"),
      } as any,
      Stats: {
        ...Stats,
        label: c("stats", "Stats"),
      } as any,
      Text: {
        ...Text,
        label: c("text", "Text"),
        fields: {
          ...(Text as any).fields,
          text: { ...(Text as any).fields.text },
          size: { ...(Text as any).fields.size, label: f("size", "Size") },
          align: {
            ...(Text as any).fields.align,
            label: f("align", "Alignment"),
            options: alignOptions,
          },
          color: {
            ...(Text as any).fields.color,
            label: f("color", "Color"),
            options: [
              { label: o("default", "Default"), value: "default" },
              { label: o("muted", "Muted"), value: "muted" },
            ],
          },
          maxWidth: { ...(Text as any).fields.maxWidth, label: f("maxWidth", "Max Width") },
        },
      } as any,
      RichText: {
        ...RichText,
        label: c("richText", "Rich Text"),
        fields: {
          ...(RichText as any).fields,
          html: { ...(RichText as any).fields.html, label: f("htmlContent", "HTML Content") },
          _aiCreator: { ...(RichText as any).fields._aiCreator },
          maxWidth: { ...(RichText as any).fields.maxWidth, label: f("maxWidth", "Max Width") },
        },
      } as any,
      Space: {
        ...Space,
        label: c("space", "Space"),
        fields: {
          ...Space.fields,
          size: { ...(Space.fields as any).size, label: f("size", "Size") },
          direction: {
            ...(Space.fields as any).direction,
            options: [
              { value: "vertical", label: o("vertical", "Vertical") },
              { value: "horizontal", label: o("horizontal", "Horizontal") },
              { value: "", label: o("both", "Both") },
            ],
          },
        },
      } as any,
      ProductGrid: {
        ...ProductGrid,
        label: c("productGrid", "Product Grid"),
        fields: {
          ...(ProductGrid as any).fields,
          products: {
            ...(ProductGrid as any).fields.products,
            label: f("products", "Products"),
            arrayFields: {
              image: { ...(ProductGrid as any).fields.products.arrayFields.image, label: f("imageUrl", "Image URL") },
              title: { ...(ProductGrid as any).fields.products.arrayFields.title, label: f("productTitle", "Product Title") },
              description: { ...(ProductGrid as any).fields.products.arrayFields.description, label: f("description", "Description") },
              price: { ...(ProductGrid as any).fields.products.arrayFields.price, label: f("price", "Price") },
            },
          },
          columns: { ...(ProductGrid as any).fields.columns, label: f("columns", "Number of columns") },
          gap: { ...(ProductGrid as any).fields.gap, label: f("gapBetweenItems", "Gap between items (px)") },
        },
      } as any,
      ProductShowcase: {
        ...ProductShowcase,
        label: c("productShowcase", "Product Showcase"),
        fields: {
          ...(ProductShowcase as any).fields,
          title: { ...(ProductShowcase as any).fields.title, label: f("title", "Title") },
          description: { ...(ProductShowcase as any).fields.description, label: f("description", "Description") },
          ctaText: { ...(ProductShowcase as any).fields.ctaText, label: f("ctaText", "CTA Text") },
          ctaUrl: { ...(ProductShowcase as any).fields.ctaUrl, label: f("ctaLinkUrl", "CTA Link URL") },
          imageUrl: { ...(ProductShowcase as any).fields.imageUrl, label: f("imageUrl", "Image URL") },
          imageAlt: { ...(ProductShowcase as any).fields.imageAlt, label: f("altText", "Image Alt Text") },
          backgroundColor: { ...(ProductShowcase as any).fields.backgroundColor, label: f("backgroundColor", "Background Color") },
          textColor: { ...(ProductShowcase as any).fields.textColor, label: f("textColor", "Text Color (hex)") },
          ctaColor: { ...(ProductShowcase as any).fields.ctaColor, label: f("ctaColor", "CTA Text Color (hex)") },
          borderRadius: { ...(ProductShowcase as any).fields.borderRadius, label: f("cardBorderRadius", "Card Border Radius (px)") },
          imageBorderRadius: { ...(ProductShowcase as any).fields.imageBorderRadius, label: f("imageBorderRadius", "Image Border Radius (px)") },
        },
      } as any,
      Image: {
        ...ImageBlock,
        label: c("image", "Image"),
        fields: {
          ...(ImageBlock as any).fields,
          images: {
            ...(ImageBlock as any).fields.images,
            label: f("images", "Images"),
            arrayFields: {
              src: { ...(ImageBlock as any).fields.images.arrayFields.src, label: f("imageUrl", "Image URL") },
              alt: { ...(ImageBlock as any).fields.images.arrayFields.alt, label: f("altText", "Alt Text") },
              href: { ...(ImageBlock as any).fields.images.arrayFields.href, label: f("linkUrl", "Link URL (optional)") },
            },
          },
          align: {
            ...(ImageBlock as any).fields.align,
            label: f("align", "Alignment"),
            options: alignOptions,
          },
          sizing: {
            ...(ImageBlock as any).fields.sizing,
            label: f("sizingMode", "Sizing Mode"),
            options: [
              { label: o("autoOriginalSize", "Auto (original size)"), value: "auto" },
              { label: o("presetSizes", "Preset sizes"), value: "preset" },
              { label: o("fillFullWidth", "Fill (full width)"), value: "fill" },
              { label: o("fixed", "Fixed"), value: "fixed" },
            ],
          },
          autoSize: {
            ...(ImageBlock as any).fields.autoSize,
            label: f("size", "Size"),
            options: [
              { label: o("small", "Small"), value: "small" },
              { label: o("medium", "Medium"), value: "medium" },
              { label: o("large", "Large"), value: "large" },
              { label: o("xLarge", "X-Large"), value: "xlarge" },
            ],
          },
          width: { ...(ImageBlock as any).fields.width, label: f("width", "Width (px)") },
          height: { ...(ImageBlock as any).fields.height, label: f("height", "Height (px)") },
          gap: { ...(ImageBlock as any).fields.gap, label: f("gapBetweenImages", "Gap between images (px)") },
          borderRadius: { ...(ImageBlock as any).fields.borderRadius, label: f("borderRadius", "Border Radius (px)") },
          caption: { ...(ImageBlock as any).fields.caption, label: f("caption", "Caption (optional)") },
        },
      } as any,
      Testimonial: {
        ...Testimonial,
        label: c("testimonial", "Testimonial"),
        fields: {
          ...Testimonial.fields,
          quote: { ...(Testimonial.fields as any).quote, label: f("quote", "Quote") },
          authorName: { ...(Testimonial.fields as any).authorName, label: f("authorName", "Author Name") },
          authorTitle: { ...(Testimonial.fields as any).authorTitle, label: f("authorTitle", "Author Title") },
          authorImage: { ...(Testimonial.fields as any).authorImage, label: f("authorImageUrl", "Author Image URL") },
          align: {
            ...(Testimonial.fields as any).align,
            label: f("align", "Alignment"),
            options: [
              { label: o("left", "Left"), value: "left" },
              { label: o("center", "Center"), value: "center" },
            ],
          },
          padding: { ...(Testimonial.fields as any).padding, label: f("padding", "Padding") },
        },
      } as any,
      FeaturedArticle: {
        ...FeaturedArticle,
        label: c("featuredArticle", "Featured Article"),
        fields: {
          ...FeaturedArticle.fields,
          image: {
            ...(FeaturedArticle.fields as any).image,
            objectFields: {
              url: { ...(FeaturedArticle.fields as any).image.objectFields.url, label: f("imageUrl", "Image URL") },
              alt: { ...(FeaturedArticle.fields as any).image.objectFields.alt, label: f("altText", "Alt Text") },
            },
          },
          label: { ...(FeaturedArticle.fields as any).label, label: f("label", "Label") },
          title: { ...(FeaturedArticle.fields as any).title, label: f("title", "Title") },
          description: { ...(FeaturedArticle.fields as any).description, label: f("description", "Description") },
          buttonText: { ...(FeaturedArticle.fields as any).buttonText, label: f("buttonText", "Button Text") },
          buttonHref: { ...(FeaturedArticle.fields as any).buttonHref, label: f("buttonUrl", "Button URL") },
          buttonColor: { ...(FeaturedArticle.fields as any).buttonColor, label: f("buttonColor", "Button Color (hex)") },
          borderRadius: { ...(FeaturedArticle.fields as any).borderRadius, label: f("imageBorderRadius", "Image Border Radius (px)") },
        },
      } as any,
      ArticleSmall: {
        ...ArticleSmall,
        label: c("articleSmall", "Article Small"),
        fields: {
          ...ArticleSmall.fields,
          image: {
            ...(ArticleSmall.fields as any).image,
            objectFields: {
              url: { ...(ArticleSmall.fields as any).image.objectFields.url, label: f("imageUrl", "Image URL") },
              alt: { ...(ArticleSmall.fields as any).image.objectFields.alt, label: f("altText", "Alt Text") },
            },
          },
          label: { ...(ArticleSmall.fields as any).label, label: f("label", "Label") },
          title: { ...(ArticleSmall.fields as any).title, label: f("title", "Title") },
          description: { ...(ArticleSmall.fields as any).description, label: f("description", "Description") },
          linkText: { ...(ArticleSmall.fields as any).linkText, label: f("linkText", "Link Text") },
          linkHref: { ...(ArticleSmall.fields as any).linkHref, label: f("linkUrl", "Link URL") },
          linkColor: { ...(ArticleSmall.fields as any).linkColor, label: f("linkColor", "Link Color (hex)") },
          imagePosition: {
            ...(ArticleSmall.fields as any).imagePosition,
            label: f("imagePosition", "Image Position"),
            options: [
              { label: o("left", "Left"), value: "left" },
              { label: o("right", "Right"), value: "right" },
            ],
          },
          borderRadius: { ...(ArticleSmall.fields as any).borderRadius, label: f("imageBorderRadius", "Image Border Radius (px)") },
        },
      } as any,
    },
  };
}

// Static config (English fallback) for backward compatibility
export const config: UserConfig = {
  root: Root as any,
  categories: {
    layout: {
      components: ["Grid", "Flex", "Space"],
    },
    typography: {
      components: ["Heading", "Text", "RichText"],
    },
    interactive: {
      title: "Actions",
      components: ["Button"],
    },
    content: {
      title: "Content",
      components: ["ProductGrid", "ProductShowcase", "Image"],
    },
    other: {
      title: "Other",
      components: ["Card", "Hero", "Logos", "Stats", "Testimonial", "FeaturedArticle", "ArticleSmall"],
    },
  },
  components: {
    Button,
    Card,
    Grid,
    Hero,
    Heading,
    Flex,
    Logos,
    Stats,
    Text,
    RichText,
    Space,
    ProductGrid,
    ProductShowcase,
    Image: ImageBlock,
    Testimonial,
    FeaturedArticle,
    ArticleSmall,
  },
};

export { initialData };
export default config;
