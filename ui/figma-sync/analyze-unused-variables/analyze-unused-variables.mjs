#!/usr/bin/env node
/**
 * Analyze unused variables across multiple Figma files.
 * Uses Figma REST API: GET file (document with boundVariables) + GET variables/local.
 * Outputs per-file and aggregated unused report (JSON and optional Markdown).
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=... node analyze-unused-variables.mjs [--output=report.json] [--format=json|md|both]
 *   FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEYS=key1,key2 node analyze-unused-variables.mjs
 *
 * File keys are read from FIGMA_FILE_KEYS (comma-separated) or from figma-file-keys.json in parent dir.
 * Token must have file_content:read and file_variables:read scopes.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getFileDocument, getLocalVariables } from "../sync-tokens-to-figma-via-api/figma-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = null;
  let format = "both"; // json | md | both
  for (const a of args) {
    if (a.startsWith("--output=")) outputPath = a.slice("--output=".length);
    else if (a.startsWith("--format=")) format = a.slice("--format=".length);
  }
  return { outputPath, format };
}

function getFileKeys() {
  const envKeys = process.env.FIGMA_FILE_KEYS;
  if (envKeys && envKeys.trim()) {
    return envKeys.split(",").map((k) => k.trim()).filter(Boolean);
  }
  const configPath = path.join(__dirname, "..", "figma-file-keys.json");
  if (fs.existsSync(configPath)) {
    const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const keys = data.fileKeys || data.file_keys || [];
    return Array.isArray(keys) ? keys : [];
  }
  return [];
}

/** Collect variable IDs from a value (single VariableAlias or array of VariableAlias). */
function addVariableAliasIds(used, v) {
  if (v == null) return;
  if (Array.isArray(v)) {
    for (const a of v) {
      if (a && typeof a === "object" && "id" in a) used.add(a.id);
    }
  } else if (typeof v === "object" && v !== null && "id" in v) {
    used.add(v.id);
  }
}

/** Walk node and children; collect all variable IDs from boundVariables. */
function collectBoundVariableIdsFromNode(node, used) {
  if (!node || typeof node !== "object") return;
  const bv = node.boundVariables;
  if (bv && typeof bv === "object") {
    for (const key of Object.keys(bv)) {
      const val = bv[key];
      if (key === "componentProperties" && val && typeof val === "object" && !Array.isArray(val)) {
        for (const propVal of Object.values(val)) addVariableAliasIds(used, propVal);
      } else {
        addVariableAliasIds(used, val);
      }
    }
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) collectBoundVariableIdsFromNode(child, used);
  }
}

/** Build used variable ID set from document tree and variables (alias targets). */
function collectUsedVariableIds(document, meta) {
  const used = new Set();
  const { variables = {} } = meta;

  // 1. Variable alias chains: alias targets are "used"
  for (const v of Object.values(variables)) {
    const valuesByMode = v.valuesByMode || v.values_by_mode || {};
    for (const val of Object.values(valuesByMode)) {
      if (val && typeof val === "object" && val.type === "VARIABLE_ALIAS" && val.id) {
        used.add(val.id);
      }
    }
  }

  // 2. All nodes in the document tree
  if (document) collectBoundVariableIdsFromNode(document, used);

  return used;
}

/** Compute unused variables for one file. */
function computeUnused(meta, usedIds) {
  const { variables = {}, variableCollections = {} } = meta;
  const collectionById = new Map(
    Object.entries(variableCollections).map(([id, c]) => [id, c])
  );
  const unused = [];
  for (const [id, v] of Object.entries(variables)) {
    if (v.remote) continue;
    if (!usedIds.has(id)) {
      const coll = collectionById.get(v.variableCollectionId);
      unused.push({
        id,
        name: v.name,
        collectionName: coll ? coll.name : "(unknown)",
      });
    }
  }
  const totalVariables = Object.values(variables).filter((x) => !x.remote).length;
  return { unused, totalVariables, usedCount: usedIds.size };
}

/** Aggregate: unused in every file (same collection + name in all files' unused lists). */
function unusedInAllFiles(perFileResults) {
  if (perFileResults.length === 0) return [];
  const key = (u) => `${u.collectionName}\t${u.name}`;
  const firstSet = new Map(perFileResults[0].unused.map((u) => [key(u), u]));
  for (let i = 1; i < perFileResults.length; i++) {
    const fileUnusedKeys = new Set(perFileResults[i].unused.map(key));
    for (const k of firstSet.keys()) {
      if (!fileUnusedKeys.has(k)) firstSet.delete(k);
    }
  }
  return Array.from(firstSet.values());
}

async function analyzeFile(fileKey, accessToken) {
  const [fileData, meta] = await Promise.all([
    getFileDocument(fileKey, accessToken),
    getLocalVariables(fileKey, accessToken),
  ]);
  const usedIds = collectUsedVariableIds(fileData.document, meta);
  const { unused, totalVariables, usedCount } = computeUnused(meta, usedIds);
  return {
    fileKey,
    fileName: fileData.name || fileKey,
    totalVariables,
    usedCount,
    unusedCount: unused.length,
    unused,
  };
}

function reportJson(report) {
  return JSON.stringify(report, null, 2);
}

function reportMarkdown(report) {
  const lines = [
    "# Figma unused variables report",
    "",
    `Analyzed ${report.perFile.length} file(s).`,
    "",
  ];
  if (report.unusedInAllFiles && report.unusedInAllFiles.length > 0) {
    lines.push("## Unused in all files");
    lines.push("");
    for (const u of report.unusedInAllFiles) {
      lines.push(`- **${u.collectionName}** / ${u.name} (\`${u.id}\`)`);
    }
    lines.push("");
  }
  for (const f of report.perFile) {
    lines.push(`## ${f.fileName || f.fileKey}`);
    lines.push("");
    lines.push(`- Total local variables: ${f.totalVariables}`);
    lines.push(`- Used: ${f.usedCount}`);
    lines.push(`- Unused: ${f.unusedCount}`);
    lines.push("");
    if (f.unused.length > 0) {
      for (const u of f.unused) {
        lines.push(`- **${u.collectionName}** / ${u.name}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main() {
  const { outputPath, format } = parseArgs();
  const fileKeys = getFileKeys();
  const token = process.env.FIGMA_ACCESS_TOKEN;

  if (!token) {
    console.error("FIGMA_ACCESS_TOKEN is required.");
    process.exit(1);
  }
  if (fileKeys.length === 0) {
    console.error(
      "No file keys. Set FIGMA_FILE_KEYS=key1,key2 or add fileKeys to figma-sync/figma-file-keys.json"
    );
    process.exit(1);
  }

  console.error(`Analyzing ${fileKeys.length} file(s)...`);
  const perFile = [];
  for (const fileKey of fileKeys) {
    try {
      const result = await analyzeFile(fileKey, token);
      perFile.push(result);
      console.error(
        `  ${result.fileName || fileKey}: ${result.unusedCount} unused of ${result.totalVariables} local variable(s)`
      );
    } catch (e) {
      console.error(`  ${fileKey}: Error - ${e.message}`);
      perFile.push({
        fileKey,
        fileName: fileKey,
        error: e.message,
        totalVariables: 0,
        usedCount: 0,
        unusedCount: 0,
        unused: [],
      });
    }
  }

  const successful = perFile.filter((f) => !f.error);
  const unusedInAll =
    successful.length > 0 ? unusedInAllFiles(successful.map((f) => ({ unused: f.unused }))) : [];

  const report = {
    summary: {
      filesAnalyzed: fileKeys.length,
      filesWithErrors: perFile.filter((f) => f.error).length,
      totalUnusedInAllFiles: unusedInAll.length,
    },
    perFile,
    unusedInAllFiles: unusedInAll,
  };

  const outJson = reportJson(report);
  const outMd = reportMarkdown(report);

  if (outputPath) {
    const ext = path.extname(outputPath).toLowerCase();
    const writeMd = ext === ".md" || format === "md";
    fs.writeFileSync(outputPath, writeMd ? outMd : outJson, "utf8");
    console.error(`Report written to ${outputPath}`);
  }

  if (format === "md") {
    console.log(outMd);
  } else {
    console.log(outJson);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
