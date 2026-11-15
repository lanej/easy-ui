# Coincident native history rendering

Observed 2026-11-15 with the packed Easy UI library built from canonical `lanej/easy-ui` commit `636142aafbbfa9a11186c1a4a019109508606bac`. This was canonical main at capture time. All data, IDs, and labels are synthetic; the map style contains only an inline background layer.

Mount `reproduction.tsx` in a Vite React application using the public theme, InvestigationWorkbench, style, and map worker exports. There are no component CSS overrides. The wrapper is 1200px wide in a 1440px browser viewport and the native map height is 520px.

Default case: Blue and Orange histories have independent observation and connection IDs. Each connection references a distinct segment ID, but both segments have exactly the same A-to-B coordinates. In native All view both overlay source features have offset 0; Orange is the later layer and covers the Blue stroke. Choosing each history still focuses its own original observations.

Shared-identity control: query parameter `shared` associates both connections with one segment ID. Original observation and connection IDs remain separate. The existing native renderer assigns offsets -2 and +2, so both strokes are visible. This control establishes that current shared-segment-ID support already works.

Query parameter `dark` switches the native theme and uses matching light-on-dark colors. The distinct-ID case was verified in both themes. Screenshots are unmodified captures of the actual native workbench. `metrics.json` records source geometries, identities, offsets, layer colors/order, and midpoint hit results. Each run completed with no page or console errors.
