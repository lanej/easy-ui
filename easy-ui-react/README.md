# Easy UI

[Easy UI](https://github.com/EasyPost/easy-ui) is a component library designed to help developers create the best experience for shippers who use EasyPost.

## Getting Started

1. Install Easy UI using [npm](https://www.npmjs.com/) or your project's package manager:

```bash
npm install @easypost/easy-ui --save
```

2. Include the Easy UI CSS file in your app entry point:

```js
import "@easypost/easy-ui/style.css";
```

3. Render your app inside the Easy UI `Provider`:

```js
import { Provider as EasyUIProvider } from "@easypost/easy-ui/Provider";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <EasyUIProvider>
    <App />
  </EasyUIProvider>,
);
```

4. Use Easy UI components:

```js
import { VerticalStack } from "@easypost/easy-ui/VerticalStack";
import { Button } from "@easypost/easy-ui/Button";

function App() {
  return (
    <VerticalStack>
      <Button>Click me!</Button>
    </VerticalStack>
  );
}
```

See our [Storybook](https://main--63f50c7c86f6514d2e0ef4be.chromatic.com/) for detailed component documentation.

Packages support TypeScript's legacy `moduleResolution: "node"` as well as modern export-aware resolution. The build generates package-root component entries, deep declarations such as `DataGrid/types` and `Select/SelectField`, flat utilities, and CSS/Sass compatibility files that forward to or copy the canonical `dist` outputs. These retain the original named exports; a default export is forwarded only when the target actually provides one. No application `tsconfig` changes are required.

### Sass entry points

Sass consumers can use the source styles shipped with the package. The `styles/common` entry forwards token, typography, responsive, media-query, and accessibility helpers; `styles/token-helpers` and `styles/unstyled` are also independently available. Extensionless Sass names and explicit partial filenames such as `styles/_common.scss` resolve to the same shipped files.

```scss
@use "@easypost/easy-ui/styles/common" as ui;

.shipment-summary {
  color: ui.design-token("color.neutral.900");
  @include ui.breakpoint-md-up {
    display: grid;
  }
}
```

For Sass-owned base styles, import `@easypost/easy-ui/styles/global.scss` through your application's Sass-aware bundler. This includes token CSS, Poppins fallback metrics, and scrollbar styles; the documented `style.css` import supplies the compiled component stylesheet. All eleven files under `styles/` ship together so relative Sass dependencies resolve. Dart Sass's `pkg:` importer also supports these entries; their existing bare dependency imports require the package-aware resolution supplied by bundlers such as Vite.

### Fonts

Easy UI uses `Poppins` font. You can host it yourself or use Google Fonts. For hosting it yourself, `Poppins` is included in `.storybook/public/fonts/poppins`.

If hosting yourself, include this declaration in your stylesheets, replacing the path with wherever the fonts are located:

```css
@font-face {
  font-family: "Poppins";
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src:
    url("/fonts/poppins/poppins-v20-latin-300.woff2") format("woff2"),
    url("/fonts/poppins/poppins-v20-latin-300.woff") format("woff");
}

@font-face {
  font-family: "Poppins";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src:
    url("/fonts/poppins/poppins-v20-latin-400.woff2") format("woff2"),
    url("/fonts/poppins/poppins-v20-latin-400.woff") format("woff");
}

@font-face {
  font-family: "Poppins";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src:
    url("/fonts/poppins/poppins-v20-latin-500.woff2") format("woff2"),
    url("/fonts/poppins/poppins-v20-latin-500.woff") format("woff");
}

@font-face {
  font-family: "Poppins";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src:
    url("/fonts/poppins/poppins-v20-latin-600.woff2") format("woff2"),
    url("/fonts/poppins/poppins-v20-latin-600.woff") format("woff");
}

@font-face {
  font-family: "Poppins";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src:
    url("/fonts/poppins/poppins-v20-latin-700.woff2") format("woff2"),
    url("/fonts/poppins/poppins-v20-latin-700.woff") format("woff");
}
```

### Server Rendering

When server rendering an app that uses Easy UI and React <18, your app must be wrapped with a single instance of React Aria's `SSRProvider`. If an app is using an additional version of React Aria, ensure there's only one version of `@react-aria/ssr` using NPM's `overrides` or Yarn's `resolutions` property.

## Development

We use Storybook to create a simple, hot-reloading playground for development on these components.

After building, `node scripts/check-style-package.mjs` from the repository root packs both the workspace package and its release `dist` directory, installs each tarball in a separate temporary consumer, and checks legacy and modern TypeScript resolution, generated compatibility entries, public CommonJS/ESM imports, server rendering, all Sass dependencies, and emitted production CSS. Normal workspace tarballs include `dist` and generated compatibility files; release-directory metadata rebases the same public exports to that directory. Turbo caches the generated files together with `dist`, and `clean` removes only generated files whose recorded contents still match.

### Commands

| Command              | Runs                                            |
| :------------------- | :---------------------------------------------- |
| `npm run build`      | Builds the project                              |
| `npm run clean`      | Removes temp directories                        |
| `npm run lint`       | Lints the project (ESLint, Stylelint, Prettier) |
| `npm run test`       | Tests the project                               |
| `npm run test:watch` | Tests the project in watch mod                  |
