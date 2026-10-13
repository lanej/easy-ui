import SearchIcon from "@easypost/easy-ui-icons/Search";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import React, { CSSProperties, useState } from "react";
import { Select } from "../Select";
import { TextField } from "../TextField";
import { classNames, tokenSafeKebabCase } from "./css";

import styles from "./TokenBrowser.module.scss";

const GROUPS = [
  { id: "space", label: "Spacing" },
  { id: "theme", label: "Theme tokens" },
  { id: "color", label: "Base colors" },
  { id: "shape", label: "Shapes" },
  { id: "shadow", label: "Shadows" },
  { id: "size", label: "Sizes" },
  { id: "font", label: "Fonts" },
  { id: "opacity", label: "Opacity" },
  { id: "breakpoint", label: "Breakpoints" },
  { id: "z-index", label: "Z-indices" },
];

type Token = {
  name: string;
  group: string;
  value: string;
  darkValue?: string;
};

const values: Record<string, string | number> = tokens;
const catalog: Token[] = Object.entries(values)
  .filter(([name]) => !name.startsWith("theme.dark."))
  .map(([name, value]) =>
    name.startsWith("theme.light.")
      ? {
          name: name.slice("theme.light.".length),
          group: "theme",
          value: String(value),
          darkValue: String(
            values[name.replace("theme.light.", "theme.dark.")],
          ),
        }
      : { name, group: name.split(".")[0], value: String(value) },
  );

// Sort numeric scales regardless of JSON object insertion order.
catalog.sort(
  (a, b) =>
    a.group.localeCompare(b.group) ||
    (["space", "size", "breakpoint"].includes(a.group)
      ? parseFloat(a.value) - parseFloat(b.value)
      : 0) ||
    a.name
      .split(".")
      .slice(0, -1)
      .join(".")
      .localeCompare(b.name.split(".").slice(0, -1).join(".")) ||
    parseFloat(a.value) - parseFloat(b.value) ||
    a.name.localeCompare(b.name, undefined, { numeric: true }),
);

/** Documentation-only browser, derived from the generated token package. */
export function TokenBrowser() {
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = catalog.filter(
    (token) =>
      (group === "all" || group === token.group) &&
      `${token.name} ${token.value} ${token.darkValue ?? ""} ${variableName(token.name)}`
        .toLowerCase()
        .includes(needle),
  );

  return (
    <div className={styles.browser}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <TextField
            type="search"
            label="Find a token"
            size="sm"
            placeholder="Name, value, or CSS variable"
            iconAtStart={SearchIcon}
            value={query}
            onChange={setQuery}
          />
        </div>
        <div className={styles.select}>
          <Select
            label="Token group"
            size="sm"
            selectedKey={group}
            onSelectionChange={setGroup}
          >
            {[{ id: "all", label: "All groups" }, ...GROUPS].map(
              ({ id, label }) => (
                <Select.Option key={id}>{label}</Select.Option>
              ),
            )}
          </Select>
        </div>
      </div>
      <p className={styles.count} role="status">
        {matches.length} token{matches.length === 1 ? "" : "s"}
        {needle && ` matching “${query.trim()}”`}
      </p>
      {matches.length === 0 && <p>No tokens match these filters.</p>}
      {GROUPS.map(({ id, label }) => {
        const entries = matches.filter((token) => token.group === id);
        if (entries.length === 0) return null;
        const compact = ["space", "breakpoint", "z-index"].includes(id);
        return (
          <section key={id} aria-label={label}>
            <h2 className={styles.heading}>{label}</h2>
            {id === "theme" && (
              <p className={styles.description}>
                Use the shared token name in code. Light and dark values are
                shown together; the Storybook color scheme changes the page.
              </p>
            )}
            {id === "breakpoint" && (
              <p className={styles.description}>
                Minimum viewport widths. Bars share a relative scale ending at
                the largest breakpoint.
              </p>
            )}
            {id === "z-index" && (
              <p className={styles.description}>
                Each sample places the named layer over a local base layer.
              </p>
            )}
            <ul className={compact ? styles.rows : styles.grid}>
              {entries.map((token) => (
                <li
                  key={token.name}
                  className={classNames(styles.card, compact && styles.row)}
                >
                  <TokenPreview token={token} />
                  <div className={styles.metadata}>
                    <code className={styles.name}>{token.name}</code>
                    {id !== "theme" && (
                      <code className={styles.value}>{token.value}</code>
                    )}
                    <code className={styles.variable}>
                      {variableName(token.name)}
                    </code>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function variableName(name: string) {
  return `--ezui-${tokenSafeKebabCase(name)}`;
}

function cssValue(name: string) {
  return `var(${variableName(name)})`;
}

function TokenPreview({ token }: { token: Token }) {
  const { name, group, value, darkValue } = token;
  if (group === "theme") {
    return (
      <div className={styles.pair}>
        {(["light", "dark"] as const).map((scheme) => (
          <div key={scheme} className={styles[scheme]}>
            <span className={styles.scheme}>{scheme}</span>
            <Sample name={name} css={cssValue(`theme.${scheme}.${name}`)} />
            <code className={styles.themeValue}>
              {scheme === "light" ? value : darkValue}
            </code>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.preview} aria-hidden="true">
      <Sample name={name} css={cssValue(name)} />
    </div>
  );
}

function Sample({ name, css }: { name: string; css: string }) {
  const [group, kind] = name.split(".");
  if (group === "color")
    return <span className={styles.swatch} style={{ background: css }} />;
  if (group === "space")
    return <span className={styles.bar} style={{ width: css }} />;
  if (group === "size")
    return (
      <span className={styles.square} style={{ width: css, height: css }} />
    );
  if (group === "shape")
    return (
      <span
        className={styles.shape}
        style={
          kind === "border_radius"
            ? { borderRadius: css }
            : { borderWidth: css }
        }
      />
    );
  if (group === "shadow")
    return <span className={styles.shape} style={{ boxShadow: css }} />;
  if (group === "opacity")
    return (
      <span className={styles.opacity}>
        <span style={{ opacity: css }} />
      </span>
    );
  if (group === "breakpoint") {
    const largest = Math.max(
      ...catalog
        .filter((token) => token.group === group)
        .map((token) => parseFloat(token.value)),
    );
    const width = parseFloat(values[name] as string);
    return (
      <svg className={styles.breakpoint} viewBox={`0 0 ${largest} 180`}>
        <rect width={largest} height="180" className={styles.track} />
        <rect width={width} height="180" />
      </svg>
    );
  }
  if (group === "z-index")
    return (
      <span className={styles.layers}>
        <span className={styles.baseLayer} />
        <span className={styles.frontLayer} style={{ zIndex: css }} />
      </span>
    );
  if (group === "font") {
    if (name === "font.family.icon")
      return (
        <span className={styles.note}>Material Symbols font required</span>
      );
    if (kind === "responsive_mapping") {
      return (
        <span className={styles.note}>
          {name.split(".").pop()} → {String(values[name])}
        </span>
      );
    }
    const property = kind === "style" ? name.split(".").pop() : kind;
    const properties: Record<string, keyof CSSProperties> = {
      family: "fontFamily",
      size: "fontSize",
      weight: "fontWeight",
      line_height: "lineHeight",
      letter_spacing: "letterSpacing",
    };
    return (
      <span
        className={styles.font}
        style={{
          [properties[property ?? ""]]: css,
          whiteSpace: property === "line_height" ? "pre-line" : undefined,
        }}
      >
        {property === "line_height" ? "Aa\n012" : "Aa 012"}
      </span>
    );
  }
  return <span className={styles.note}>{String(values[name])}</span>;
}
