import { readFile, writeFile } from "node:fs/promises";
import tokens from "../easy-ui-tokens/dist/js/tokens.mjs";

const root = new URL("../", import.meta.url);
const mark = await readFile(
  new URL("easy-ui-icons/src/EasyUI.svg", root),
  "utf8",
);
const wordmark = await readFile(
  new URL("documentation/brand/wordmark.svg", root),
  "utf8",
);
const width = Number(wordmark.match(/viewBox="0 0 ([\d.]+) 32"/)[1]);
const viewBox = mark.match(/viewBox="([\d. ]+)"/)[1];
const inner = (svg) =>
  svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const svg = (width, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 32">${body}</svg>\n`;
const symbol = (color) =>
  `<svg x="4" y="4" width="24" height="24" viewBox="${viewBox}" fill="${color}">${inner(mark)}</svg>`;
const assets = {
  "easy-ui-icon.svg": svg(32, symbol(tokens["color.blue.500"])),
  "easy-ui-favicon.svg": svg(
    32,
    `<rect width="32" height="32" rx="8" fill="${tokens["color.blue.500"]}"/>${symbol("#fff")}`,
  ),
  "easy-ui-logo.svg": svg(
    44 + width,
    `${symbol(tokens["theme.light.color.primary.500"])}<g transform="translate(44)" fill="${tokens["color.blue.800"]}">${inner(wordmark)}</g>`,
  ),
  "easy-ui-logo-dark.svg": svg(
    44 + width,
    `${symbol(tokens["theme.dark.color.primary.500"])}<g transform="translate(44)" fill="${tokens["theme.dark.color.neutral.900"]}">${inner(wordmark)}</g>`,
  ),
};
for (const [name, content] of Object.entries(assets)) {
  await writeFile(new URL(`.storybook/public/${name}`, root), content);
}
