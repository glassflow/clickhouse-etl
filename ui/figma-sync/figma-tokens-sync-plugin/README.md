# Token Sync — Figma plugin

This plugin runs **inside Figma** and lets you:

1. **Determine unused variables** in the current file (main use)
2. Sync token values from your app (e.g. `tokens-for-figma.json`) into Figma variables
3. Export variables from Figma to JSON

## Run the plugin in Figma to find unused variables

1. **Open your Figma file** (e.g. Design Library or any file that has local variables).

2. **Import the plugin**
   - In Figma: **Plugins** → **Development** → **Import plugin from manifest…**
   - Choose the **manifest.json** file in this folder:  
     `clickhouse-etl/ui/figma-sync/figma-tokens-sync-plugin/manifest.json`

3. **Run the plugin**
   - **Plugins** → **Development** → **Token Sync**  
     (or right‑click canvas → Plugins → Development → Token Sync)

4. **Analyze unused variables**
   - At the top of the plugin UI, click **Analyze unused variables**.
   - The plugin scans the **current file only** (all pages, layers, and local styles) and lists variables that are not bound to any node or style and are not referenced by other variables (e.g. aliases).
   - You can **Remove selected**, **Remove all unused**, or **Export list (JSON)** to save the report.

## What “unused” means

A variable is **used** if:

- It is bound on at least one layer (fill, stroke, text, component property, etc.), or
- It is bound on a local style (paint, text, effect, or grid), or
- Another variable’s value is an alias pointing to it.

Any local variable that is not used in any of these ways is listed as **unused** and is safe to remove for cleanup.

## Multi-file analysis

This plugin only sees the **currently open file**. To analyze **multiple Figma files** (e.g. all design files in the project) and get a single report, use the CLI script from the repo:

```bash
# From clickhouse-etl/ui
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEYS=key1,key2 npm run analyze-figma-unused
```

See [../analyze-unused-variables/README.md](../analyze-unused-variables/README.md) for details.

## Sync tokens from app to Figma

Use the **Sync tokens from app** section: load or paste `tokens-for-figma.json` (from `npm run sync-tokens -- --dry-run`), then **Preview** or **Apply** to update variable values in the current file. This does not delete variables; it only updates or creates variables in existing collections.

## Build (optional)

If you change `code.ts`, compile to update `code.js`:

```bash
cd clickhouse-etl/ui/figma-sync/figma-tokens-sync-plugin
npm install
npm run build
```

(Requires `@figma/plugin-typings` and TypeScript; if the project has no node_modules here, you can copy the built `code.js` from the root `figma-token-sync` plugin after building there.)
