import { fireEvent, render, screen } from "@testing-library/react";
import React, { createRef } from "react";
import { Text } from "../Text";
import { ThemeProvider } from "../Theme";
import { InlineCode, InlineCodeLanguage } from "./InlineCode";

describe("<InlineCode />", () => {
  it("renders one semantic code element within prose without a block wrapper", () => {
    const { container } = render(
      <Text as="p">
        Read <InlineCode code="response.status" language="javascript" /> next.
      </Text>,
    );

    expect(container.querySelectorAll("code")).toHaveLength(1);
    expect(container.querySelector("p > code")).toHaveTextContent(
      "response.status",
    );
    expect(container.querySelector("pre, div, code code")).toBeNull();
    expect(
      container.querySelector(".react-syntax-highlighter-line-number"),
    ).toBeNull();
    expect(container.textContent).toBe("Read response.status next.");
  });

  it("highlights JavaScript with the shared provider-scoped syntax palette", () => {
    render(
      <InlineCode code={'const status = "ready";'} language="javascript" />,
    );

    expect(screen.getByText("const")).toHaveStyle({
      color: "var(--ezui-color-primary-500)",
    });
    expect(screen.getByText('"ready"')).toHaveStyle({
      color: "var(--ezui-color-positive-700)",
    });
  });

  it("highlights JSON properties, strings, and booleans", () => {
    render(
      <InlineCode
        code={'{ "status": "ready", "enabled": true }'}
        language="json"
      />,
    );

    expect(screen.getByText('"status"')).toHaveStyle({
      color: "var(--ezui-color-negative-700)",
    });
    expect(screen.getByText('"ready"')).toHaveStyle({
      color: "var(--ezui-color-positive-700)",
    });
    expect(screen.getByText("true")).toHaveStyle({
      color: "var(--ezui-color-negative-700)",
    });
  });

  it("does not guess a syntax language when language is omitted", () => {
    const code = 'const status = "ready";';
    const { container } = render(<InlineCode code={code} />);

    expect(container.querySelector("code")?.textContent).toBe(code);
    expect(container.querySelector(".token")).toBeNull();
    expect(container.querySelector("code")?.className).not.toContain(
      "language-",
    );
  });

  it("falls back to text for unsupported runtime language values", () => {
    const code = 'const status = "ready";';
    const { container } = render(
      <InlineCode code={code} language={"unknown" as InlineCodeLanguage} />,
    );

    expect(container.querySelector("code")?.textContent).toBe(code);
    expect(container.querySelector(".token")).toBeNull();
  });

  it.each([undefined, "javascript"] as const)(
    "escapes markup and preserves all whitespace with language %s",
    (language) => {
      const code =
        '  const html = "<img src=x onerror=alert(1)>";\n\t// <script> & spaces  ';
      const { container } = render(
        <InlineCode code={code} language={language} />,
      );

      expect(container.querySelector("code")?.textContent).toBe(code);
      expect(container.querySelector("img, script")).toBeNull();
      expect(container.querySelector("code")).toHaveStyle({
        whiteSpace: "break-spaces",
      });
    },
  );

  it("forwards a ref and ordinary HTML attributes to code", () => {
    const ref = createRef<HTMLElement>();
    const onClick = vi.fn();
    render(
      <InlineCode
        ref={ref}
        code="response.status"
        id="inline-example"
        title="Status field"
        aria-label="Response status"
        data-testid="code"
        className="consumer-class"
        style={{ fontSize: "20px" }}
        onClick={onClick}
      />,
    );

    const code = screen.getByTestId("code");
    expect(ref.current).toBe(code);
    expect(code.tagName).toBe("CODE");
    expect(code).toHaveAttribute("id", "inline-example");
    expect(code).toHaveAttribute("title", "Status field");
    expect(code).toHaveAccessibleName("Response status");
    expect(code).toHaveClass("consumer-class");
    expect(code).toHaveStyle({ fontSize: "20px", whiteSpace: "break-spaces" });
    fireEvent.click(code);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps mounted syntax styles scoped to CSS variables across theme changes", () => {
    const { rerender } = render(
      <ThemeProvider colorScheme="light">
        <InlineCode code={'"ready"'} language="javascript" />
      </ThemeProvider>,
    );
    const token = screen.getByText('"ready"');

    rerender(
      <ThemeProvider colorScheme="dark">
        <InlineCode code={'"ready"'} language="javascript" />
      </ThemeProvider>,
    );

    expect(screen.getByText('"ready"')).toBe(token);
    expect(token).toHaveStyle({ color: "var(--ezui-color-positive-700)" });
  });
});
