import { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { Box } from "../Box";
import { SnippetLanguages } from "../CodeSnippet/SyntaxHighlighter";
import { Text } from "../Text";
import { createTheme, ThemeProvider } from "../Theme";
import { ThemeToggle } from "../ThemeToggle";
import { VerticalStack } from "../VerticalStack";
import { InlineCode } from "./InlineCode";

type Story = StoryObj<typeof InlineCode>;

const meta: Meta<typeof InlineCode> = {
  id: "components-code-inlinecode",
  title: "Atoms/Content/InlineCode",
  component: InlineCode,
  args: {
    code: 'const status = "ready";',
    language: "javascript",
  },
  argTypes: {
    language: { control: "select", options: Object.values(SnippetLanguages) },
  },
};

export default meta;

export const Default: Story = {
  render: (args) => (
    <Text as="p">
      Set <InlineCode {...args} /> before starting the preview.
    </Text>
  ),
};

export const Json: Story = {
  args: {
    code: '{ "status": "ready", "enabled": true, "count": 3 }',
    language: "json",
  },
  render: (args) => (
    <Text as="p">
      The response contains <InlineCode {...args} /> when the preview is ready.
    </Text>
  ),
};

export const PlainText: Story = {
  args: { code: "preview_status", language: undefined },
  render: (args) => (
    <Text as="p">
      Read the <InlineCode {...args} /> field. Omitting a language keeps code as
      plain text.
    </Text>
  ),
};

export const LongContent: Story = {
  args: {
    code: 'const resource = "preview_configuration_for_a_very_long_synthetic_resource_name_without_spaces";',
  },
  render: (args) => (
    <div style={{ maxWidth: "18rem" }}>
      <Text as="p">
        Use <InlineCode {...args} /> to select the resource, even in a narrow
        panel.
      </Text>
    </div>
  ),
};

export const SyntaxColors: Story = {
  render: () => (
    <div style={{ maxWidth: "60rem" }}>
      <VerticalStack gap="3">
        <Text as="p">
          Set{" "}
          <InlineCode code={'const status = "ready";'} language="javascript" />{" "}
          before starting the preview. Check{" "}
          <InlineCode code="items.length > 0" language="javascript" /> to
          confirm there is something to show.
        </Text>
        <Text as="p">
          A successful response contains{" "}
          <InlineCode
            code={'{ "status": "ready", "enabled": true, "count": 3 }'}
            language="json"
          />
          . Read these values before updating the preview.
        </Text>
        <Text as="p">
          The <InlineCode code="preview_status" /> field is a plain-text
          identifier. It needs no language or syntax detection.
        </Text>
        <Text as="p">
          Use{" "}
          <InlineCode
            code={
              '"preview_configuration_for_a_very_long_synthetic_resource_name_without_spaces"'
            }
            language="javascript"
          />{" "}
          when selecting this sample resource. Long tokens wrap with the
          sentence on smaller screens.
        </Text>
      </VerticalStack>
    </div>
  ),
};

const customSyntaxTheme = createTheme(({ colorScheme }) => ({
  "color.positive.700": colorScheme === "light" ? "#6e3bbd" : "#c4a7ff",
}));

function ThemeScopesExample() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  return (
    <ThemeProvider colorScheme={mode}>
      <Box background="neutral.050" padding="2">
        <VerticalStack gap="3">
          <ThemeToggle mode={mode} onModeChange={setMode} />
          <Text as="p">
            Set{" "}
            <InlineCode
              data-inline-scope="active"
              code={'const status = "ready";'}
              language="javascript"
            />{" "}
            before continuing.
          </Text>
          <div>
            <ThemeProvider colorScheme="inverted">
              <Box background="neutral.050" padding="2">
                <Text as="p">
                  The inverted scope returns{" "}
                  <InlineCode
                    data-inline-scope="inverted"
                    code={'{ "ready": true, "count": 3 }'}
                    language="json"
                  />
                  .
                </Text>
              </Box>
            </ThemeProvider>
          </div>
        </VerticalStack>
      </Box>
    </ThemeProvider>
  );
}

export const ThemeScopes: Story = {
  render: () => <ThemeScopesExample />,
};

export const CustomTheme: Story = {
  render: () => (
    <ThemeProvider theme={customSyntaxTheme}>
      <Text as="p">
        Custom string tokens color{" "}
        <InlineCode
          data-inline-scope="custom"
          code={'const status = "ready";'}
          language="javascript"
        />{" "}
        locally.
      </Text>
    </ThemeProvider>
  ),
};
