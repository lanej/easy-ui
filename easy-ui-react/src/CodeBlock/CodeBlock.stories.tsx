import { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { getSnippetEntries as getAllSnippetEntries } from "../CodeSnippet/CodeSnippet.stories";
import { CodeBlock, CodeBlockProps } from "./CodeBlock";
import { HorizontalGrid } from "../HorizontalGrid";
import { SnippetLanguage } from "../CodeSnippet/SyntaxHighlighter";

type Story = StoryObj<typeof CodeBlock>;
type TemplateProps = Omit<CodeBlockProps, "language" | "onLanguageChange">;

const getSnippetEntries = () =>
  getAllSnippetEntries().filter(([language]) => language !== "json");

const Template = (props: TemplateProps) => {
  const [language, setLanguage] = useState(() => getSnippetEntries()[0][0]);
  return (
    <CodeBlock {...props} language={language} onLanguageChange={setLanguage} />
  );
};

const getSnippets = () => (
  <>
    {getSnippetEntries().map(([language, code]) => (
      <CodeBlock.Snippet
        key={language}
        language={language}
        code={code}
        maxLines={12}
        showLineNumbers
      />
    ))}
  </>
);

const meta: Meta<typeof CodeBlock> = {
  id: "components-code-codeblock",
  title: "Molecules/Content/CodeBlock",
  component: CodeBlock,
  args: {
    children: (
      <>
        <CodeBlock.Header color="neutral">Header</CodeBlock.Header>
        {getSnippets()}
      </>
    ),
  },
  parameters: {
    controls: {
      exclude: ["children", "language", "onLanguageChange"],
    },
  },
};

export default meta;

export const Default: Story = {
  render: Template.bind({}),
};

export const SingleLanguageMode: Story = {
  render: () => {
    const [language, code] = getSnippetEntries()[0];
    return (
      <Template>
        <CodeBlock.Header>Header</CodeBlock.Header>
        <CodeBlock.Snippet
          language={language}
          code={code}
          maxLines={12}
          showLineNumbers
        />
      </Template>
    );
  },
};

export const CustomHeader: StoryObj<typeof CodeBlock.Header> = {
  render: (args) => (
    <Template>
      <CodeBlock.Header {...args} />
      {getSnippets()}
    </Template>
  ),
  args: {
    children: "Header",
    color: "primary",
    hideCopy: false,
  },
  argTypes: {
    children: { control: "text" },
    color: {
      options: ["neutral", "secondary", "primary"],
      control: { type: "radio" },
    },
  },
  parameters: {
    controls: {
      exclude: ["language", "onLanguageChange"],
    },
  },
};

export const SideBySide: Story = {
  render: () => {
    const jsonSnippet = getAllSnippetEntries().find(([l]) => l === "json");
    if (!jsonSnippet) {
      throw new Error("Snippets should have JSON entry");
    }
    const [jsonLang, jsonCode] = jsonSnippet;
    return (
      <HorizontalGrid columns={{ xs: 1, md: 2 }} gap="2" alignItems="start">
        <Template>
          <CodeBlock.Header color="primary">Request</CodeBlock.Header>
          {getSnippets()}
        </Template>
        <Template>
          <CodeBlock.Header>Response</CodeBlock.Header>
          <CodeBlock.Snippet
            language={jsonLang}
            code={jsonCode}
            maxLines={12}
            showLineNumbers
          />
        </Template>
      </HorizontalGrid>
    );
  },
};

function SyntaxColorsExample() {
  const [language, setLanguage] = useState<SnippetLanguage>("javascript");
  return (
    <CodeBlock language={language} onLanguageChange={setLanguage}>
      <CodeBlock.Header>Example</CodeBlock.Header>
      <CodeBlock.Snippet
        code={`// Theme-aware syntax with scrollable content.
const label = "Sample package";
const count = 3;
function describe() {
  return { label, count, ready: true };
}
console.log(describe());`}
        language="javascript"
        maxLines={4}
        showLineNumbers
      />
      <CodeBlock.Snippet
        code={`{
  "label": "Sample package",
  "count": 3,
  "ready": true,
  "destination": null
}`}
        language="json"
        maxLines={4}
        showLineNumbers
      />
    </CodeBlock>
  );
}

export const SyntaxColors: Story = {
  render: () => <SyntaxColorsExample />,
};
