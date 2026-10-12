# Component composition audit

## Completed

- Ordinary chart, map, list, dialog, and copy actions reuse `Button` or
  `UnstyledButton`. Map choices reuse `Checkbox` and `RadioGroup`.
- Metric molecules reuse `Text` and accept `SignedValue` content. Pricing
  examples no longer duplicate the metric label/value structure.
- `Pill` and `PillButton` are standalone atoms. `PillGroup` composes the label
  atom while retaining its tag-list navigation and removal behavior.
- `KpiTile` composes a metric tile with explicit inputs. `WorkspaceHeader`
  composes compact navigation and identity. Both accept application-owned data
  and content without depending on application providers.
- Forge's wordmark uses the active text color. Its optional navigation toggle
  supports either a panel icon or a hamburger.
- `DrawerRow` composes a stable summary and full-width vertical details through
  `Disclosure`, `UnstyledButton`, and `Icon`. `DrawerTable`
  composes these row molecules into a single-expansion worklist without
  importing domain models, data fetching, URL state, or pagination policy.
- Network chart labels, including heatmap legend endpoints and Sankey labels,
  resolve colors from the rendered theme rather than treating System as Light.

The relative-import inventory found no upward component-level dependencies.
This is not an exhaustive proof for aliases or dynamic imports. Native semantic
tables, disclosures, slider handles, and map-engine controls remain intentional
boundaries, not missing atom wrappers.

## Remaining remediation

1. **Resolve System and inverted themes for map styles.**
   `NetworkInvestigationMap.examples.tsx` currently compares the context's
   `resolvedColorScheme` directly with `"dark"`. That context preserves
   `"system"` and top-level `"inverted"`; it does not resolve the operating
   system preference. Add a shared effective-scheme helper with preference
   change subscriptions, then use it for map style selection and example
   metadata. Verify explicit Light/Dark, System, nested inversion, and live
   operating-system changes without losing map selection.
2. **Consolidate product-layout press bridges.**
   CustomerPortalLayout, ForgeLayout, and NexusLayout retain separate
   `PressableButton` adapters. First cover their forwarded refs, React Aria
   press props, keyboard activation, disabled behavior, and menu focus return.
   Then consolidate against the shared unstyled press primitive without
   weakening those contracts.
3. **Audit the MultiSelect arrow bridge.**
   Its visible action delegates to the hidden React Aria combobox trigger.
   Cover opening, closing, disabled/read-only states, and focus restoration
   before replacing that specialized interaction.
4. **Update workflow visual-check routes outside Storybook.**
   The catalog now intentionally excludes populated pricing/network workflows.
   Their retained visual-review configuration still contains retired Storybook
   URLs. Give the standalone examples stable preview routes and update the
   checks; do not restore workflow entries simply to satisfy old checks.
5. **Continue concrete component adoption.**
   Extract provider-independent compositions with explicit inputs before
   importing full screens. Preserve their established navigation and content
   hierarchy rather than imposing a universal title/subtitle convention.

## Verification boundary

Focused component tests, direct library and Storybook builds, independent
technical review, and real-browser checks cover the implemented changes.
Browser review includes mobile pricing in both themes, Forge keyboard
navigation, and the complete dark heatmap/Sankey panels.

The canonical root `build:react` pipeline passes after installing the locked
dependencies. This resolves the attached checkout's icons dependency-resolution
failure involving `glob`; a source build does not establish consumer adoption.
