# Native NetworkMap inset reproductions

Observed 2026-11-14 with the packed library built from canonical `lanej/easy-ui` commit `636142aafbbfa9a11186c1a4a019109508606bac`. This commit was canonical main at capture time. All inputs are synthetic and the map uses an inline background-only style.

Mount `reproduction.tsx` in a Vite React application with this Easy UI build. It uses the public `NetworkMap`, theme, styles, and worker exports. There are no component CSS overrides.

- Narrow title: use a 390px browser viewport and query parameter `large`. The wrapper is 310px wide, `height={520}`, `typography={{control:18}}`, and `controlPlacement="map"`. Focus the first synthetic observation marker and press Enter to open its native close-up. The title displays as five lines: `Nearb`, `y`, `scan`, `locati`, `ons`.
- Fit overlap: use a 1440px browser viewport and query parameter `wide`. The wrapper is 650px wide, `height={520}`, `initialView={{center:[-101,53],zoom:3}}`, and native Fit is enabled. Focus the first synthetic observation marker and press Enter. The native inset is placed at the top-left and the overview Fit button covers the beginning of the title.

The PNGs are unmodified captures of the native inset, including the overlapping overview button in the desktop capture. `metrics.json` records the corresponding title and control bounds, computed stacking values, and hit-test result. Each capture completed with no page errors. These cases are layout observations; they do not establish a customer population or other affected sizes.
