import { Puck, type Config, type Fields } from "@measured/puck";
import "@measured/puck/puck.css";
import { AITextarea } from "./AITextarea";
import { TextComponentWithAI } from "./TextComponentWithAI";

// Newsletter-focused Puck editor configuration
const config: Config = {
  components: {
    Heading: {
      fields: {
        text: { type: "text", label: "Heading Text" },
        level: {
          type: "select",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
          label: "Heading Level",
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        text: "Your Heading Here",
        level: "h2",
        align: "left",
      },
      render: ({ text, level, align }) => {
        const Component = level as "h1" | "h2" | "h3";
        const fontSize = {
          h1: "text-4xl",
          h2: "text-3xl",
          h3: "text-2xl",
        };
        return (
          <Component
            className={`${fontSize[level as keyof typeof fontSize]} font-bold mb-4 text-${align}`}
          >
            {text}
          </Component>
        );
      },
    },
    Text: {
      fields: {
        content: {
          type: "custom",
          label: "Text Content",
          render: ({ value, onChange }) => (
            <AITextarea
              value={value || ""}
              onChange={onChange}
              placeholder="Enter your text content here..."
            />
          ),
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
            { label: "Justify", value: "justify" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        content: "Enter your text content here...",
        align: "left",
      },
      render: ({ content, align, puck }) => (
        <TextComponentWithAI
          content={content}
          align={align}
          puck={{
            isEditing: true, // Always show in edit mode when rendering
          }}
          onChange={() => {
            // Puck manages state updates internally via fields
          }}
        />
      ),
    },
    Image: {
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt Text" },
        width: {
          type: "radio",
          options: [
            { label: "Small (300px)", value: "300" },
            { label: "Medium (500px)", value: "500" },
            { label: "Large (700px)", value: "700" },
            { label: "Full Width", value: "100%" },
          ],
          label: "Width",
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        src: "https://via.placeholder.com/600x400",
        alt: "Newsletter image",
        width: "500",
        align: "center",
      },
      render: ({ src, alt, width, align }) => {
        const alignClass = {
          left: "mr-auto",
          center: "mx-auto",
          right: "ml-auto",
        };
        return (
          <div className={`mb-4 flex ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
            <img
              src={src}
              alt={alt}
              style={{ maxWidth: width === "100%" ? "100%" : `${width}px` }}
              className={`rounded-lg ${alignClass[align as keyof typeof alignClass]}`}
            />
          </div>
        );
      },
    },
    Button: {
      fields: {
        text: { type: "text", label: "Button Text" },
        href: { type: "text", label: "Link URL" },
        style: {
          type: "radio",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
          ],
          label: "Button Style",
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        text: "Click Here",
        href: "#",
        style: "primary",
        align: "center",
      },
      render: ({ text, href, style, align }) => {
        const styleClasses = {
          primary: "bg-blue-600 text-white hover:bg-blue-700",
          secondary: "bg-gray-600 text-white hover:bg-gray-700",
          outline: "border-2 border-blue-600 text-blue-600 bg-transparent hover:bg-blue-50",
        };
        const alignClass = {
          left: "justify-start",
          center: "justify-center",
          right: "justify-end",
        };
        return (
          <div className={`mb-4 flex ${alignClass[align as keyof typeof alignClass]}`}>
            <a
              href={href}
              className={`inline-block px-8 py-3 rounded-lg font-semibold transition-colors ${
                styleClasses[style as keyof typeof styleClasses]
              }`}
            >
              {text}
            </a>
          </div>
        );
      },
    },
    Divider: {
      fields: {
        style: {
          type: "radio",
          options: [
            { label: "Solid", value: "solid" },
            { label: "Dashed", value: "dashed" },
            { label: "Dotted", value: "dotted" },
          ],
          label: "Line Style",
        },
        thickness: {
          type: "radio",
          options: [
            { label: "Thin", value: "1" },
            { label: "Medium", value: "2" },
            { label: "Thick", value: "4" },
          ],
          label: "Thickness",
        },
      },
      defaultProps: {
        style: "solid",
        thickness: "1",
      },
      render: ({ style, thickness }) => {
        const styleMap = {
          solid: "border-solid",
          dashed: "border-dashed",
          dotted: "border-dotted",
        };
        return (
          <hr
            className={`my-6 ${styleMap[style as keyof typeof styleMap]}`}
            style={{ borderTopWidth: `${thickness}px` }}
          />
        );
      },
    },
    Spacer: {
      fields: {
        size: {
          type: "radio",
          options: [
            { label: "Small (16px)", value: "16" },
            { label: "Medium (32px)", value: "32" },
            { label: "Large (64px)", value: "64" },
            { label: "Extra Large (96px)", value: "96" },
          ],
          label: "Space Size",
        },
      },
      defaultProps: {
        size: "32",
      },
      render: ({ size }) => <div style={{ height: `${size}px` }} />,
    },
  },
};

interface PuckNewsletterEditorProps {
  initialData?: any;
  onChange?: (data: any) => void;
}

export function PuckNewsletterEditor({ initialData, onChange }: PuckNewsletterEditorProps) {
  const data = initialData || {
    content: [],
    root: { props: {} },
  };

  const handlePublish = async (data: any) => {
    if (onChange) {
      onChange(data);
    }
  };

  return (
    <div className="puck-newsletter-editor w-full min-h-screen">
      <Puck
        config={config}
        data={data}
        onPublish={handlePublish}
      />
    </div>
  );
}
