import { StorybookConfig } from "@storybook/react-vite";
import remarkGfm from "remark-gfm";

const config: StorybookConfig = {
  addons: [
    "@storybook/addon-a11y",
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: { remarkPlugins: [remarkGfm] },
        },
      },
    },
  ],

  docs: {},

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  staticDirs: ["./public"],

  stories: [
    "../easy-ui-react/src/*.mdx",
    "../easy-ui-react/src/!(examples)/*.mdx",
    "../easy-ui-react/src/!(examples)/*.stories.tsx",
    "../easy-ui-react/src/examples/NetworkInvestigationMap.stories.tsx",
    ...(process.env.STORYBOOK_TEST_RECIPES === "true"
      ? ["../easy-ui-react/src/InvestigationWorkspace/recipes/*.stories.tsx"]
      : []),
  ],

  async viteFinal(config) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      css: {
        preprocessorOptions: {
          scss: {
            silenceDeprecations: ["legacy-js-api"],
          },
        },
      },
    });
  },

  typescript: {
    reactDocgen: "react-docgen-typescript",

    // Point docgen at the library's own tsconfig rather than the root one. The
    // root config is solution-style — `files: []` plus a reference to
    // ./easy-ui-react — so docgen resolved components through the emitted
    // `dist/**/*.d.ts` whenever a build was present, and every `forwardRef`
    // component came back with no props at all. `<Box />` showed it first
    // because it has no hand-written argTypes to fall back on.
    reactDocgenTypescriptOptions: {
      tsconfigPath: "easy-ui-react/tsconfig.json",
    },
  },
};

export default config;
