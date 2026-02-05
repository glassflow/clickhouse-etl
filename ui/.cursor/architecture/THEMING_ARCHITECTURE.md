# Theming Architecture

## Approach

- Dark theme only; light theme removed.
- next-themes provider in `components/shared/ThemeProvider.tsx` with `defaultTheme="dark"` and `enableSystem=false`.
- Styling via Tailwind CSS 4 plus CSS custom properties for colors/semantic tokens.

## Files

- `src/components/shared/ThemeProvider.tsx` – wraps app, sets `data-theme`.
- `src/themes/base.css` + `src/themes/dark/theme.css` – token definitions.
- `src/app/globals.css` and `src/app/styles/*` – global styles/utilities.
- Trashcan docs (for reference): `Trashcan/DARK_THEME_ONLY_CONSOLIDATION.md`, `GRAY_COLOR_CONSOLIDATION.md`, `THEME_CONSOLIDATION_PLAN.md`.

## Tokens

Canonical token definitions and usage: [docs/architecture/DESIGN_SYSTEM.md](../../docs/architecture/DESIGN_SYSTEM.md). This file is summary only.

- Semantic color tokens defined in dark theme; light aliases removed.
- Prefer semantic variables over raw hex in components.
- Keep consistency across components; avoid inline colors.

## Tailwind Usage

- Use Tailwind for layout/spacing/typography.
- Leverage `className` with design tokens (e.g., background/text colors from CSS vars).
- Avoid adding new ad-hoc color utilities; map to existing tokens.

## Component Styling

- Base components (`components/ui/*`) should respect theme tokens; avoid hardcoded colors.
- Higher-level components rely on tokens + Tailwind spacing/typography.
- For new styles, add semantic tokens if needed instead of hardcoded values.

## Mode Handling

- Theme provider suppresses system theme; app is dark-only.
- Avoid adding light-theme branches; if needed, document rationale and token changes.

## Best Practices

- Reuse existing tokens; do not introduce duplicate grays.
- Keep CSS changes in theme files or shared CSS utilities, not scattered inline.
- Check contrast/readability for new UI elements in dark theme.

## Related Docs

- Design system (full tokens, card variants, usage): [docs/architecture/DESIGN_SYSTEM.md](../../docs/architecture/DESIGN_SYSTEM.md)
- Architecture Overview: ./ARCHITECTURE_OVERVIEW.md
