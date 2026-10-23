import { CSSProperties } from "react";

export type DrawerLayoutProps = {
  /** Physical side of the viewport. @default right */
  placement?: "left" | "right";

  /** CSS width (numbers are pixels), constrained to the viewport. */
  width?: CSSProperties["width"];
};
