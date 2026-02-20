# Design Kit Token Alignment — Summary and Reference

This document summarizes the alignment of the codebase theme tokens with the shadcn-based Figma design kit ([Design Library](https://www.figma.com/design/n0LilXaAc6TuTn6g1qwOGz/Design-Library?node-id=0-1)). It is intended as a reference for further refinement and for step 2 (importing our token values back into Figma).

**Source of design kit structure:** `tokens-external-design-kit.json` in this folder.

For **step-by-step instructions** to map app tokens and values back into Figma variables, see **[Sync app tokens to Figma](FIGMA-SYNC-INSTRUCTIONS.md)** in this folder.

---

## Operational approach (how we work with the design kit)

- **Source of truth:** The **app codebase** is the source of truth for token values. Theme files (`base.css`, `dark/theme.css`, `light/theme.css`) and semantic tokens define what we use. The Figma design kit is updated to match (sync in step 2), not the other way around.
- **Goal:** Minimise differences between the app and the design kit so that designs and implementation stay aligned. We do this by:
  - Using **design-kit-style token names** (or aliases) in the app where possible (`--radius-sm`, `--p-1`, `--rounded-sm`, `--gap-1`, etc.).
  - **Syncing values from app → Figma** for both **mode** (light-mode / dark-mode) and **primitive collections** (tw-colors, tw-border-radius, tw-gap, tw-space, tw-margin, tw-font). We do not leave primitives on kit defaults where we have an app equivalent.
- **When adding or changing tokens:**
  - Prefer adding **aliases** that match Figma collection keys (e.g. `--rounded-sm` for tw-border-radius, `--gap-1` for tw-gap) so one export step can push to all relevant Figma collections.
  - Document the mapping in this file (§2 and §3) and in the sync instructions so step 2 stays repeatable.
- **Colors:** We use **one palette** for both **tw-colors** and **rdx-colors** (same keys, same values from our `--color-*`). No separate rdx palette.
- **Step 2 (sync to Figma):** Can be done manually (see [FIGMA-SYNC-INSTRUCTIONS.md](FIGMA-SYNC-INSTRUCTIONS.md)) or automated via a script / Figma plugin that reads our CSS or an exported tokens JSON and updates Figma variables.

---

## 1. What Was Done

### Phase 1: Radius (design kit naming, our values kept)

- **base.css**
  - Introduced design-kit-style radius tokens with **our** pixel values:
    - `--radius-xs`: 2px
    - `--radius-sm`: 4px (was `--radius-small`)
    - `--radius-md`: 8px (was `--radius-medium`)
    - `--radius-lg`: 10px
    - `--radius-xl`: 12px (was `--radius-large`)
    - `--radius-2xl`: 16px (was `--radius-extra-large`)
    - `--radius-3xl`: 22px
    - `--radius-4xl`: 26px
    - `--radius-full`: 9999px
    - `--radius-none`: 0
  - Kept legacy names as **aliases** so existing usage still works:
    - `--radius-small` → `var(--radius-sm)`
    - `--radius-medium` → `var(--radius-md)`
    - `--radius-large` → `var(--radius-xl)`
    - `--radius-extra-large` → `var(--radius-2xl)`
- **Theme files** (dark/theme.css, light/theme.css): `--radius` set to `var(--radius-md)`; all component radius tokens now reference `--radius-sm`, `--radius-md`, or `--radius-xl`.
- **semantic-tokens.css**: `--table-radius` and `--table-row-radius` use `--radius-xl` and `--radius-md`.
- **App-wide**: All references to `--radius-small`, `--radius-medium`, `--radius-large` in TSX and CSS were updated to `--radius-sm`, `--radius-md`, `--radius-xl` (themes, app/styles, modules: transformation, filter, notifications, kafka, components).
- **base.css**: Added **tw-border-radius parity aliases** `--rounded-xs` … `--rounded-none` (alias to `--radius-*`) so step 2 can push the same values to both `mode.radius-*` and `tw-border-radius.rounded-*`, reducing diff when Figma components use `tw-border-radius`.

### Phase 2: Spacing (design kit parity aliases)

- **base.css**: Added Tailwind-style spacing aliases for design kit parity:
  - `--p-1` … `--p-10` → `var(--unit-x1)` … `var(--unit-x10)` (same 4px-base scale as `tw-padding` / `p-*` in the kit).
  - `--gap-1` … `--gap-10` → `var(--p-1)` … `var(--p-10)` for **tw-gap** (e.g. `gap-1`, `gap-2`, …).
  - `--space-1` … `--space-10` → `var(--p-1)` … `var(--p-10)` for **tw-space** (e.g. `space-x-1`, `space-y-1`, …).
  - `--m-1` … `--m-10` → `var(--p-1)` … `var(--p-10)` for **tw-margin** (e.g. `m-1`, `mt-1`, `mx-2`, …).
  One source (`--unit-x*` / `--p-*`) drives all; in step 2 export can push to tw-padding, tw-gap, tw-space, and tw-margin from these aliases.

### Phase 3: Base color → Figma mapping (documentation)

- **base.css**: Added a comment block above the color tokens explaining:
  - CSS `--color-{name}` maps to Figma `tw-colors` and `rdx-colors` key `{name}` (we set both to the same values in step 2).
  - Example: `--color-orange-300` → `tw-colors / orange-300` and `rdx-colors / orange-300`.
  - Our hex values override the kit defaults when syncing to Figma (step 2).

### Phase 4: Optional theme variables (for Figma mode sync)

- **base.css**: Added `--stroke-width: 2px` and `--border-width: 1px` (design kit `mode.stroke-width`, `mode.border-width`).
- **dark/theme.css** and **light/theme.css**: Added theme variables so the design kit’s `mode` (light-mode / dark-mode) can be populated from our theme:
  - **Sidebar:** `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` (all point at existing semantic tokens: card, primary, accent, border, ring).
  - **Charts:** `--chart-1` … `--chart-5` (point at blue/orange/gray palette tokens).
  - **Semantic:** `--semantic-background`, `--semantic-border`, `--semantic-foreground` (point at elevation and neutral tokens).
  - **Overlay:** `--background-color` (alpha overlay, e.g. `#0000004c`); maps to `mode.background-color` in step 2.
- **base.css**: Added **tw-font parity aliases** so Figma text styles can be driven from our scale in step 2: `--size-xs`, `--size-sm`, `--size-base`, `--size-lg`, `--size-xl`, `--leading-3` … `--leading-8`, `--weight-normal`, `--weight-medium`, `--weight-semibold`, `--weight-bold`, `--family-sans` (see §2.5 and §3.6).

---

## 2. Differences: Project vs Design Kit

### 2.1 Radius

| Our token (after alignment) | Our value | Design kit (mode) | Kit default value |
|-----------------------------|-----------|-------------------|-------------------|
| `--radius-xs`               | 2px       | `radius-xs`       | 2                 |
| `--radius-sm`               | 4px       | `radius-sm`       | 6                 |
| `--radius-md`               | 8px       | `radius-md`       | 8                 |
| `--radius-lg`               | 10px      | `radius-lg`       | 10                |
| `--radius-xl`               | 12px      | `radius-xl`       | 14                |
| `--radius-2xl`              | 16px      | `radius-2xl`      | 18                |
| `--radius-3xl`              | 22px      | `radius-3xl`      | 22                |
| `--radius-4xl`              | 26px      | `radius-4xl`      | 26                |
| `--radius-full`             | 9999px    | `radius-full`     | 9999              |
| `--radius-none`             | 0         | `radius-none`     | 0                 |

**Note:** We kept **our** values (4, 8, 12, 16) for the core scale so the UI look did not change; `--radius-3xl` and `--radius-4xl` match the kit (22px, 26px) for full mode parity. In step 2, when pushing to Figma, set the kit’s `mode.radius-*` variables (including `radius-3xl`, `radius-4xl`, `radius-none`) to these same values so the design kit matches the app.

**tw-border-radius (Option A — sync from our scale):** Figma has a second radius collection, **tw-border-radius**, with keys `rounded-xs`, `rounded-sm`, `rounded-md`, etc. (kit defaults: 2, 4, 6, 8, 12, 16, 24, 32, 9999, 0). To minimise differences when components use `tw-border-radius`, we also sync it from our radius scale in step 2. We expose `--rounded-*` aliases in `base.css` so one export can drive both:

| Our token (base.css) | Design kit (tw-border-radius) | Value source |
|----------------------|-------------------------------|--------------|
| `--rounded-xs`       | `rounded-xs`                  | `--radius-xs` (2px)  |
| `--rounded-sm`       | `rounded-sm`                  | `--radius-sm` (4px)  |
| `--rounded-md`       | `rounded-md`                  | `--radius-md` (8px)  |
| `--rounded-lg`       | `rounded-lg`                  | `--radius-lg` (10px) |
| `--rounded-xl`       | `rounded-xl`                  | `--radius-xl` (12px) |
| `--rounded-2xl`      | `rounded-2xl`                 | `--radius-2xl` (16px) |
| `--rounded-3xl`      | `rounded-3xl`                 | `--radius-3xl` (22px) |
| `--rounded-4xl`      | `rounded-4xl`                 | `--radius-4xl` (26px) |
| `--rounded-full`     | `rounded-full`                | `--radius-full` (9999px) |
| `--rounded-none`     | `rounded-none`                | `--radius-none` (0) |

In step 2, set **tw-border-radius** collection keys to the resolved values of these `--rounded-*` (or `--radius-*`) tokens so components that use `tw-border-radius` in Figma match the app.

### 2.2 Spacing

| Our token   | Value | Design kit equivalent |
|------------|-------|------------------------|
| `--unit-x1` … `--unit-x10` | 4px … 40px | `tw-padding`: `p-1` (4), `p-2` (8), `p-3` (12), `p-4` (16), etc. |
| `--p-1` … `--p-10`   | alias to unit-x1 … unit-x10 | `tw-padding`: `p-1`, `p-2`, … |
| `--gap-1` … `--gap-10`   | alias to p-1 … p-10 | `tw-gap`: `gap-1`, `gap-2`, … (4px … 40px) |
| `--space-1` … `--space-10` | alias to p-1 … p-10 | `tw-space`: `space-x-1`, `space-y-1`, `space-x-2`, … (use value of `--space-N` for key `space-x-N` / `space-y-N`) |
| `--m-1` … `--m-10`   | alias to p-1 … p-10 | `tw-margin`: `m-1`, `mt-1`, `mb-1`, `ml-1`, `mr-1`, `mx-1`, `my-1`, `m-2`, … (use value of `--m-N` for keys with numeric N) |

Scale is the same (4px base) across tw-padding, tw-gap, tw-space, tw-margin. In step 2, set **tw-gap** keys `gap-1` … `gap-10` from `--gap-*`, **tw-space** keys `space-x-N` / `space-y-N` from `--space-N`, and **tw-margin** keys (e.g. `m-N`, `mt-N`, `mx-N`) from `--m-N` so all spacing collections match the app. We define 1–10; the kit may have more keys (e.g. gap-11, space-x-12)—export can push 1–10 and leave the rest as kit defaults or extend aliases later.

### 2.3 Theme (semantic) layer

- **Already aligned:** `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--border`, `--input`, `--ring`, `--radius`. No renames were required.
- **Added for kit parity:** `--sidebar*`, `--chart-1` … `--chart-5`, `--semantic-background`, `--semantic-border`, `--semantic-foreground`, `--background-color` (overlay alpha for `mode.background-color` in step 2).

### 2.4 Base (primitive) colors

- **Design kit:** `tw-colors` and `rdx-colors` both use keys like `orange-300`, `gray-500` (no prefix). Values in the JSON are default Tailwind / Radix.
- **Our project:** We use `--color-orange-300`, `--color-gray-dark-600`, etc., with **custom brand** hex values.
- **Mapping:** Keep `--color-{name}` in CSS. When exporting/importing, map `--color-{name}` ↔ Figma collection key `{name}` (e.g. `--color-orange-300` ↔ `tw-colors / orange-300`). In step 2, push our hex values into **tw-colors**; set **rdx-colors** to the **same values** as tw-colors (from our `--color-*`) so both collections use our brand palette and stay in sync.

### 2.5 Typography

- **Our project:** Custom scale (`--font-size-title-1`, `--font-size-body-3`, etc.) plus **tw-font parity aliases** in `base.css`.
- **Design kit:** `tw-font` uses `size-xs`, `size-sm`, `size-base`, `size-lg`, `size-xl`, `leading-*`, `weight-*`, `family-sans` (Inter).
- **Mapping (for step 2 export):** Use the following when pushing theme/base tokens to Figma `tw-font`:

| Our token (base.css) | Value / source | Design kit (tw-font) |
|----------------------|----------------|----------------------|
| `--size-xs`          | `var(--font-size-caption-1)` (12px) | `size-xs` |
| `--size-sm`          | `var(--font-size-body-3)` (14px)    | `size-sm` |
| `--size-base`        | `var(--font-size-body-2)` (16px)    | `size-base` |
| `--size-lg`          | `var(--font-size-body-1)` (18px)    | `size-lg` |
| `--size-xl`          | `var(--font-size-title-4)` (20px)   | `size-xl` |
| `--leading-3` … `--leading-8` | 12px … 32px                 | `leading-3` … `leading-8` |
| `--weight-normal`    | `var(--font-weight-regular)` (400)  | `weight-normal` |
| `--weight-medium`    | `var(--font-weight-medium)` (500)  | `weight-medium` |
| `--weight-semibold`  | `var(--font-weight-semibold)` (600) | `weight-semibold` |
| `--weight-bold`      | `var(--font-weight-bold)` (700)     | `weight-bold` |
| `--family-sans`      | `var(--font-family-body)` (Inter)   | `family-sans` |

---

## 3. Where We Introduced Mapping

### 3.1 Legacy radius aliases (backward compatibility)

**Location:** `base.css`

- **Mapping:** Old names → new design-kit-style names.
  - `--radius-small` → `var(--radius-sm)`
  - `--radius-medium` → `var(--radius-md)`
  - `--radius-large` → `var(--radius-xl)`
  - `--radius-extra-large` → `var(--radius-2xl)`
- **Reason:** Any remaining `var(--radius-small)` etc. in the codebase still resolve correctly. New code should use `--radius-sm`, `--radius-md`, `--radius-xl`, `--radius-2xl`.

### 3.2 Spacing aliases (design kit parity)

**Location:** `base.css`

- **Mapping:**
  - `--p-1` … `--p-10` → `var(--unit-x1)` … `var(--unit-x10)` (tw-padding).
  - `--gap-1` … `--gap-10` → `var(--p-1)` … `var(--p-10)` (tw-gap: keys `gap-1` … `gap-10`).
  - `--space-1` … `--space-10` → `var(--p-1)` … `var(--p-10)` (tw-space: keys `space-x-N`, `space-y-N` use value of `--space-N`).
  - `--m-1` … `--m-10` → `var(--p-1)` … `var(--p-10)` (tw-margin: keys `m-N`, `mt-N`, `mb-N`, `ml-N`, `mr-N`, `mx-N`, `my-N` use value of `--m-N`).
- **Reason:** One spacing scale drives tw-padding, tw-gap, tw-space, and tw-margin so step 2 can push the same values to all four Figma collections and minimise diff.

### 3.3 Base color → Figma collection (documentation only)

**Location:** Comment block in `base.css` above the color tokens.

- **Mapping:** `--color-{name}` → Figma `tw-colors` / `{name}` and `rdx-colors` / `{name}` (same key, same value in both collections).
- **Reason:** Single reference for step 2 export/import; we set both tw-colors and rdx-colors from our `--color-*` so the kit uses our palette everywhere.

### 3.4 Theme variables for Figma mode (sidebar, chart, semantic)

**Location:** `dark/theme.css`, `light/theme.css`

- **Mapping:**
  - Sidebar tokens → existing card/primary/accent/border/ring.
  - Chart tokens → blue/orange/gray palette (`--color-blue-500`, `--color-orange-300`, etc.).
  - Semantic tokens → elevation and neutral semantic colors.
  - `--background-color` → `mode.background-color` (overlay alpha; e.g. `#0000004c`).
- **Reason:** The design kit’s `mode` (light-mode / dark-mode) includes these variables; we expose them so that when we push theme values to Figma, sidebar/chart/semantic/overlay components in the kit pick up our styling.

### 3.5 Stroke and border width

**Location:** `base.css` (`:root`)

- **Mapping:** `--stroke-width: 2px`, `--border-width: 1px` (design kit `mode.stroke-width`, `mode.border-width`). Not re-declared in theme; inherited from `:root`.
- **Reason:** Design kit mode uses these; we define them once so they can be exported to Figma in step 2.

### 3.6 Typography (tw-font aliases)

**Location:** `base.css`

- **Mapping:** Our scale → design kit `tw-font` keys (see §2.5 table):
  - `--size-xs`, `--size-sm`, `--size-base`, `--size-lg`, `--size-xl` → `tw-font / size-*`
  - `--leading-3` … `--leading-8` → `tw-font / leading-*`
  - `--weight-normal`, `--weight-medium`, `--weight-semibold`, `--weight-bold` → `tw-font / weight-*`
  - `--family-sans` → `tw-font / family-sans`
- **Reason:** In step 2, export can push these values into Figma’s `tw-font` so text styles in the design kit are driven from our typography scale.

### 3.7 Radius → tw-border-radius (design kit parity)

**Location:** `base.css`

- **Mapping:** `--rounded-xs` … `--rounded-none` → `var(--radius-xs)` … `var(--radius-none)`; in step 2, push resolved values to Figma **tw-border-radius** keys `rounded-xs`, `rounded-sm`, …, `rounded-none` (see §2.1 table).
- **Reason:** Figma has two radius systems (`mode.radius-*` and `tw-border-radius.rounded-*`). Syncing both from our single radius scale keeps the design kit and app aligned when components use either collection.

### 3.8 Spacing → tw-gap, tw-space, tw-margin

**Location:** `base.css`

- **Mapping:** `--gap-1` … `--gap-10`, `--space-1` … `--space-10`, `--m-1` … `--m-10` all alias to `var(--p-1)` … `var(--p-10)`. In step 2, push resolved values to Figma **tw-gap** (`gap-1` … `gap-10`), **tw-space** (`space-x-N`, `space-y-N` from `--space-N`), and **tw-margin** (`m-N`, `mt-N`, etc. from `--m-N`) — see §2.2.
- **Reason:** The kit has separate collections for padding, gap, space, and margin; we expose matching alias names so export can update all four from one source and keep the design kit in sync with the app.

---

## 4. Files Touched (Quick Reference)

| Area | Files |
|------|--------|
| **Token definitions** | `base.css`, `dark/theme.css`, `light/theme.css`, `semantic-tokens.css` |
| **Radius usage** | All TSX/CSS that referenced `--radius-small` / `--radius-medium` / `--radius-large` (e.g. `app/styles/components/modal.css`, `card.css`, `button.css`, `input.css`, `select.css`, `globals.css`, and modules under `modules/transformation`, `modules/filter`, `modules/notifications`, `modules/kafka`, `components/notifications`) |

---

## 5. Next Steps (Step 2 — Not Yet Done)

1. **Export** from the codebase: Resolve theme variables (for light and dark) and base colors to final hex/px values.
2. **Import into Figma:** In your copy of the Design Library, set:
   - **mode** (light-mode / dark-mode): Set `background`, `foreground`, `primary`, `radius-md`, etc., to the values from our theme; include `--radius-*` (all, including `radius-3xl`, `radius-4xl`, `radius-none`), `--sidebar*`, `--chart-*`, `--semantic-*`, and `--background-color` where the kit uses them.
   - **tw-border-radius:** Set `rounded-xs`, `rounded-sm`, …, `rounded-none` from our `--rounded-*` (or `--radius-*`) so components using `tw-border-radius` match the app (see §2.1 and §3.7).
   - **tw-gap:** Set `gap-1` … `gap-10` from our `--gap-*` (see §2.2, §3.8).
   - **tw-space:** Set `space-x-N`, `space-y-N` from our `--space-N` for N = 1…10 (see §2.2, §3.8).
   - **tw-margin:** Set `m-N`, `mt-N`, `mb-N`, `ml-N`, `mr-N`, `mx-N`, `my-N` from our `--m-N` for N = 1…10 (see §2.2, §3.8).
   - **tw-font:** Set `size-xs`, `size-sm`, `size-base`, `size-lg`, `size-xl`, `leading-*`, `weight-*`, `family-sans` from our `--size-*`, `--leading-*`, `--weight-*`, `--family-sans` (see §2.5).
   - **tw-colors and rdx-colors:** Set both collections to the **same values** from our `--color-*` hex values (e.g. `orange-300`, `gray-dark-600`). Using the same palette for both removes ambiguity and keeps the design kit consistent.
3. **Optional:** Automate step 2 with a script that reads `base.css` / theme CSS (or a generated tokens JSON) and updates Figma via the Figma API or a plugin.

---

## 6. Design Kit Structure Reference (from tokens-external-design-kit.json)

- **tw-colors:** Primitive palette (mode-1); keys like `orange-300`, `gray-500`. We sync tw-colors and rdx-colors from the same `--color-*` values in step 2.
- **tw-padding, tw-space, tw-margin, tw-gap:** 4px-base spacing (mode-1). We sync all four from our scale in step 2 via `--p-*`, `--gap-*`, `--space-*`, `--m-*` (see §2.2, §3.2, §3.8).
- **tw-border-radius:** `rounded-xs`, `rounded-sm`, …, `rounded-full`, `rounded-none` (mode-1). We sync this collection from our radius scale in step 2 via `--rounded-*` aliases so it matches the app (see §2.1, §3.7).
- **mode:** Theme layer with **light-mode** and **dark-mode**; contains semantic colors, `radius-xs` … `radius-full`, `radius-none`, `radius-3xl`, `radius-4xl`, `background-color` (overlay), `stroke-width`, `border-width`.
- **rdx-colors:** Same key structure as tw-colors; in step 2 we set rdx-colors to the same values as tw-colors (from our `--color-*`) so both use our brand palette.
- **tw-font, tw-height, tw-max-width, tw-border-width, tw-opacity:** Other primitives (mode-1).

Use this document when refining tokens, adding new mappings, or implementing the Figma sync in step 2. For a short, actionable checklist to perform the sync, use **[FIGMA-SYNC-INSTRUCTIONS.md](FIGMA-SYNC-INSTRUCTIONS.md)**.
