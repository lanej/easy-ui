import React, { ComponentProps } from "react";
import {
  ArgTypes as StorybookArgTypes,
  Controls as StorybookControls,
} from "@storybook/addon-docs/blocks";
import { DocsScroll } from "./DocsTable";

export function ArgTypes(props: ComponentProps<typeof StorybookArgTypes>) {
  return (
    <DocsScroll api>
      <StorybookArgTypes {...props} />
    </DocsScroll>
  );
}

export function Controls(props: ComponentProps<typeof StorybookControls>) {
  return (
    <DocsScroll api>
      <StorybookControls {...props} />
    </DocsScroll>
  );
}
