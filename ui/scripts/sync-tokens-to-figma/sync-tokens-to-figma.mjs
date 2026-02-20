#!/usr/bin/env node
/**
 * Sync design tokens from the app theme CSS to Figma variables.
 *
 * 1. Extracts and resolves tokens from src/themes (base.css, semantic-tokens, dark/light theme).
 * 2. Optionally pushes values to Figma via the Variables REST API.
 *
 * Usage:
 *   node sync-tokens-to-figma.mjs [--dry-run] [--output=path.json]
 *   FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... node sync-tokens-to-figma.mjs
 *
 * Options:
 *   --dry-run     Only extract tokens and write JSON; do not call Figma API.
 *   --output=FILE Write extracted payload to FILE (default: tokens-for-figma.json in script dir).
 *
 * Environment:
 *   FIGMA_ACCESS_TOKEN  Personal access token with file_variables:read and file_variables:write.
 *   FIGMA_FILE_KEY      File key from the Figma file URL (e.g. n0LilXaAc6TuTn6g1qwOGz).
 *
 * Requirements:
 *   Figma Enterprise plan; Full seat or admin; edit access to the file.
 *   @see DESIGN-KIT-TOKEN-ALIGNMENT.md and FIGMA-SYNC-INSTRUCTIONS.md in src/themes.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractTokens } from "./extract-tokens.mjs";
import { syncPayloadToFigma } from "./figma-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let outputPath = path.join(__dirname, "tokens-for-figma.json");
  for (const a of args) {
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--output=")) outputPath = a.slice("--output=".length);
  }
  return { dryRun, outputPath };
}

async function main() {
  const { dryRun, outputPath } = parseArgs();

  console.log("Extracting tokens from theme CSS...");
  const payload = extractTokens();

  const outDir = path.dirname(outputPath);
  if (outDir && outDir !== ".") fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote payload to ${outputPath}`);

  if (dryRun) {
    console.log("Dry run: not calling Figma API.");
    return;
  }

  const token = process.env.FIGMA_ACCESS_TOKEN;
  const fileKey = process.env.FIGMA_FILE_KEY;
  if (!token || !fileKey) {
    console.warn(
      "FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY are not set. To push to Figma, set them and run again."
    );
    return;
  }

  console.log("Pushing variable values to Figma...");
  const result = await syncPayloadToFigma(fileKey, token, payload);
  console.log(`Done. Updated ${result.variableModeValuesCount} variable mode value(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
