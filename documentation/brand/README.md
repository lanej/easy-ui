# Easy UI brand

Easy UI is EasyPost's design system. Its product lockup pairs the official
EasyPost symbol with the “Easy UI” name in the library's Poppins typeface.
The mark is reused from `.storybook/public/favicon.svg`, which predates this
change. Its path data and 512 × 512 viewBox remain unchanged; the component's
fill inherits color through the existing Icon API.

`easy-ui-icons/src/EasyUI.svg` is the canonical monochrome mark. The icon build
publishes it as `@easypost/easy-ui-icons/EasyUI` and `svg/EasyUI.svg`. Use it
through the existing `Icon` component for theme colors and accessible labels.
The mark has no weight variants.

The blue and navy light lockup colors match the existing
`.storybook/public/easypost-logo.svg`; the dark colors match
`easypost-logo-dark.svg`. The generated assets use the corresponding Easy UI
tokens. The company symbol stays intact: do not redraw it or insert UI shapes.
This is an Easy UI product lockup, not a replacement for the official EasyPost
company wordmark.

References: [EasyPost](https://www.easypost.com/) and the original brand designer's
[EasyPost identity case study](https://movingbrands.com/work/easypost/).

`wordmark.svg` outlines “Easy UI” in the bundled Poppins Semibold font.
The font is licensed under the [SIL Open Font License](../../.storybook/public/fonts/poppins/OFL.txt).

Run `node scripts/build-brand-assets.mjs` from the repository root after editing
either source. This regenerates the transparent blue mark, light and dark
wordmark lockups, and the white-on-blue favicon in `.storybook/public`.
Storybook's build and development commands also run this generator.

Keep the mark's proportions and spacing. Use the transparent blue asset on light
surfaces, the lighter blue lockup on dark surfaces, and the opaque favicon for
browser tabs. The monochrome icon inherits its surrounding color. Keep visible
wordmarks and accessible names in consuming markup rather than embedding a title
in decorative SVG assets.
