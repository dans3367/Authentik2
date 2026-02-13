import { CSSProperties, forwardRef, ReactNode } from "react";
import {
  ComponentConfig,
  DefaultComponentProps,
  ObjectField,
} from "@puckeditor/core";
import { spacingOptions } from "../../options";
import { getClassNameFactory } from "../../lib/get-class-name-factory";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("Layout", styles);

type LayoutFieldProps = {
  padding?: string;
  spanCol?: number;
  spanRow?: number;
  grow?: boolean;
};

export type WithLayout<Props extends DefaultComponentProps> = Props & {
  layout?: LayoutFieldProps;
};

type LayoutProps = WithLayout<{
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export const layoutField: ObjectField<LayoutFieldProps> = {
  type: "object",
  objectFields: {
    spanCol: {
      label: "Grid Columns",
      type: "number",
      min: 1,
      max: 12,
    },
    spanRow: {
      label: "Grid Rows",
      type: "number",
      min: 1,
      max: 12,
    },
    grow: {
      label: "Flex Grow",
      type: "radio",
      options: [
        { label: "true", value: true },
        { label: "false", value: false },
      ],
    },
    padding: {
      type: "select",
      label: "Vertical Padding",
      options: [{ label: "0px", value: "0px" }, ...spacingOptions],
    },
  },
};

const Layout = forwardRef<HTMLDivElement, LayoutProps>(
  ({ children, className, layout, style }, ref) => {
    return (
      <div
        className={className}
        style={{
          gridColumn: layout?.spanCol
            ? `span ${Math.max(Math.min(layout.spanCol, 12), 1)}`
            : undefined,
          gridRow: layout?.spanRow
            ? `span ${Math.max(Math.min(layout.spanRow, 12), 1)}`
            : undefined,
          paddingTop: layout?.padding,
          paddingBottom: layout?.padding,
          flex: layout?.grow ? "1 1 0" : undefined,
          ...style,
        }}
        ref={ref}
      >
        {children}
      </div>
    );
  }
);

Layout.displayName = "Layout";

export { Layout };

export function withLayout<
  ThisComponentConfig extends ComponentConfig<any> = ComponentConfig
>(componentConfig: ThisComponentConfig): ThisComponentConfig {
  // Pre-compute resolved field configs for each parent context so that
  // resolveFields returns stable references. Creating new objects on every
  // call caused Puck to re-render the fields panel on each keystroke,
  // making contentEditable / textarea inputs lose focus.
  const { layout: _baseIgnored, ...baseFieldsWithoutLayout } =
    componentConfig.fields as any;

  const gridLayoutField = {
    ...layoutField,
    objectFields: {
      spanCol: layoutField.objectFields.spanCol,
      spanRow: layoutField.objectFields.spanRow,
      padding: layoutField.objectFields.padding,
    },
  };
  const flexLayoutField = {
    ...layoutField,
    objectFields: {
      grow: layoutField.objectFields.grow,
      padding: layoutField.objectFields.padding,
    },
  };
  const defaultLayoutField = {
    ...layoutField,
    objectFields: {
      padding: layoutField.objectFields.padding,
    },
  };

  const cachedGridFields = { ...baseFieldsWithoutLayout, layout: gridLayoutField };
  const cachedFlexFields = { ...baseFieldsWithoutLayout, layout: flexLayoutField };
  const cachedDefaultFields = { ...baseFieldsWithoutLayout, layout: defaultLayoutField };

  return {
    ...componentConfig,
    fields: {
      ...componentConfig.fields,
      layout: layoutField,
    },
    defaultProps: {
      ...componentConfig.defaultProps,
      layout: {
        spanCol: 1,
        spanRow: 1,
        padding: "0px",
        grow: false,
        ...componentConfig.defaultProps?.layout,
      },
    },
    resolveFields: (data, params) => {
      // If the inner component has its own resolveFields, delegate to it
      if (componentConfig.resolveFields) {
        const innerResolved = componentConfig.resolveFields(data, {
          ...params,
          fields: { ...componentConfig.fields, layout: layoutField },
        }) as any;

        // Handle async resolveFields
        const attach = (resolved: any) => {
          const { layout: _ignored, ...rest } = resolved;
          if (params.parent?.type === "Grid") return { ...rest, layout: gridLayoutField };
          if (params.parent?.type === "Flex") return { ...rest, layout: flexLayoutField };
          return { ...rest, layout: defaultLayoutField };
        };

        if (innerResolved && typeof innerResolved.then === "function") {
          return innerResolved.then(attach);
        }
        return attach(innerResolved);
      }

      // Return pre-computed stable references — no new objects created
      if (params.parent?.type === "Grid") return cachedGridFields;
      if (params.parent?.type === "Flex") return cachedFlexFields;
      return cachedDefaultFields;
    },
    inline: true,
    render: (props) => (
      <Layout
        className={getClassName()}
        layout={props.layout as LayoutFieldProps}
        ref={props.puck.dragRef}
      >
        {componentConfig.render(props)}
      </Layout>
    ),
  };
}
