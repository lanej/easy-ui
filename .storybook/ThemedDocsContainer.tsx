import React, { PropsWithChildren, useEffect, useState } from "react";
import {
  DocsContainer,
  DocsContainerProps,
} from "@storybook/addon-docs/blocks";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import { Provider } from "../easy-ui-react/src/Provider";
import {
  normalizeColorScheme,
  readColorScheme,
  resolveColorScheme,
} from "./colorScheme";
import { themes } from "./theme";

export function ThemedDocsContainer(
  props: PropsWithChildren<DocsContainerProps>,
) {
  const [colorScheme, setColorScheme] = useState(() => {
    const story = props.context.componentStories()[0];
    return story
      ? normalizeColorScheme(
          props.context.getStoryContext(story).globals.colorScheme,
        )
      : readColorScheme();
  });
  const [resolved, setResolved] = useState(() =>
    resolveColorScheme(colorScheme),
  );

  useEffect(() => {
    const channel = props.context.channel;
    const update = ({ globals }: { globals: Record<string, unknown> }) =>
      setColorScheme(normalizeColorScheme(globals.colorScheme));
    channel.on(GLOBALS_UPDATED, update);
    return () => {
      channel.off(GLOBALS_UPDATED, update);
    };
  }, [props.context]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolved(resolveColorScheme(colorScheme));
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [colorScheme]);

  return (
    <Provider colorScheme={colorScheme}>
      <DocsContainer {...props} theme={themes[resolved]} />
    </Provider>
  );
}
