import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

// ── Variable definitions ────────────────────────────────────────────────────

export interface HandlebarVariableItem {
  key: string;
  label: string;
  category?: string;
}

export const DEFAULT_HANDLEBAR_VARIABLES: HandlebarVariableItem[] = [
  { key: "first_name", label: "First Name", category: "Contact" },
  { key: "last_name", label: "Last Name", category: "Contact" },
  { key: "email", label: "Email", category: "Contact" },
  { key: "phone", label: "Phone", category: "Contact" },
  { key: "address", label: "Address", category: "Contact" },
  { key: "office_hours", label: "Office Hours", category: "Business" },
  { key: "company_name", label: "Company Name", category: "Business" },
  { key: "unsubscribe_url", label: "Unsubscribe URL", category: "Links" },
];

// ── Inline Node View (the pill) ─────────────────────────────────────────────

function HandlebarNodeView({ node }: { node: { attrs: { variable: string } } }) {
  const variable = node.attrs.variable || "unknown";
  const label =
    DEFAULT_HANDLEBAR_VARIABLES.find((v) => v.key === variable)?.label ||
    variable.replace(/_/g, " ");

  return (
    <NodeViewWrapper as="span" className="handlebar-variable-node">
      <span className="handlebar-pill" contentEditable={false}>
        <span className="handlebar-pill-braces">{"{"}</span>
        <span className="handlebar-pill-label">{label}</span>
        <span className="handlebar-pill-braces">{"}"}</span>
      </span>
    </NodeViewWrapper>
  );
}

// ── TipTap Node Extension ───────────────────────────────────────────────────

export interface HandlebarVariableOptions {
  variables: HandlebarVariableItem[];
  HTMLAttributes: Record<string, any>;
}

export const HandlebarVariable = Node.create<HandlebarVariableOptions>({
  name: "handlebarVariable",

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      variables: DEFAULT_HANDLEBAR_VARIABLES,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      variable: {
        default: "first_name",
        parseHTML: (element) => element.getAttribute("data-variable"),
        renderHTML: (attributes) => ({
          "data-variable": attributes.variable,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="handlebar-variable"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const variable = HTMLAttributes["data-variable"] || "unknown";

    return [
      "span",
      mergeAttributes(
        { "data-type": "handlebar-variable" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `{{${variable}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HandlebarNodeView, {
      as: "span",
    });
  },
});

export default HandlebarVariable;
