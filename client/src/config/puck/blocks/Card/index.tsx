import { ReactElement } from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@measured/puck/lib";
import * as LucideIcons from "lucide-react";
import { withLayout, WithLayout } from "../../components/Layout";

const getClassName = getClassNameFactory("Card", styles);

const iconOptions = Object.keys(LucideIcons)
  .filter(key => key !== 'default' && typeof (LucideIcons as any)[key] === 'function')
  .map((iconName) => ({
    label: iconName,
    value: iconName,
  }));

export type CardProps = WithLayout<{
  title: string;
  description: string;
  icon?: string;
  mode: "flat" | "card";
}>;

const CardInner: ComponentConfig<CardProps> = {
  fields: {
    title: {
      type: "text",
      contentEditable: true,
    },
    description: {
      type: "textarea",
      contentEditable: true,
    },
    icon: {
      type: "select",
      options: iconOptions,
    },
    mode: {
      type: "radio",
      options: [
        { label: "card", value: "card" },
        { label: "flat", value: "flat" },
      ],
    },
  },
  defaultProps: {
    title: "Title",
    description: "Description",
    icon: "Feather",
    mode: "flat",
  },
  render: ({ title, icon, description, mode }) => {
    const IconComponent = icon ? (LucideIcons as any)[icon] : null;
    
    return (
      <div className={getClassName({ [mode]: mode })}>
        <div className={getClassName("inner")}>
          <div className={getClassName("icon")}>
            {IconComponent && <IconComponent />}
          </div>

          <div className={getClassName("title")}>{title}</div>
          <div className={getClassName("description")}>{description}</div>
        </div>
      </div>
    );
  },
};

export const Card = withLayout(CardInner);
