---
"@easypost/easy-ui": patch
---

Preserve data-testid attributes in package builds so CardListItem's public testId prop works in both interactive and non-interactive variants. Remove the package-wide attribute-stripping policy to keep distributed components consistent with source behavior.
