# Sync app tokens to Figma — short instructions

Use this when you need to **map app token values back into Figma variables** so the Design Library matches the app. Full mapping details and rationale are in [DESIGN-KIT-TOKEN-ALIGNMENT.md](DESIGN-KIT-TOKEN-ALIGNMENT.md).

---

## Prerequisites

- A copy of the [Design Library](https://www.figma.com/design/n0LilXaAc6TuTn6g1qwOGz/Design-Library?node-id=0-1) (or your team’s fork) where you can edit variables.
- Resolved token values from the app (see “Export from app” below). You can use the **sync script** (recommended) or resolve by hand.

---

## 0. Automated sync (recommended)

From the repo root (`clickhouse-etl/ui`):

```bash
# Extract tokens to JSON only (no Figma API call)
npm run sync-tokens -- --dry-run

# Push to Figma (requires Enterprise plan, token with file_variables:read/write)
FIGMA_ACCESS_TOKEN=figd_xxx FIGMA_FILE_KEY=<file_key> npm run sync-tokens
```

The script reads `src/themes/base.css`, `semantic-tokens.css`, and `dark/theme.css` / `light/theme.css`, resolves all `var()` references, and either writes the payload to `scripts/sync-tokens-to-figma/tokens-for-figma.json` or pushes variable values to Figma via the Variables REST API. See **scripts/sync-tokens-to-figma/README.md** for details and troubleshooting.

---

## 1. Export from app (manual alternative)

If you are not using the script, resolve CSS variables to final values (hex, px, number) for:

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

## 3. Optional: automate further

The **sync script** (see §0) already automates export and Figma API push. To run it in CI or from another tool, invoke `node scripts/sync-tokens-to-figma/sync-tokens-to-figma.mjs` with the same env vars. The mapping rules in §2 define the exact collection and variable names the script uses.

---

## Reference

- **Full mapping and rationale:** [DESIGN-KIT-TOKEN-ALIGNMENT.md](DESIGN-KIT-TOKEN-ALIGNMENT.md)
- **Sync script details:** [scripts/sync-tokens-to-figma/README.md](../../scripts/sync-tokens-to-figma/README.md)
- **Design kit structure (keys):** `tokens-external-design-kit.json` in this folder
