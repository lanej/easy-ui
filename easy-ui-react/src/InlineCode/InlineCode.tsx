import React, { forwardRef, HTMLAttributes, ReactNode } from "react";
import {
  SnippetLanguage,
  SyntaxHighlighter,
} from "../CodeSnippet/SyntaxHighlighter";
import { useEasyUiSyntaxHighlighterTheme } from "../CodeSnippet/theme";
import { classNames } from "../utilities/css";

import styles from "./InlineCode.module.scss";

export type InlineCodeLanguage = SnippetLanguage;

export type InlineCodeProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "dangerouslySetInnerHTML"
> & {
  /** Use `code` instead of children. */
  children?: never;
  /** The code to display as escaped text. */
  code: string;
  /**
   * Syntax language. Omit to display plain text without language detection.
   * Supports the same languages as CodeSnippet.
   */
  language?: InlineCodeLanguage;
};

// Discard the highlighter's block wrapper and pre styles. Its CodeTag is the
// only root element, so code stays valid inside a sentence or a Text component.
function InlineContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Inline code with optional syntax highlighting that follows the active theme.
 *
 * @example
 * ```tsx
 * <Text>
 *   Read <InlineCode code="response.status" language="javascript" /> to continue.
 * </Text>
 * ```
 */
export const InlineCode = forwardRef<HTMLElement, InlineCodeProps>(
  ({ code, language, className, style, ...props }, ref) => {
    const syntaxTheme = useEasyUiSyntaxHighlighterTheme();

    return (
      <SyntaxHighlighter
        language={language ?? "text"}
        style={syntaxTheme}
        PreTag={InlineContent}
        CodeTag="code"
        codeTagProps={{
          ...props,
          ref,
          className: classNames(
            styles.InlineCode,
            language && `language-${language}`,
            className,
          ),
          // Override the highlighter's default `pre` whitespace without
          // introducing block typography or losing spaces and line breaks.
          style: { whiteSpace: "break-spaces", ...style },
        }}
      >
        {code}
      </SyntaxHighlighter>
    );
  },
);

InlineCode.displayName = "InlineCode";
