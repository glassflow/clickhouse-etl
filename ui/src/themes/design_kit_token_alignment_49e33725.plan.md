---
name: Design kit token alignment
overview: Analysis of tokens-external-design-kit.json vs the project theme layer, and a concrete plan to align the codebase naming and conventions with the Figma design kit so that step 2 (importing values back into Figma) can rely on matching token names.
todos: []
isProject: false
---

# Design Kit Token Alignment: Analysis and Differences

## 1. Structure of `tokens-external-design-kit.json`

The file has **top-level groups** (Figma variable collections):


| Group                            | Modes                          | Purpose                                                                                                                                                                                                |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **tw-colors**                    | mode-1                         | Tailwind palette: `slate-50`..`slate-950`, `gray-`*, `zinc-`*, `red-*`, `orange-*`, `green-*`, etc. Keys are **without** a `color-` prefix (e.g. `orange-300`, not `color-orange-300`).                |
| **tw-padding**                   | mode-1                         | Tailwind padding: `px-1` (4), `px-2` (8), `px-3` (12), `px-4` (16), `p-4`, `px-1-5` (6), etc. Values in px.                                                                                            |
| **tw-space**                     | mode-1                         | `space-x-1`, `space-y-2`, etc. Same 4px-base scale.                                                                                                                                                    |
| **tw-border-radius**             | mode-1                         | `rounded-xs` (2), `rounded-sm` (4), `rounded-md` (6), `rounded-lg` (8), `rounded-xl` (12), `rounded-2xl` (16), `rounded-3xl` (24), `rounded-full` (9999). Plus corner-specific (e.g. `rounded-ss-sm`). |
| **tw-margin**                    | mode-1                         | `m-1`, `mt-2`, `mx-4`, etc.                                                                                                                                                                            |
| **tokens**                       | mode-1                         | Numeric primitives (0, 1, 4, 8, 12, 16, … 9999, and decimals).                                                                                                                                         |
| **mode**                         | **light-mode** / **dark-mode** | **Theme (semantic) variables** — see below.                                                                                                                                                            |
| **tw-border-width**              | mode-1                         | `border` (1), `border-2`, etc.                                                                                                                                                                         |
| **tw-gap**                       | mode-1                         | `gap-1`, `gap-2`, etc.                                                                                                                                                                                 |
| **tw-font**                      | mode-1                         | `size-xs` (12), `size-sm` (14), `size-base` (16), `size-lg` (18), `size-xl` (20), `leading-`*, `weight-`*, `family-sans` (Inter), etc.                                                                 |
| **tw-height** / **tw-max-width** | mode-1                         | Component dimensions.                                                                                                                                                                                  |
| **rdx-colors**                   | mode-1                         | Radix-style palette (separate scale).                                                                                                                                                                  |
| **tw-opacity**                   | mode-1                         | `opacity-0`..`opacity-100`.                                                                                                                                                                            |


The **theme layer** used for alignment is `**mode`** with `**light-mode`** and `**dark-mode`**. Each mode contains:

- **Colors:** `background`, `foreground`, `border`, `destructive`, `secondary`, `muted`, `muted-foreground`, `primary`, `primary-foreground`, `secondary-foreground`, `accent`, `accent-foreground`, `ring`, `input`, `card`, `card-foreground`, `popover`, `popover-foreground`, `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`, `chart-1`..`chart-5`, `semantic-background`, `semantic-border`, `semantic-foreground`, `background-color`.
- **Radius:** `radius-xs` (2), `radius-sm` (6), `radius-md` (8), `radius-lg` (10), `radius-xl` (14), `radius-2xl` (18), `radius-3xl` (22), `radius-4xl` (26), `radius-full` (9999), `radius-none` (0).
- **Other:** `stroke-width` (2), `border-width` (1).

---

## 2. Naming and value differences: project vs design kit

### 2.1 Theme (semantic) layer — already aligned

Your [dark/theme.css](clickhouse-etl/ui/src/themes/dark/theme.css) and [light/theme.css](clickhouse-etl/ui/src/themes/light/theme.css) already define the **same semantic names** as the design kit’s `mode`:

- `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground` (kit has `destructive`; kit’s light has `primary-foreground`), `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--border`, `--input`, `--ring`, `--radius`.

So **no renames needed** for these in theme files; they already match the kit’s naming. In step 2 you will only need to **set** the design kit’s `mode` values from these (with your brand colors).

**Design kit has, we don’t (optional to add for future Figma parity):**

- `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`
- `chart-1`..`chart-5`
- `semantic-background`, `semantic-border`, `semantic-foreground`
- `background-color` (alpha overlay)
- `stroke-width`, `border-width` (we have these conceptually in base but not in theme)

You can add these later when you use the kit’s sidebar/chart/semantic components or when pushing tokens back to Figma.

---

### 2.2 Radius: naming and scale mismatch


| Project (base.css)     | Value  | Design kit (mode) | Value |
| ---------------------- | ------ | ----------------- | ----- |
| `--radius-small`       | 4px    | `radius-sm`       | 6     |
| `--radius-medium`      | 8px    | `radius-md`       | 8     |
| `--radius-large`       | 12px   | `radius-xl`       | 14    |
| `--radius-extra-large` | 16px   | `radius-2xl`      | 18    |
| (none)                 | —      | `radius-xs`       | 2     |
| (none)                 | —      | `radius-lg`       | 10    |
| `--radius-full`        | 9999px | `radius-full`     | 9999  |


**Differences:**

- **Naming:** Project uses `radius-small` / `radius-medium` / `radius-large` / `radius-extra-large`; design kit uses **Tailwind-style** `radius-xs` / `radius-sm` / `radius-md` / `radius-lg` / `radius-xl` / `radius-2xl` / etc.
- **Values:** Our `--radius-small` (4) = kit’s `rounded-sm` (4) in **tw-border-radius**, but in **mode** the kit uses `radius-sm: 6`, `radius-md: 8`, `radius-lg: 10`, `radius-xl: 14`. So the kit’s **theme** radius scale is different from both our theme and the kit’s own `tw-border-radius`.

**Alignment options:**

- **Option A (recommended for naming only):** Keep our **values** (4, 8, 12, 16) but **rename** CSS variables to match the kit’s theme names where they’re semantically equivalent: e.g. introduce `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` (and optionally `--radius-xs`, `--radius-2xl`, …) and point them at our current values; then set `--radius` to one of them (e.g. `--radius-md`). Deprecate or alias `--radius-small` → `--radius-sm`, `--radius-medium` → `--radius-md`, `--radius-large` → `--radius-xl`, `--radius-extra-large` → `--radius-2xl` so existing usage keeps working.
- **Option B:** Change our values to match the kit’s theme scale (6, 8, 10, 14, 18, …). This changes the UI visually; only do this if you want pixel-perfect match to the default kit.

Recommendation: **Option A** — align **names** with the kit, keep **values** so the app look stays the same; in step 2 you can set Figma’s theme radius variables to these same values so the kit matches the app.

---

### 2.3 Spacing: naming only


| Project (base.css) | Value | Design kit                       |
| ------------------ | ----- | -------------------------------- |
| `--unit-x1`        | 4px   | `px-1`, `p-1`, `gap-1`, etc. = 4 |
| `--unit-x2`        | 8px   | `px-2`, `p-2` = 8                |
| `--unit-x3`        | 12px  | `px-3`, `p-3` = 12               |
| `--unit-x4`        | 16px  | `px-4`, `p-4` = 16               |
| …                  | …     | Same 4px scale                   |


Scale is the same; only **names** differ (`unit-x1` vs `p-1`/`px-1`). For alignment you can:

- Add **aliases** in `base.css`: e.g. `--p-1: var(--unit-x1);` … `--p-4: var(--unit-x4);` and use these where you want kit parity, and/or
- Gradually use Tailwind-style names in new code while keeping `--unit-x`* for backward compatibility.

No need to change values.

---

### 2.4 Base (primitive) colors

- **Design kit (tw-colors):** Keys like `orange-300`, `gray-500` (no prefix). Values are default Tailwind (e.g. `orange-300`: `#fdba74`).
- **Project (base.css):** Keys `--color-orange-300`, `--color-gray-dark-600`, etc. Values are **custom brand** (e.g. `--color-orange-300: #ffa24b`).

For **two-way sync** (code ↔ Figma):

- **Names:** The kit uses `orange-300`; we use `--color-orange-300`. In CSS you can’t drop the `--color-` prefix without risking clashes. So keep `--color-{name}` in code and in your export format map `color-orange-300` ↔ Figma `orange-300` when importing/exporting.
- **Values:** Keep our values; in step 2 you’ll push these into Figma (overwriting the kit’s defaults). No need to change our hex values to match the current JSON.

Optional: add a **comment or small mapping table** in `base.css` that says which Figma variable each token maps to (e.g. `--color-orange-300` → `tw-colors / orange-300`).

---

### 2.5 Typography

- **Project:** Custom scale with names like `--font-size-title-1`, `--font-size-body-3`, `--line-height-body-3`, `--font-family-body`.
- **Design kit (tw-font):** `size-xs` (12), `size-sm` (14), `size-base` (16), `size-lg` (18), `size-xl` (20), `leading-`*, `weight-`*, `family-sans` (Inter).

No need to rename our typography tokens to match `tw-font` unless you want to drive Figma text styles from the same scale. If you do, add aliases like `--size-sm: var(--font-size-body-3);` where the sizes align, and document the mapping.

---

## 3. Where project uses theme/radius/spacing (impact of renames)

- `**--radius`** is set in theme to `var(--radius-medium)`; components use `var(--radius)`, `var(--radius-small)`, `var(--radius-medium)`, `var(--radius-large)` in many places (see grep: transformation, filter, notifications, modal, table, semantic-tokens, etc.).
- `**--unit-x`*** is used in theme files and in modal.css, table.css, button.css, semantic-tokens.css.
- **Semantic tokens** like `--primary`, `--background`, `--text-primary`, `--surface-bg-sunken`, `--option-bg-hover` are used in UI components and modules; naming already matches the kit for the core set.

So any **rename** of radius or spacing will touch:

- [base.css](clickhouse-etl/ui/src/themes/base.css): definition of radius (and optionally spacing) tokens.
- [dark/theme.css](clickhouse-etl/ui/src/themes/dark/theme.css) and [light/theme.css](clickhouse-etl/ui/src/themes/light/theme.css): references to `--radius-`*, `--unit-x`*.
- [semantic-tokens.css](clickhouse-etl/ui/src/themes/semantic-tokens.css): `--table-radius`, `--table-row-radius`, and any spacing.
- All TSX/CSS that reference `--radius-small`, `--radius-medium`, `--radius-large` (and optionally `--unit-x*` if you rename those).

---

## 4. Recommended alignment plan (step 1 — codebase rework)

### Phase 1: Radius (align names with design kit, keep values)

1. In **base.css**:
  - Define Tailwind-style radius tokens that match the **design kit theme names** but keep **our** values:
    - `--radius-xs: 2px` (optional; kit has it).
    - `--radius-sm: 4px` (current `--radius-small`).
    - `--radius-md: 8px` (current `--radius-medium`).
    - `--radius-lg: 10px` (optional) or keep only up to xl.
    - `--radius-xl: 12px` (current `--radius-large`).
    - `--radius-2xl: 16px` (current `--radius-extra-large`).
    - `--radius-full: 9999px` (unchanged).
  - Keep `--radius-small`, `--radius-medium`, `--radius-large`, `--radius-extra-large` as **aliases** (e.g. `--radius-small: var(--radius-sm);`) so existing `var(--radius-small)` usage keeps working, or replace all usages and then remove the old names.
2. In **theme** files, set `--radius` to the new name, e.g. `--radius: var(--radius-md);`.
3. **Search and replace** (or do over a few PRs): `--radius-small` → `--radius-sm`, `--radius-medium` → `--radius-md`, `--radius-large` → `--radius-xl`, `--radius-extra-large` → `--radius-2xl` across:
  - themes (dark/theme.css, light/theme.css, semantic-tokens.css),
  - app/styles (modal.css, etc.),
  - all TSX that use these (transformation, filter, notifications, kafka, components/ui, etc.).
4. Update **semantic-tokens.css** `--table-radius` / `--table-row-radius` to use `--radius-xl` and `--radius-md` (or keep as-is if still using old names via aliases).

### Phase 2: Spacing (optional)

- Add in **base.css** aliases like `--p-1: var(--unit-x1);` … `--p-10: var(--unit-x10);` (and optionally `--px-2`, etc.) for kit parity. Use them in new code or in theme files where you want explicit Figma alignment. Leave `--unit-x`* in place everywhere else.

### Phase 3: Base colors and theme (documentation only for step 1)

- In **base.css**, add a short comment block or link to a mapping table: which `--color-`* token maps to which Figma collection/variable (e.g. `tw-colors` / `orange-300`). No code renames required; our `--color-`* names are fine for export/import mapping.

### Phase 4: Optional theme additions (for step 2)

- If you want the design kit’s sidebar/chart/semantic to match the app later, add in theme files:
  - `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, etc. (point at existing semantic colors as appropriate),
  - `--chart-1` … `--chart-5` (e.g. from your blue/orange palette),
  - `--semantic-background`, `--semantic-border`, `--semantic-foreground`,
  - `--stroke-width`, `--border-width` (from base or constants).

Then in step 2 you can push these into Figma’s `mode` so the kit’s components that use them get your styling.

---

## 5. Summary table: what to change


| Area                                          | Action                                                                                               | Scope                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Theme semantic names (primary, background, …) | No change                                                                                            | Already aligned                                                      |
| Radius **names**                              | Add `--radius-sm/md/xl/2xl` (and optionally xs, lg), keep our **values**; alias or replace old names | base.css, theme files, semantic-tokens.css, all TSX/CSS using radius |
| Radius **values**                             | Keep 4, 8, 12, 16                                                                                    | —                                                                    |
| Spacing                                       | Optional: add `--p-1`… aliases to `--unit-x`*                                                        | base.css (and optionally theme/styles)                               |
| Base colors                                   | Keep `--color-`*; document mapping to Figma keys                                                     | base.css comments or doc                                             |
| Typography                                    | Optional: add `--size-sm` etc. aliases                                                               | base.css                                                             |
| New theme vars (sidebar, chart, semantic)     | Optional: add for step 2                                                                             | dark/theme.css, light/theme.css                                      |


This gives you a codebase that matches the **design kit’s naming and structure** (radius, optional spacing/typography, optional extra theme vars) while keeping your **current look** (values). In step 2 you can export these token names and values and import them into the Figma design kit so the kit’s appearance matches your implementation.