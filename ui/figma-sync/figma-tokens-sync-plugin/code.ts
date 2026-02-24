/// <reference types="@figma/plugin-typings" />
/**
 * Figma plugin: sync token values from tokens-for-figma.json into Figma Variables.
 * - Matches collections and variables by name; maps modes by name.
 * - Update only (never deletes/renames). Optionally creates missing variables in existing collections.
 */

type Rgba = { r: number; g: number; b: number; a: number };
type TokenValue = Rgba | number | string;

type PayloadRepo = Record<string, Record<string, TokenValue> | Record<string, Record<string, TokenValue>>>;

type PayloadCollections = {
  collections: Array<{
    name: string;
    modes: string[];
    variables: Array<{
      name: string;
      values: Record<string, string | number>;
      type: "color" | "FLOAT" | "STRING" | "COLOR";
    }>;
  }>;
};

type Payload = PayloadRepo | PayloadCollections;

function isCollectionsFormat(p: Payload): p is PayloadCollections {
  return Array.isArray((p as PayloadCollections).collections);
}

/**
 * Generate all reasonable name variations for fuzzy matching.
 * Handles conversions between -, /, and space separators.
 */
function normalizeNameVariations(name: string): string[] {
  const variations = new Set<string>();
  variations.add(name);
  variations.add(name.replace(/-/g, " "));
  variations.add(name.replace(/-/g, "/"));
  variations.add(name.replace(/ /g, "-"));
  variations.add(name.replace(/ /g, "/"));
  variations.add(name.replace(/\//g, "-"));
  variations.add(name.replace(/\//g, " "));
  variations.add(name.toLowerCase());
  variations.add(name.toLowerCase().replace(/-/g, " "));
  variations.add(name.toLowerCase().replace(/-/g, "/"));
  variations.add(name.toLowerCase().replace(/\//g, "-"));
  variations.add(name.toLowerCase().replace(/\//g, " "));
  return Array.from(variations);
}

/**
 * Find item by name with fuzzy matching.
 * Tries exact match first, then variations with different separators.
 */
function findByNameFuzzy<T extends { name: string }>(items: T[], targetName: string): T | undefined {
  const exact = items.find(i => i.name === targetName);
  if (exact) return exact;
  
  const variations = normalizeNameVariations(targetName);
  for (const variant of variations) {
    const match = items.find(i => i.name === variant || i.name.toLowerCase() === variant.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

/**
 * Find variable by name with enhanced fuzzy matching.
 * Handles color naming patterns like "orange-100" vs "orange/100".
 */
function findVariableByNameFuzzy(
  varByName: Map<string, Variable>,
  targetName: string
): Variable | undefined {
  // Try exact match first
  const exact = varByName.get(targetName);
  if (exact) return exact;
  
  // Generate variations
  const variations = normalizeNameVariations(targetName);
  for (const variant of variations) {
    const match = varByName.get(variant);
    if (match) return match;
  }
  
  // Try case-insensitive search
  const lowerTarget = targetName.toLowerCase();
  for (const [name, variable] of varByName) {
    if (name.toLowerCase() === lowerTarget) return variable;
    // Also check with separator normalization
    const normalizedName = name.toLowerCase().replace(/[-/\s]/g, "_");
    const normalizedTarget = lowerTarget.replace(/[-/\s]/g, "_");
    if (normalizedName === normalizedTarget) return variable;
  }
  
  return undefined;
}

function normalizePayload(payload: Payload): Map<string, Map<string, Map<string, TokenValue>>> {
  const out = new Map<string, Map<string, Map<string, TokenValue>>>();

  if (isCollectionsFormat(payload)) {
    for (const col of payload.collections) {
      let modeMap = out.get(col.name);
      if (!modeMap) {
        modeMap = new Map();
        out.set(col.name, modeMap);
      }
      for (const v of col.variables) {
        for (const [modeName, rawVal] of Object.entries(v.values)) {
          let varMap = modeMap.get(modeName);
          if (!varMap) {
            varMap = new Map();
            modeMap.set(modeName, varMap);
          }
          const value = convertToFigmaValue(rawVal, v.type);
          varMap.set(v.name, value);
        }
      }
    }
    return out;
  }

  for (const [collName, collData] of Object.entries(payload)) {
    if (!collData || typeof collData !== "object") continue;
    let modeMap = out.get(collName);
    if (!modeMap) {
      modeMap = new Map();
      out.set(collName, modeMap);
    }
    const firstKey = Object.keys(collData)[0];
    if (!firstKey) continue;
    const firstVal = (collData as Record<string, unknown>)[firstKey];
    const isLeafValue = (x: unknown): boolean =>
      typeof x === "number" ||
      typeof x === "string" ||
      (typeof x === "object" && x !== null && "r" in x && "g" in x && "b" in x && "a" in x);
    const isSingleMode = isLeafValue(firstVal);
    if (isSingleMode) {
      const varMap = new Map<string, TokenValue>();
      for (const [varName, val] of Object.entries(collData as Record<string, TokenValue>)) {
        varMap.set(varName, val);
      }
      modeMap.set("default", varMap);
    } else {
      for (const [modeName, vars] of Object.entries(collData as Record<string, Record<string, TokenValue>>)) {
        if (!vars || typeof vars !== "object") continue;
        const varMap = new Map<string, TokenValue>();
        for (const [varName, val] of Object.entries(vars)) {
          varMap.set(varName, val);
        }
        modeMap.set(modeName, varMap);
      }
    }
  }
  return out;
}

function convertToFigmaValue(raw: string | number, type: string): TokenValue {
  if (type === "color" || type === "COLOR") {
    if (typeof raw === "string") return hexToRgba(raw);
    if (typeof raw === "object" && raw !== null && "r" in (raw as Rgba))
      return raw as Rgba;
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  if (type === "FLOAT" || typeof raw === "number") return Number(raw);
  if (typeof raw === "string" && /^\d+(\.\d+)?px?$/i.test(raw))
    return Number(raw.replace(/px?$/i, ""));
  return typeof raw === "string" ? raw : Number(raw);
}

function hexToRgba(hex: string): Rgba {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const a = m[2] ? parseInt(m[2], 16) / 255 : 1;
  return { r, g, b, a };
}

function isRgba(v: TokenValue): v is Rgba {
  return typeof v === "object" && v !== null && "r" in v && "g" in v && "b" in v && "a" in v;
}

function toFigmaValue(v: TokenValue): RGB | RGBA | number | string {
  if (isRgba(v)) return v;
  return v as number | string;
}

type VarDataType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
function inferVariableType(v: TokenValue): VarDataType {
  if (isRgba(v)) return "COLOR";
  if (typeof v === "number") return "FLOAT";
  return "STRING";
}

interface SyncResult {
  updated: string[];
  created: string[];
  missingCollections: string[];
  missingVariables: Array<{ collection: string; variable: string }>;
  errors: string[];
}

async function syncPayload(
  payload: Payload,
  options: { createMissingVariables: boolean }
): Promise<SyncResult> {
  const result: SyncResult = {
    updated: [],
    created: [],
    missingCollections: [],
    missingVariables: [],
    errors: [],
  };

  try {
    const normalized = normalizePayload(payload);
    console.log("[TokenSync] Normalized payload:", normalized.size, "collections");

    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    console.log("[TokenSync] Found", collections.length, "collections in file");

    if (collections.length === 0) {
      result.errors.push("No variable collections found in this Figma file. Create collections first.");
      return result;
    }

    const allVariables = await figma.variables.getLocalVariablesAsync();
    console.log("[TokenSync] Found", allVariables.length, "variables in file");

    for (const [collName, modeToVars] of normalized) {
      const collection = findByNameFuzzy(collections, collName);
      if (!collection) {
        result.missingCollections.push(collName);
        continue;
      }

      const modeNameToId = new Map<string, string>();
      for (const m of collection.modes) {
        modeNameToId.set(m.name, m.modeId);
        modeNameToId.set(m.name.toLowerCase(), m.modeId);
        modeNameToId.set(m.name.replace(/ /g, "-"), m.modeId);
        modeNameToId.set(m.name.replace(/ /g, "-").toLowerCase(), m.modeId);
      }
      const defaultModeId = collection.modes[0]?.modeId;
      if (collection.modes.length === 1) {
        modeNameToId.set("default", defaultModeId);
        modeNameToId.set("Mode 1", defaultModeId);
      }

      const variables = allVariables.filter((v) => v.variableCollectionId === collection.id);
      const varByName = new Map(variables.map((v) => [v.name, v]));

      for (const [modeName, varMap] of modeToVars) {
        let modeId = modeNameToId.get(modeName);
        if (!modeId) modeId = modeNameToId.get(modeName.toLowerCase());
        if (!modeId) modeId = modeNameToId.get(modeName.replace(/-/g, " "));
        if (!modeId) modeId = modeNameToId.get(modeName.replace(/-/g, " ").toLowerCase());
        if (!modeId && modeName === "default") modeId = defaultModeId;
        if (!modeId) {
          result.errors.push(`Collection "${collName}" (→ "${collection.name}"): mode "${modeName}" not found. Available: ${collection.modes.map(m => m.name).join(", ")}`);
          continue;
        }

        for (const [varName, value] of varMap) {
          // Use enhanced fuzzy matching to find variables
          let variable = findVariableByNameFuzzy(varByName, varName);
          const actualVarName = variable?.name ?? varName;
          
          if (!variable) {
            if (options.createMissingVariables) {
              try {
                const dataType = inferVariableType(value);
                const newVar = figma.variables.createVariable(varName, collection.id, dataType);
                variable = newVar;
                varByName.set(varName, newVar);
                result.created.push(`${collName}/${varName}`);
              } catch (e) {
                result.errors.push(`Create failed ${collName}/${varName}: ${String(e)}`);
                continue;
              }
            } else {
              result.missingVariables.push({ collection: collName, variable: varName });
              continue;
            }
          }

          if (!variable) continue;
          try {
            const figmaVal = toFigmaValue(value);
            variable.setValueForMode(modeId, figmaVal);
            if (!result.created.includes(`${collName}/${varName}`)) {
              result.updated.push(`${collName}/${actualVarName}`);
            }
          } catch (e) {
            result.errors.push(`Set value ${collName}/${actualVarName}: ${String(e)}`);
          }
        }
      }
    }
  } catch (e) {
    result.errors.push(`Sync error: ${String(e)}`);
    console.error("[TokenSync] Error:", e);
  }

  return result;
}

async function getFileInfo(): Promise<{ collections: Array<{ name: string; modes: string[] }> }> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  return {
    collections: collections.map(c => ({
      name: c.name,
      modes: c.modes.map(m => m.name)
    }))
  };
}

/** Serialize a Figma variable value to JSON-friendly form (for export). */
function serializeVariableValue(val: VariableValue): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") return val;
  if (typeof val === "object" && "r" in val && "g" in val && "b" in val) {
    return { r: (val as RGBA).r, g: (val as RGBA).g, b: (val as RGBA).b, a: (val as RGBA).a ?? 1 };
  }
  if (typeof val === "object" && "type" in val && (val as VariableAlias).type === "VARIABLE_ALIAS") {
    return { type: "VARIABLE_ALIAS", id: (val as VariableAlias).id };
  }
  return val;
}

type ExportCollection = {
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variables: Array<{
    id: string;
    name: string;
    resolvedType: string;
    valuesByMode: Record<string, unknown>;
  }>;
};

type RepoFormat = Record<string, Record<string, Record<string, unknown>>>;

async function exportVariablesFromFigma(): Promise<{
  collections: ExportCollection[];
  repo: RepoFormat;
}> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVariables = await figma.variables.getLocalVariablesAsync();
  const modeIdToNameByCollection = new Map<string, Map<string, string>>();

  const exportCollections: ExportCollection[] = [];
  const repo: RepoFormat = {};

  for (const coll of collections) {
    const modeIdToName = new Map<string, string>();
    for (const m of coll.modes) {
      modeIdToName.set(m.modeId, m.name);
    }
    modeIdToNameByCollection.set(coll.id, modeIdToName);

    const collVars = allVariables.filter((v) => v.variableCollectionId === coll.id);
    const variablesExport: ExportCollection["variables"] = [];
    const repoColl: Record<string, Record<string, unknown>> = {};

    for (const v of collVars) {
      const valuesByMode: Record<string, unknown> = {};
      for (const [modeId, rawVal] of Object.entries(v.valuesByMode)) {
        const modeName = modeIdToName.get(modeId) ?? modeId;
        valuesByMode[modeName] = serializeVariableValue(rawVal as VariableValue);
        let repoMode = repoColl[modeName];
        if (!repoMode) {
          repoMode = {};
          repoColl[modeName] = repoMode;
        }
        (repoMode as Record<string, unknown>)[v.name] = serializeVariableValue(rawVal as VariableValue);
      }
      variablesExport.push({
        id: v.id,
        name: v.name,
        resolvedType: v.resolvedType,
        valuesByMode,
      });
    }

    exportCollections.push({
      name: coll.name,
      modes: coll.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
      variables: variablesExport,
    });
    repo[coll.name] = repoColl;
  }

  return { collections: exportCollections, repo };
}

// --- Unused variables: collect used IDs from document and variable alias chains ---

function addVariableAliasIds(used: Set<string>, v: unknown): void {
  if (v == null) return;
  if (Array.isArray(v)) {
    v.forEach((a) => {
      if (a && typeof a === "object" && "id" in a) used.add((a as VariableAlias).id);
    });
  } else if (typeof v === "object" && v !== null && "id" in v) {
    used.add((v as VariableAlias).id);
  }
}

function collectBoundVariableIds(
  node: { boundVariables?: Record<string, unknown> },
  used: Set<string>
): void {
  const bv = node.boundVariables;
  if (!bv || typeof bv !== "object") return;
  for (const key of Object.keys(bv)) {
    const val = (bv as Record<string, unknown>)[key];
    if (key === "componentProperties" && val && typeof val === "object" && !Array.isArray(val)) {
      for (const propVal of Object.values(val as Record<string, unknown>)) {
        addVariableAliasIds(used, propVal);
      }
    } else {
      addVariableAliasIds(used, val);
    }
  }
}

/** Collect all variable IDs that are used: bound on nodes/styles or referenced as alias in variable values. */
async function collectUsedVariableIds(): Promise<Set<string>> {
  const used = new Set<string>();

  // 1. Variable alias chains: any variable whose value is an alias to another variable keeps that target "in use"
  const allVariables = await figma.variables.getLocalVariablesAsync();
  for (const variable of allVariables) {
    for (const val of Object.values(variable.valuesByMode)) {
      if (val && typeof val === "object" && "type" in val && (val as VariableAlias).type === "VARIABLE_ALIAS") {
        used.add((val as VariableAlias).id);
      }
    }
  }

  // 2. All nodes in the document (nodes may include PageNode; only those with boundVariables are relevant)
  const nodes = figma.root.findAll(() => true);
  for (const node of nodes) {
    try {
      if ("boundVariables" in node)
        collectBoundVariableIds(node as { boundVariables?: Record<string, unknown> }, used);
    } catch (_) {
      // Skip nodes that are not loaded (e.g. inside collapsed instance)
    }
  }

  // 3. Local styles (paint, text, effect, grid)
  const [paintStyles, textStyles, effectStyles, gridStyles] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalGridStylesAsync(),
  ]);
  for (const style of paintStyles) {
    const bv = (style as PaintStyle & { boundVariables?: Record<string, unknown> }).boundVariables;
    if (bv && typeof bv === "object") {
      addVariableAliasIds(used, bv.paints);
    }
  }
  for (const style of textStyles) {
    const bv = (style as TextStyle & { boundVariables?: Record<string, unknown> }).boundVariables;
    if (bv && typeof bv === "object") {
      for (const key of Object.keys(bv)) {
        addVariableAliasIds(used, (bv as Record<string, unknown>)[key]);
      }
    }
  }
  for (const style of effectStyles) {
    const bv = (style as EffectStyle & { boundVariables?: Record<string, unknown> }).boundVariables;
    if (bv && typeof bv === "object") {
      addVariableAliasIds(used, bv.effects);
    }
  }
  for (const style of gridStyles) {
    const bv = (style as GridStyle & { boundVariables?: Record<string, unknown> }).boundVariables;
    if (bv && typeof bv === "object") {
      addVariableAliasIds(used, bv.layoutGrids);
    }
  }

  return used;
}

type UnusedVariableEntry = { id: string; name: string; collectionName: string };

async function analyzeUnusedVariables(): Promise<{
  unused: UnusedVariableEntry[];
  totalVariables: number;
  usedCount: number;
}> {
  const [collections, allVariables, usedIds] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
    collectUsedVariableIds(),
  ]);
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const unused: UnusedVariableEntry[] = [];
  for (const v of allVariables) {
    if (v.remote) continue; // only consider local variables
    if (!usedIds.has(v.id)) {
      const coll = collectionById.get(v.variableCollectionId);
      unused.push({
        id: v.id,
        name: v.name,
        collectionName: coll ? coll.name : "(unknown)",
      });
    }
  }
  return {
    unused,
    totalVariables: allVariables.length,
    usedCount: usedIds.size,
  };
}

async function removeVariables(variableIds: string[]): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];
  for (const id of variableIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
        removed.push(id);
      } else {
        errors.push(`Variable ${id} not found (may already be removed).`);
      }
    } catch (e) {
      errors.push(`Failed to remove ${id}: ${String(e)}`);
    }
  }
  return { removed, errors };
}

figma.ui.onmessage = async (msg: {
  type: string;
  payload?: Payload;
  createMissingVariables?: boolean;
  variableIds?: string[];
}) => {
  console.log("[TokenSync] Received message:", msg.type);

  try {
    if (msg.type === "GET_FILE_INFO") {
      const info = await getFileInfo();
      figma.ui.postMessage({ type: "FILE_INFO", info });
      return;
    }

    if (msg.type === "EXPORT_VARIABLES") {
      try {
        figma.notify("Reading variables from file…");
        const { collections, repo } = await exportVariablesFromFigma();
        figma.notify(`Exported ${collections.length} collection(s)`);
        figma.ui.postMessage({
          type: "EXPORT_DATA",
          data: { collections, repo },
        });
      } catch (e) {
        figma.notify(`Export failed: ${String(e)}`, { error: true });
        figma.ui.postMessage({
          type: "EXPORT_DATA",
          error: String(e),
        });
      }
      return;
    }

    if (msg.type === "ANALYZE_UNUSED") {
      try {
        figma.notify("Analyzing variable usage…");
        const result = await analyzeUnusedVariables();
        figma.notify(`Found ${result.unused.length} unused variable(s)`);
        figma.ui.postMessage({ type: "UNUSED_ANALYSIS_RESULT", result });
      } catch (e) {
        figma.notify(`Analysis failed: ${String(e)}`, { error: true });
        figma.ui.postMessage({
          type: "UNUSED_ANALYSIS_RESULT",
          result: { unused: [], totalVariables: 0, usedCount: 0, error: String(e) },
        });
      }
      return;
    }

    if (msg.type === "REMOVE_UNUSED") {
      const variableIds = msg.variableIds ?? [];
      if (variableIds.length === 0) {
        figma.notify("No variables selected to remove.", { error: true });
        figma.ui.postMessage({
          type: "REMOVE_UNUSED_RESULT",
          result: { removed: [], errors: ["No variable IDs provided"] },
        });
        return;
      }
      try {
        figma.notify(`Removing ${variableIds.length} variable(s)…`);
        const result = await removeVariables(variableIds);
        figma.notify(`Removed ${result.removed.length} variable(s).`);
        figma.ui.postMessage({ type: "REMOVE_UNUSED_RESULT", result });
      } catch (e) {
        figma.notify(`Remove failed: ${String(e)}`, { error: true });
        figma.ui.postMessage({
          type: "REMOVE_UNUSED_RESULT",
          result: { removed: [], errors: [String(e)] },
        });
      }
      return;
    }

    if (msg.type === "PREVIEW" || msg.type === "APPLY") {
      if (!msg.payload) {
        figma.notify("No token payload provided.", { error: true });
        figma.ui.postMessage({ type: "RESULT", result: { updated: [], created: [], missingCollections: [], missingVariables: [], errors: ["No payload provided"] } });
        return;
      }

      let payload: Payload;
      try {
        payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
      } catch (e) {
        figma.notify("Invalid JSON", { error: true });
        figma.ui.postMessage({
          type: "RESULT",
          result: { updated: [], created: [], missingCollections: [], missingVariables: [], errors: [`Invalid JSON: ${String(e)}`] },
        });
        return;
      }

      const createMissing = Boolean(msg.createMissingVariables);
      
      if (msg.type === "PREVIEW") {
        figma.notify("Previewing...");
        const result = await syncPayload(payload, { createMissingVariables: false });
        console.log("[TokenSync] Preview result:", result);
        figma.ui.postMessage({ type: "RESULT", result, preview: true });
        figma.notify("Preview complete");
        return;
      }

      figma.notify("Syncing variables...");
      const result = await syncPayload(payload, { createMissingVariables: createMissing });
      console.log("[TokenSync] Sync result:", result);
      
      const summary = `Updated: ${result.updated.length}, Created: ${result.created.length}, Missing: ${result.missingVariables.length}`;
      if (result.errors.length > 0) {
        figma.notify(`Done with errors. ${summary}`, { error: true });
      } else {
        figma.notify(`Sync complete! ${summary}`);
      }
      
      figma.ui.postMessage({ type: "RESULT", result });
    }

    if (msg.type === "CLOSE") {
      figma.closePlugin();
    }
  } catch (e) {
    console.error("[TokenSync] Unhandled error:", e);
    figma.notify(`Error: ${String(e)}`, { error: true });
    figma.ui.postMessage({
      type: "RESULT",
      result: { updated: [], created: [], missingCollections: [], missingVariables: [], errors: [`Unhandled error: ${String(e)}`] },
    });
  }
};

figma.showUI(__html__, { width: 420, height: 880 });
figma.notify("Token Sync plugin loaded");
