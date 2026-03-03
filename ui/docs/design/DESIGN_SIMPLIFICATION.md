Completed

Phase 1 — Remove light theme (~800 lines)

- Deleted src/themes/light/theme.css
- Removed [data-theme='light'] block from semantic-tokens.css
- Removed --color-gray-light-\* from base.css
- Removed light theme import from globals.css
- Deleted ThemeDebug.tsx and its export

Phase 2 — Consolidate semantic-tokens into one file

- Merged semantic-tokens.css + dark/theme.css into src/themes/theme.css
- All tokens deduplicated (dark/theme.css values win for conflicts)
- --card-border discrepancy resolved (uses --color-border-neutral)
- All text tokens consolidated (--text-accent, --text-inverse, --text-error, etc. merged in)
- globals.css updated to @import '../themes/theme.css'

Phase 3 — Move layout tokens to :root

- All button/chip/toggle/table/loader/select layout tokens moved from [data-theme='dark'] to :root in base.css
- Color tokens remain in theme.css

Phase 4 — Remove alias tokens

- Removed ~80 Figma-parity aliases (--p-_, --gap-_, --space-_, --m-_, --rounded-_, --radius-small/medium/large/extra-large, --size-_, --leading-_, --weight-_, --family-sans, all
  per-scale --font-family-{scale}-{N})
- Updated all component CSS to use --font-family-title / --font-family-body directly
- Removed --font-sans, --font-heading, --transition-\*, --shadow-sm/md aliases from globals.css

Phase 5 — Remove invalid CSS properties

- Removed --select-content-role, --select-content-aria-\*, --select-content-position, --select-content-overflow

Phase 6 — Fix hardcoded values

- Added --color-orange-alpha-10/15/20, --color-orange-gradient-hover, --color-gray-350, --color-slate-200/700 to base.css
- Replaced all rgba(255, 162, 75, ...) with token references
- Removed duplicate --color-orange-700 (same value as --color-orange-600)
- Replaced --color-gray-50/950 aliases with --color-white/--color-black directly
- Fixed event-editor.css hardcoded #1e1e1f

Phase 8 — Remove Tailwind-conflicting utilities

- Deleted spacings.css (.margin-_, .padding-_, .gap-\* — unused, Tailwind provides equivalents)
- Removed .grid-cols-2/3 from layout.css (Tailwind provides equivalents)

Phase 9 — Design token simplification and Figma reference revision

- **Unified button token naming**: All button colors (solid + gradient) use `--button-{variant}-{property}`. Added `--button-primary-gradient-start`, `--button-primary-gradient-end`, `--button-primary-gradient-disabled-start`, `--button-primary-gradient-disabled-end` in theme.css. Removed `--color-button-gradient-from/to` and `--color-button-gradient-disabled-from/to` from base.css; added `--color-gray-disabled-gradient-start/end` for disabled gradient. Button gradient variant in button.tsx now uses only `--button-primary-*` tokens. extract-tokens.mjs updated to collect the new gradient token names.
- **surface-bg-hover fix**: RawExpressionEditor.tsx now uses `--interactive-hover-bg` instead of undefined `--surface-bg-hover` for list item hover.
- **FIGMA_TOKEN_REFERENCE.md revised**: Restructured with Figma variable name column, expanded Buttons section (solid + gradient subsections), single Form Controls table using `--control-*`, updated Source Files (base.css = primitives + layout in :root; theme.css = semantic/color in [data-theme='dark']), and Figma Mapping Notes updated to recommend component tokens (`--button-*`, `--control-*`, `--surface-*`) and the naming pattern.
- **Theme aliases**: `--card-bg` now aliases to `--surface-bg`. All `--input-*` tokens alias to corresponding `--control-*` (input-bg → control-bg, input-border → control-border, etc.) so one set is the source of truth for form controls.
