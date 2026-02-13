import { CSSProperties, createContext, forwardRef, ReactNode, useContext } from "react";
import styles from "./styles.module.css";
import { getClassNameFactory } from "../../lib/get-class-name-factory";

const getClassName = getClassNameFactory("Section", styles);

/**
 * Tracks whether we are inside a Section so nested Sections skip inline
 * padding. Email clients strip CSS classes, so the horizontal padding must
 * be set as inline styles — but only on the outermost Section to avoid
 * double-padding when components are nested (e.g. Text inside Flex).
 *
 * Style precedence: the `style` prop always wins over the default
 * horizontal padding so callers can override `paddingLeft` / `paddingRight`.
 */
const SectionNestingCtx = createContext(false);

export type SectionProps = {
  className?: string;
  children: ReactNode;
  maxWidth?: string;
  /** Inline styles merged on top of the default horizontal padding, so any
   *  `paddingLeft` / `paddingRight` values here take precedence. */
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
            ...(isNested
              ? {}
              : { paddingLeft: "24px", paddingRight: "24px" }),
            ...style,
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
