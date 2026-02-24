# Figma Token Reference — Semantic Token Alignment Guide

Use this document to manually map project CSS tokens to the Figma design kit variables.
All tokens are **dark-mode only**. Apply values to the **dark mode** of your Figma variable collection.

**Preferred tokens for styling the app and mapping to Figma:** component tokens `--button-*`, `--control-*`, `--surface-*`, plus the semantic set below. Naming pattern: `--button-{variant}-{property}` (e.g. `--button-primary-bg`, `--button-primary-gradient-start`).

---

## Page & App Shell

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| color-background-page | `--color-background-page` → `--color-gray-dark-600` | `#23232d` |
| color-background-elevation-base | `--color-background-elevation-base` → `--color-black-500` | `#141515` |
| color-foreground-neutral | `--color-foreground-neutral` → `--color-gray-dark-50` | `#f1f2f6` |

---

## Surfaces (Cards, Panels, Modals)

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| surface-bg | `--surface-bg` → `--color-background-elevation-raised` | `#161617` |
| surface-bg-overlay | `--surface-bg-overlay` → `--color-background-elevation-overlay` | `#121214` |
| surface-bg-sunken | `--surface-bg-sunken` → `--color-background-regular` | `#121214` |
| surface-border | `--surface-border` → `--color-border-neutral-faded` | `#6c6c6c` |
| surface-fg | `--surface-fg` → `--color-foreground-neutral` | `#f1f2f6` |
| surface-fg-muted | `--surface-fg-muted` → `--color-foreground-neutral-faded` | `#a8adb8` |
| card-bg | `--card-bg` → `--color-background-elevation-raised` | `#161617` |
| card-border | `--card-border` → `--color-border-neutral` | `#ffffff` |
| card-text | `--card-text` → `--color-foreground-neutral` | `#f1f2f6` |

---

## Text

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| text-primary | `--text-primary` → `--color-foreground-neutral` | `#f1f2f6` |
| text-secondary | `--text-secondary` → `--color-foreground-neutral-faded` | `#a8adb8` |
| text-heading | `--text-heading` → `--color-foreground-neutral` | `#f1f2f6` |
| text-accent | `--text-accent` → `--color-foreground-primary` | `#ffa24b` |
| text-link | `--text-link` → `--color-foreground-primary` | `#ffa24b` |
| text-link-hover | `--text-link-hover` → `--color-orange-200` | `#feac5e` |
| text-disabled | `--text-disabled` → `--color-foreground-disabled` | `#494a4e` |
| text-error | `--text-error` → `--color-foreground-critical` | `#e22c2c` |
| text-success | `--text-success` → `--color-foreground-positive` | `#00d370` |
| text-warning | `--text-warning` → `--color-foreground-warning` | `#eed58a` |
| text-inverse | `--text-inverse` → `--color-black` | `#000000` |

---

## Icons

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| icon-color-default | `--icon-color-default` → `--color-gray-dark-100` | `#dfedf6` |
| icon-color-active | `--icon-color-active` → `--color-orange-300` | `#ffa24b` |
| icon-color-disabled | `--icon-color-disabled` → `--color-gray-dark-500` | `#494a4e` |

---

## Borders

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| color-border-neutral | `--color-border-neutral` | `#ffffff` |
| color-border-neutral-faded | `--color-border-neutral-faded` | `#6c6c6c` |
| color-border-primary | `--color-border-primary` → `--color-orange-400` | `#ff9933` |
| color-border-critical | `--color-border-critical` → `--color-red-400` | `#e68075` |
| color-border-disabled | `--color-border-disabled` → `--color-gray-dark-500` | `#494a4e` |

---

## Form Controls (Input, Select, Textarea, Checkbox)

Use `--control-*` tokens. Map these in Figma for form components.

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| control-bg | `--control-bg` | `#141414` |
| control-bg-hover | `--control-bg-hover` | `#242424` |
| control-bg-focus | `--control-bg-focus` | `#141414` |
| control-bg-disabled | `--control-bg-disabled` | `#121214` |
| control-bg-error | `--control-bg-error` | `#141414` |
| control-border | `--control-border` → `--color-gray-dark-300` | `#6c6c6c` |
| control-border-hover | `--control-border-hover` → `--color-white` | `#ffffff` |
| control-border-focus | `--control-border-focus` → `--color-orange-400` | `#ff9933` |
| control-border-disabled | `--control-border-disabled` | `#494a4e` |
| control-border-error | `--control-border-error` → `--color-foreground-critical` | `#e22c2c` |
| control-fg | `--control-fg` | `#f1f2f6` |
| control-fg-placeholder | `--control-fg-placeholder` | `#a8adb8` |
| control-fg-disabled | `--control-fg-disabled` | `#494a4e` |
| control-fg-error | `--control-fg-error` | `#e22c2c` |
| control-shadow-focus | `--control-shadow-focus` | `0 0 0 2px rgba(255, 162, 75, 0.20)` |

---

## Buttons

### Solid variants

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| button-primary-bg | `--button-primary-bg` | `#ffa24b` |
| button-primary-text | `--button-primary-text` | `#000000` |
| button-primary-border | `--button-primary-border` | `#ff9933` |
| button-primary-hover | `--button-primary-hover` → `--color-background-primary-faded` | `#332010` |
| button-primary-border-hover | `--button-primary-border-hover` | `#4b311b` |
| button-secondary-bg | `--button-secondary-bg` | `#23232d` |
| button-secondary-text | `--button-secondary-text` | `#000000` |
| button-tertiary-bg | `--button-tertiary-bg` | `#23232d` |
| button-tertiary-text | `--button-tertiary-text` | `#a8adb8` |
| button-ghost-bg | `--button-ghost-bg` | `#23232d` |
| button-ghost-text | `--button-ghost-text` | `#a8adb8` |
| button-ghost-border | `--button-ghost-border` | `1px solid` + border color |
| button-disabled-bg | `--button-disabled-bg` | `#121214` |
| button-disabled-text | `--button-disabled-text` | `#494a4e` |

### Gradient (primary button gradient variant)

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| button-primary-gradient-start | `--button-primary-gradient-start` → `--color-orange-200` | `#feac5e` |
| button-primary-gradient-end | `--button-primary-gradient-end` → `--color-orange-600` | `#e28024` |
| button-primary-gradient-disabled-start | `--button-primary-gradient-disabled-start` | `#9a9a9a` |
| button-primary-gradient-disabled-end | `--button-primary-gradient-disabled-end` | `#6e6e6e` |

---

## Status / Semantic Colors

| Figma variable name | CSS Token | Resolved hex |
|---|---|---|
| color-background-positive | `--color-background-positive` | `#0d7544` |
| color-background-positive-faded | `--color-background-positive-faded` | `#152a1d` |
| color-foreground-positive | `--color-foreground-positive` | `#00d370` |
| color-border-positive | `--color-border-positive` | `#57b17c` |
| color-background-critical | `--color-background-critical` | `#8e1d1d` |
| color-background-critical-faded | `--color-background-critical-faded` | `#391b18` |
| color-foreground-critical | `--color-foreground-critical` | `#e22c2c` |
| color-border-critical | `--color-border-critical` | `#e68075` |
| color-background-warning | `--color-background-warning` | `#d7ae06` |
| color-background-warning-faded | `--color-background-warning-faded` | `#2b2410` |
| color-foreground-warning | `--color-foreground-warning` | `#eed58a` |
| color-border-warning | `--color-border-warning` | `#eed58a` |
| color-background-info | `--color-background-info` | `#23232d` |
| color-foreground-info | `--color-foreground-info` | `#2495ff` |
| color-border-info | `--color-border-info` | `#6c6c6c` |
| color-background-neutral | `--color-background-neutral` | `#23232d` |
| color-foreground-neutral | `--color-foreground-neutral` | `#f1f2f6` |
| color-border-neutral | `--color-border-neutral` | `#ffffff` |

---

## Interactive States

| Figma variable name | CSS Token | Resolved hex / value |
|---|---|---|
| interactive-hover-bg | `--interactive-hover-bg` → `--color-background-neutral-faded` | `#1d1d26` |
| interactive-active-bg | `--interactive-active-bg` → `--color-background-neutral` | `#23232d` |
| interactive-focus-ring | `--interactive-focus-ring` → `--color-background-primary` | `#ffa24b` |
| option-bg-hover | `--option-bg-hover` → `--color-orange-alpha-10` | `rgba(255, 162, 75, 0.10)` |
| option-bg-selected | `--option-bg-selected` → `--color-orange-alpha-15` | `rgba(255, 162, 75, 0.15)` |

---

## Typography Scale

| Scale | Font size | Line height | Weight |
|---|---|---|---|
| title-1 | 2rem / 32px | 3.25rem / 52px | 700 |
| title-2 | 1.75rem / 28px | 2.75rem / 44px | 700 |
| title-3 | 1.5rem / 24px | 2.25rem / 36px | 500 |
| title-4 | 1.25rem / 20px | 1.75rem / 28px | 500 |
| title-5 | 1.125rem / 18px | 1.5rem / 24px | 700 |
| title-6 | 1rem / 16px | 1.25rem / 20px | 700 |
| body-1 | 1.125rem / 18px | 1.75rem / 28px | 400 |
| body-2 | 1rem / 16px | 1.5rem / 24px | 400 |
| body-3 | 0.875rem / 14px | 1.25rem / 20px | 400 |
| caption-1 | 0.75rem / 12px | 1rem / 16px | 400 |
| caption-2 | 0.625rem / 10px | 0.75rem / 12px | 400 |

Font family: **Inter** for all scales.
CSS tokens: `--font-family-title` / `--font-family-body`

---

## Spacing Scale

| Token | Value |
|---|---|
| `--unit-x1` | 4px |
| `--unit-x2` | 8px |
| `--unit-x3` | 12px |
| `--unit-x4` | 16px |
| `--unit-x5` | 20px |
| `--unit-x6` | 24px |
| `--unit-x8` | 32px |
| `--unit-x10` | 40px |

---

## Border Radius Scale

| Token | Value |
|---|---|
| `--radius-xs` | 2px |
| `--radius-sm` | 4px |
| `--radius-md` | 8px |
| `--radius-lg` | 10px |
| `--radius-xl` | 12px |
| `--radius-2xl` | 16px |
| `--radius-3xl` | 22px |
| `--radius-full` | 9999px |

---

## Figma Mapping Notes

- **Dark only**: The app has a single dark theme. Only populate the **dark mode** of your Figma variable collection.
- **Primitive colors** (`--color-orange-300`, `--color-gray-dark-600`, etc.) map to the `tw-colors` collection in Figma.
- **Semantic tokens** (`--color-background-primary`, `--text-primary`, etc.) map to the semantic layer of the Figma design kit.
- **Component tokens** (`--button-*`, `--control-*`, `--surface-*`) are the preferred set for styling the app and mapping to Figma. Use the naming pattern `--button-{variant}-{property}` (e.g. `--button-primary-bg`, `--button-primary-gradient-start`, `--button-primary-gradient-end`).
- **shadcn/ui tokens** (`--background`, `--foreground`, `--card`, `--border`, `--primary`, etc.) bridge the semantic layer to shadcn components — map them to the global/base variables in Figma.
- **Brand / primary color**: `--color-orange-300` = `#ffa24b`. Use this for any Figma "Primary" color variable.

---

## Source Files

| File | Purpose |
|---|---|
| `src/themes/base.css` | Primitives (raw colors, spacing, radius, typography scale, animation) and layout tokens in `:root` |
| `src/themes/theme.css` | Semantic and component color tokens for dark theme in `[data-theme='dark']` |
