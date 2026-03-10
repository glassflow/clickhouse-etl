# Analyze unused Figma variables (multi-file)

This script analyzes **all** Figma design files in the project and reports which variables are not used in any node or variable alias. Use it to clean up Figma variables and then align the UI implementation (fewer design tokens).

## Requirements

- **Figma plan:** Enterprise (same as Variables API).
- **Token scopes:** `file_content:read` and `file_variables:read` (read-only; no write).
- **File keys:** List of Figma file keys to analyze (Design Library and any other design files).

## Quick start

```bash
# From repo root (clickhouse-etl/ui)
FIGMA_ACCESS_TOKEN=figd_xxx FIGMA_FILE_KEYS=key1,key2 npm run analyze-figma-unused

# Or add file keys to figma-sync/figma-file-keys.json ("fileKeys": ["key1", "key2"])
FIGMA_ACCESS_TOKEN=figd_xxx npm run analyze-figma-unused

# Write report to a file (JSON by default; use .md for Markdown)
FIGMA_ACCESS_TOKEN=... npm run analyze-figma-unused -- --output=./figma-unused-report.json
FIGMA_ACCESS_TOKEN=... npm run analyze-figma-unused -- --output=./figma-unused-report.md --format=md
```

## File keys

- **Environment:** `FIGMA_FILE_KEYS=key1,key2` (comma-separated). Use for one-off runs without committing keys.
- **Config file:** `figma-sync/figma-file-keys.json` with a `fileKeys` array. Add your Design Library file key and any other design files (e.g. from [sync-tokens-to-figma-via-api/README.md](../sync-tokens-to-figma-via-api/README.md) or `.cursor/figma-mapping.mdc`).

## Output

- **Per file:** file key, file name, total local variables, used count, unused list (id, name, collection).
- **Unused in all files:** variables (by collection + name) that appear in every file’s unused list — good candidates for project-wide cleanup.
- **Formats:** JSON (default, machine-readable for UI alignment) and/or Markdown (`--format=md` or `--output=report.md`).

## How “used” is computed

- **Nodes:** Every node in the file document is walked; variable IDs from `boundVariables` (fills, strokes, component properties, etc.) are collected.
- **Variable aliases:** Any variable whose value is a `VARIABLE_ALIAS` to another variable counts that target as used.
- **Styles:** The Figma REST file response does not include local styles with bound variables. “Used” is therefore node- and alias-based only. The in-editor plugin also considers paint/text/effect/grid styles; results may differ slightly for style-only usage.

## See also

- [sync-tokens-to-figma-via-api/README.md](../sync-tokens-to-figma-via-api/README.md) — pushing token values from the app to Figma.
- Token Sync plugin (in Figma: Plugins → Token Sync) — single-file unused analysis and removal, plus “Export list” for the current file’s unused variables as JSON.
