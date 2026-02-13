import { CSSProperties, createContext, forwardRef, ReactNode, useContext } from "react";
import styles from "./styles.module.css";
import { getClassNameFactory } from "../../lib/get-class-name-factory";

const getClassName = getClassNameFactory("Section", styles);

/**
 * Tracks whether we are inside a Section so nested Sections skip inline
 * padding. Email clients strip CSS classes, so the horizontal padding must
 * be set as inline styles — but only on the outermost Section to avoid
 * double-padding when components are nested (e.g. Text inside Flex).
 */
const SectionNestingCtx = createContext(false);

export type SectionProps = {
  className?: string;
  children: ReactNode;
  maxWidth?: string;
  style?: CSSProperties;
};

export const Section = forwardRef<HTMLDivElement, SectionProps>(
  ({ children, className, maxWidth = "1280px", style = {} }, ref) => {
    const isNested = useContext(SectionNestingCtx);

    return (
      <SectionNestingCtx.Provider value={true}>
        <div
          className={`${getClassName()}${className ? ` ${className}` : ""}`}
          style={{
            ...style,
            ...(isNested
              ? {}
              : { paddingLeft: "24px", paddingRight: "24px" }),
          }}
          ref={ref}
        >
          <div className={getClassName("inner")} style={{ maxWidth }}>
            {children}
          </div>
        </div>
      </SectionNestingCtx.Provider>
    );
  }
);
