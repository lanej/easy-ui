---
"@easypost/easy-ui": patch
---

Include built components, declarations, CSS, and Sass in normal and release-directory npm tarballs. Preserve modern dist-based exports and generate package-root component, deep declaration, utility, and style entries for legacy TypeScript module resolution. Forward default exports only when they exist, copy authored declarations, and preserve CSS/Sass side effects. Cache and safely clean generated entries alongside the package build.
