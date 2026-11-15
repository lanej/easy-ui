# Focused histories sharing original observations

Observed 2026-11-15 using `@easypost/easy-ui` `1.0.0-alpha.137`, packed from canonical `lanej/easy-ui` source `636142aafbbfa9a11186c1a4a019109508606bac`. All locations, observation IDs, connections and labels are synthetic. The map style is an inline background with no tile provider. These are native component captures without component CSS overrides.

Mount `reproduction.tsx` in a Vite React application with the public Easy UI theme, InvestigationWorkbench, stylesheet and map-worker exports. Default input has three observations. Blue connects A to B; Orange connects the same original A to B and then B to C. Blue and Orange use distinct connection and segment IDs; the A-to-B geographic coordinates coincide.

Choose Synthetic Blue. Its native button becomes pressed, the native header says Synthetic Blue emphasized, and original observations A and B are selected. The map line still appears Orange. MapLibre records show opaque 5px selected-history overlays for both Blue and Orange, with Orange last and topmost at the shared midpoint. Selection identifies original observations correctly; visible connection color fails to reflect the focused history.

The `independent` query parameter is a control: Orange uses two separate observation IDs at the same coordinates. Choosing Blue then produces only a selected Blue connection overlay and the visible line is Blue. The `dark` query parameter switches to the native dark theme and corresponding colors. Both default and control were observed at desktop 1440x1050 and narrow 390x844 in light and dark; all eight runs had no page or console errors. At narrow widths, select the history from Events and inspect its native Map under Analysis.

`metrics.json` records the supplied original graphs, actual selected-overlay source identities/geometry, layer colors/order/opacity/width and midpoint hit order for all eight cases. The two unmodified desktop light screenshots show the failing shared-observation input and the independent-observation control. This evidence concerns focused-history visibility; the separate All-view coincidence presentation request is issue #82.
