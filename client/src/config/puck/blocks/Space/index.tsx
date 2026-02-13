import { ComponentConfig } from "@puckeditor/core";
import { spacingOptions } from "../../options";
import { getClassNameFactory } from "../../lib/get-class-name-factory";

import styles from "./styles.module.css";

const getClassName = getClassNameFactory("Space", styles);

export type SpaceProps = {
  direction?: "" | "vertical" | "horizontal";
  size: string;
};

export const Space: ComponentConfig<SpaceProps> = {
  label: "Space",
  fields: {
    size: {
      type: "select",
      options: spacingOptions,
    },
    direction: {
      type: "radio",
      options: [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
        { value: "", label: "Both" },
      ],
    },
  },
  defaultProps: {
    direction: "",
    size: "24px",
  },
  inline: true,
  render: ({ direction, size, puck }) => {
    const isHorizontal = direction === "horizontal";
    const px = parseInt(size, 10) || 24;
    return (
      <div
        ref={puck.dragRef}
        className={getClassName(direction ? { [direction]: true } : {})}
        data-email-spacer={isHorizontal ? "horizontal" : "vertical"}
        data-email-spacer-size={String(px)}
        style={{ "--size": size } as any}
      >
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          width={isHorizontal ? px : "100%"}
          style={{
            width: isHorizontal ? `${px}px` : "100%",
            borderCollapse: "collapse" as const,
          }}
        >
          <tbody>
            <tr>
              <td
                height={isHorizontal ? undefined : px}
                width={isHorizontal ? px : undefined}
                style={{
                  height: isHorizontal ? undefined : `${px}px`,
                  width: isHorizontal ? `${px}px` : undefined,
                  lineHeight: `${px}px`,
                  fontSize: "1px",
                }}
              >
                {"\u00A0"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  },
};
