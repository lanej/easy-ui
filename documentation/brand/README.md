# Easy UI brand

The mark is a modular E, assembled from three rows of UI building blocks.
It uses EasyPost's existing brand blue while identifying Easy UI itself.

`easy-ui-icons/src/EasyUI.svg` is the canonical monochrome mark. The icon build
publishes it as `@easypost/easy-ui-icons/EasyUI` and `svg/EasyUI.svg`. Use it
through the existing `Icon` component for theme colors and accessible labels.
The mark has no weight variants.

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
