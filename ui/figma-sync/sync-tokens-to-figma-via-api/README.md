# Sync app tokens to Figma

This script extracts design token values from the app theme CSS and optionally pushes them to Figma variables via the [Figma Variables REST API](https://developers.figma.com/docs/rest-api/variables), so the Design Library stays aligned with the app.

## Quick start

```bash
# From repo root (clickhouse-etl/ui)
npm run sync-tokens

# Extract only (no API call), write JSON to default path
npm run sync-tokens -- --dry-run

# Extract and write to a custom file
npm run sync-tokens -- --dry-run --output=./build/tokens.json
```

## Pushing to Figma

1. **Requirements**
   - **Figma plan:** Enterprise.
   - **Account:** Full seat or admin (not guest).
   - **File:** Edit access to the Design Library file.
   - **Token:** Personal access token with scopes `file_variables:read` and `file_variables:write`.

2. **Get a personal access token**
   - Figma → Settings → Account → Personal access tokens → Create new token.
   - Enable **File variables: Read** and **File variables: Write**.

3. **Get the file key**
   - Open the Design Library in Figma; the URL is like  
     `https://www.figma.com/design/n0LilXaAc6TuTn6g1qwOGz/Design-Library`  
   - The file key is `n0LilXaAc6TuTn6g1qwOGz`.

4. **Run the sync**
   ```bash
   FIGMA_ACCESS_TOKEN=figd_xxx FIGMA_FILE_KEY=n0LilXaAc6TuTn6g1qwOGz npm run sync-tokens
   ```
   Or set the env vars in `.env` (do not commit `.env`) and run `npm run sync-tokens`.

## What it does

1. **Extract**
   Reads `src/themes/base.css` and `src/themes/theme.css` (dark-only; `semantic-tokens.css` and the separate `dark/` / `light/` theme files were removed in the styling refactor); resolves `var()` references; produces a payload keyed by Figma collection: `mode` (dark-mode only), `tw-colors`, `rdx-colors`, `tw-border-radius`, `tw-gap`, `tw-space`, `tw-margin`, `tw-font`. Primitive colors in `tw-colors` come from `base.css` only (e.g. `--color-*`); the old `--color-button-gradient-*` tokens were removed in favor of semantic `--button-primary-gradient-*` in theme (see button tokens below).

2. **Write JSON**  
   Always writes the extracted payload to a JSON file (default: `scripts/sync-tokens-to-figma/tokens-for-figma.json`). Use `--dry-run` to only extract and write, without calling Figma.

3. **Push (optional)**  
   If `FIGMA_ACCESS_TOKEN` and `FIGMA_FILE_KEY` are set and you do not pass `--dry-run`, the script calls `GET /v1/files/:file_key/variables/local` to read existing variable collections and variables, builds a `variableModeValues` array from the payload (matching by collection name and variable name), and calls `POST /v1/files/:file_key/variables` to update values. Only variables that exist in the file and are present in the payload are updated.

## Mapping

- **mode:** Variable names and mode name (`dark-mode`) must match the Design Library. The app is dark-only; there is no `light-mode` output. Values: colors as `{ r, g, b, a }` (0–1), numbers for radius/stroke/border-width.
- **tw-colors / rdx-colors:** Keys are the Figma variable name (e.g. `orange-300`). Same values are applied to both collections.
- **tw-border-radius:** Keys like `rounded-sm`, `rounded-md`; values in px (number).
- **tw-gap, tw-space, tw-margin:** Keys like `gap-1`, `space-x-1`, `m-1`; values in px (number). Only 1–10 are exported.
- **tw-font:** Keys like `size-xs`, `leading-3`, `weight-normal`, `family-sans`; values as number or string.

Full mapping and rationale: see `src/themes/DESIGN-KIT-TOKEN-ALIGNMENT.md` and `src/themes/FIGMA-SYNC-INSTRUCTIONS.md`.

## Button tokens (manual Figma sync)

To get a JSON file with **all button-related tokens** (variants, sizes, colors, spacing) for manually applying them in Figma:

```bash
npm run extract-button-tokens
```

This writes `scripts/sync-tokens-to-figma/button-tokens-for-figma.json` with:

- **dark-mode**: Resolved variables (e.g. `primary`, `button-primary-bg`, `button-primary-gradient-start`, `button-primary-gradient-end`, `button-primary-gradient-disabled-start`, `button-primary-gradient-disabled-end`, `radius-md`, `unit-x2`) with values in Figma-friendly form (colors as `{ r, g, b, a }`, sizes in px). Naming follows `--button-{variant}-{property}` (e.g. gradient uses `button-primary-gradient-start` / `button-primary-gradient-end`, not the old `color-button-gradient-from/to`).
- **sizes**: Button size spec (sm: 32px height, default: 36px, lg: 40px, icon: 36px) and padding/gap for layout in Figma.
- **variants** / **sizes**: List of app button variant and size names for reference.

Use this file together with `docs/design/FIGMA_TOKEN_REFERENCE.md` to set Figma variables and component properties so the Design Library button matches the app.

## Troubleshooting

- **403 / Limited by Figma plan:** Variables API requires Enterprise.
- **403 / Invalid scope:** Token must have `file_variables:read` and `file_variables:write`.
- **404:** Check that `FIGMA_FILE_KEY` is the file key from the design file URL, not a node ID.
- **Variables not updating:** Ensure variable and collection names in Figma match the design kit (e.g. collection `mode` with mode `dark-mode`). The script only updates variables that already exist in the file.
