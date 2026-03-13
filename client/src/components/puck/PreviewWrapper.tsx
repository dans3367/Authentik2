import { createUsePuck } from "@puckeditor/core";

const usePuck = createUsePuck();

interface PreviewColors {
  bodyBg: string;
  contentBg: string;
  footerTextColor: string;
}

/**
 * Reads Puck root props for background/footer colors via usePuck selector.
 * Only re-renders when these three values change, isolating color updates
 * from the rest of the Puck UI (blocks panel, sidebar, etc.).
 */
export function usePreviewColors(): PreviewColors {
  const bodyBg = usePuck((s) => s.appState?.data?.root?.props?.bodyBackgroundColor || "#f7fafc");
  const contentBg = usePuck((s) => s.appState?.data?.root?.props?.backgroundColor || "#ffffff");
  const footerTextColor = usePuck((s) => s.appState?.data?.root?.props?.footerTextColor || "#64748b");
  return { bodyBg, contentBg, footerTextColor };
}
