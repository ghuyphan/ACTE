# Theme System

## Goal

Keep app chrome themeable without forcing every artistic or feature-specific palette into one giant global file.

## Where Colors Should Live

- Global semantic app colors belong in [hooks/useTheme.tsx](/Users/huyphan/Downloads/ACTE/hooks/useTheme.tsx).
- Shared non-color design tokens belong in [constants/theme.ts](/Users/huyphan/Downloads/ACTE/constants/theme.ts).
- Feature-specific UI palettes should live in a local token helper near the feature, like [components/notes/detail/noteDetailTheme.ts](/Users/huyphan/Downloads/ACTE/components/notes/detail/noteDetailTheme.ts).
- Intentional artwork, export rendering, and generated palettes can stay local in dedicated palette files such as [services/noteAppearance.ts](/Users/huyphan/Downloads/ACTE/services/noteAppearance.ts) and [services/photoFilters.ts](/Users/huyphan/Downloads/ACTE/services/photoFilters.ts).

## Rules

- Do not add new raw hex, `rgb(a)`, `hsl(a)`, `white`, or `black` literals directly inside ordinary screen/component logic when a semantic token would do.
- If a feature needs several tightly-coupled custom colors, create a local `*Theme.ts` or `*Tokens.ts` module for that feature instead of adding one-off inline values across multiple files.
- Keep route files and general UI wrappers on semantic theme tokens whenever possible.
- Treat the baseline in [scripts/theme-audit-baseline.json](/Users/huyphan/Downloads/ACTE/scripts/theme-audit-baseline.json) as a debt ledger, not a dumping ground.

## Audit Workflow

- Run `npm run theme:audit` to compare the current repo against the committed baseline.
- The audit fails when a new file introduces raw color literals or an existing file adds more than its baseline count.
- Reducing counts is always allowed.
- When a new explicit palette is intentional, centralize it in a dedicated token/palette module and update the baseline in the same change.

## Recommended Workflow

1. Start with semantic tokens from `useTheme()`.
2. If the feature needs more nuance, create a local token helper beside the feature.
3. Reuse that helper across the feature instead of repeating inline colors.
4. Run `npm run theme:audit` before merging.
