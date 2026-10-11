---
name: easy-ui
description: Use Easy UI's React components and documented APIs. Use when composing an application with @easypost/easy-ui, choosing its charts, or contributing components and Storybook documentation to Easy UI.
---

# Easy UI

## Use the library

Read the bundled [component reference](references/components.md) to choose a
component and find its public import. It covers forms, layouts, feedback, data
views, charts, maps, and their composition companions.

Read the installed package's types and the matching revision's Storybook API page
before composing a component. Use existing components, tokens, and documented
package subpaths. Follow the package README for the stylesheet and Provider;
avoid copying implementation code or inventing props from a screenshot.

For charts, read the catalog's choosing-a-chart guidance and the selected
component's examples. Keep aggregation, units, model bounds, and interpretation
in the application. Supply accessible titles, descriptions, and exact-data
disclosure consistent with the plotted observations. Preserve missing-data gaps.

Use documented axis defaults for native Cartesian charts. Supply HeatmapChart's
required coordinate system and color scale. Partial axis styling must preserve
generated categories; authored arrays replace defaults. For intervals and
prediction bands, preserve visible overlap when zoom endpoints lie inside a
span, and respect explicit caller filtering.

## Change library components

Keep public types and Storybook examples consistent with the implementation.
Document the smallest valid input and relevant interaction states. Verify API
contracts through Easy UI's existing real-engine regression tests, including
partial configuration and overlapping zoom spans when affected. Improve the
existing feature detector rather than adding a parallel validation suite.

Run focused checks during development and leave exhaustive browser coverage to
the existing CI workflows. Resolve failing checks before handing off a PR.
Use Viewrule for rendered layout review; component contract tests
remain owned by the library's tests and CI. Screenshots do not prove API behavior.
