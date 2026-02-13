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
    return (
      <div
        ref={puck.dragRef}
        className={getClassName(direction ? { [direction]: true } : {})}
        style={{ "--size": size } as any}
      />
    );
  },
};
