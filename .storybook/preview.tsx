import { action } from "storybook/actions";
import { Preview } from "@storybook/react-vite";
import React from "react";
import { Provider as EasyUIProvider } from "../easy-ui-react/src/Provider";
import { backgrounds, gridCellSize } from "./theme";
import { normalizeColorScheme, readColorScheme } from "./colorScheme";
import { ThemedDocsContainer } from "./ThemedDocsContainer";
import { viewports } from "./viewports";

const preview: Preview = {
  initialGlobals: { colorScheme: readColorScheme() },
  globalTypes: {
    colorScheme: {
      description: "Color scheme for Easy UI, documentation, and Storybook",
      toolbar: {
        title: "Color scheme",
        icon: "circlehollow",
        dynamicTitle: true,
        items: [
          { value: "system", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        date: /Date$/,
      },
    },
    viewport: {
      options: viewports,
    },
    docs: {
      container: ThemedDocsContainer,
    },
    backgrounds: {
      grid: {
        cellSize: gridCellSize,
        opacity: 0.25,
      },
      options: Object.entries(backgrounds).map(([name, value]) => ({
        name,
        value,
      })),
    },
    options: {
      storySort: {
        order: [
          "Getting Started",
          "Changelog",
          "Contributing",
          "Browser Support",
          "Foundations",
          ["Design Tokens", "Typography", "Colors", "Icons"],
          "Atoms",
          "Molecules",
          "Organisms",
        ],
      },
    },
  },

  decorators: [
    (Story, context) => {
      return (
        <EasyUIProvider
          navigate={action("Navigation")}
          colorScheme={normalizeColorScheme(context.globals.colorScheme)}
        >
          <Story />
        </EasyUIProvider>
      );
    },
  ],

  tags: ["autodocs"],
};

export default preview;
