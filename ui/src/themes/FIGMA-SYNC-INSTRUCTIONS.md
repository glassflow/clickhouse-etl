# Sync app tokens to Figma — short instructions

Use this when you need to **map app token values back into Figma variables** so the Design Library matches the app. Full mapping details and rationale are in [DESIGN-KIT-TOKEN-ALIGNMENT.md](DESIGN-KIT-TOKEN-ALIGNMENT.md).

---

## Prerequisites

- A copy of the [Design Library](https://www.figma.com/design/n0LilXaAc6TuTn6g1qwOGz/Design-Library?node-id=0-1) (or your team’s fork) where you can edit variables.
- Resolved token values from the app (see “Export from app” below). You can resolve by hand from `base.css` and theme files, or use a script that evaluates CSS variables for light and dark.

---

## 1. Export from app

Resolve CSS variables to final values (hex, px, number) for:

- **base.css** — radius (`--radius-*`, `--rounded-*`), spacing (`--p-*`, `--gap-*`, `--space-*`, `--m-*`), colors (`--color-*`), typography (`--size-*`, `--leading-*`, `--weight-*`, `--family-sans`), `--stroke-width`, `--border-width`.
- **dark/theme.css** — all variables under `[data-theme='dark']` (e.g. `--background`, `--foreground`, `--radius`, `--sidebar`, `--chart-1` … `--chart-5`, `--semantic-*`, `--background-color`). Resolve to hex/px.
- **light/theme.css** — same for `[data-theme='light']`.

You can do this by loading the app with one theme active and reading computed values, or by parsing the CSS and resolving `var()` references.

---

## 2. Import into Figma (by collection)

In Figma, open **Local variables** and update these collections with the exported values.

| Figma collection | What to set | App source |
|------------------|-------------|------------|
| **mode** (light-mode) | `background`, `foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `border`, `input`, `ring`, `radius`, `radius-xs` … `radius-4xl`, `radius-full`, `radius-none`, `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`, `chart-1` … `chart-5`, `semantic-background`, `semantic-border`, `semantic-foreground`, `background-color`, `stroke-width`, `border-width` | light/theme.css (resolved) |
| **mode** (dark-mode) | Same variable names as light-mode | dark/theme.css (resolved) |
| **tw-colors** | Keys: color name without `--color-` prefix (e.g. `orange-300`, `gray-dark-600`). Values: our hex. | base.css `--color-*` |
| **rdx-colors** | Same keys and values as tw-colors (same palette). | Same as tw-colors |
| **tw-border-radius** | `rounded-xs`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-4xl`, `rounded-full`, `rounded-none` → resolved `--rounded-*` (or `--radius-*`) in px | base.css |
| **tw-gap** | `gap-1` … `gap-10` → resolved `--gap-*` (px) | base.css |
| **tw-space** | `space-x-1`, `space-y-1`, `space-x-2`, `space-y-2`, … `space-x-10`, `space-y-10` → value of `--space-N` for N = 1…10 (px) | base.css |
| **tw-margin** | `m-1`, `mt-1`, `mb-1`, `ml-1`, `mr-1`, `mx-1`, `my-1`, … `m-10`, etc. → value of `--m-N` for N = 1…10 (px) | base.css |
| **tw-font** | `size-xs`, `size-sm`, `size-base`, `size-lg`, `size-xl` (px); `leading-3` … `leading-8` (px); `weight-normal`, `weight-medium`, `weight-semibold`, `weight-bold`; `family-sans` (string) | base.css `--size-*`, `--leading-*`, `--weight-*`, `--family-sans` |

- **Numeric values in Figma:** Use raw numbers (e.g. `8` for 8px, `12` for 12px) where the variable type is number; use px or unit as required by the Figma variable type.
- **Colors:** Always hex (e.g. `#ffa24b`). For `mode`, use the resolved theme values (they may reference `--color-*`).

---

## 3. Optional: automate

You can automate step 2 with a script that:

1. Reads `base.css`, `dark/theme.css`, `light/theme.css` (or an exported JSON).
2. Resolves variables to final values.
3. Calls the Figma API (or uses a plugin) to set variable values in the Design Library.

The mapping rules above define the exact collection and variable names to update.

---

## Reference

- **Full mapping and rationale:** [DESIGN-KIT-TOKEN-ALIGNMENT.md](DESIGN-KIT-TOKEN-ALIGNMENT.md)
- **Design kit structure (keys):** `tokens-external-design-kit.json` in this folder
