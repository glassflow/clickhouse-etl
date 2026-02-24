"use strict";
/// <reference types="@figma/plugin-typings" />
/**
 * Figma plugin: sync token values from tokens-for-figma.json into Figma Variables.
 * - Matches collections and variables by name; maps modes by name.
 * - Update only (never deletes/renames). Optionally creates missing variables in existing collections.
 */
function isCollectionsFormat(p) {
    return Array.isArray(p.collections);
}
/**
 * Generate all reasonable name variations for fuzzy matching.
 * Handles conversions between -, /, and space separators.
 */
function normalizeNameVariations(name) {
    const variations = new Set();
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
function findByNameFuzzy(items, targetName) {
    const exact = items.find(i => i.name === targetName);
    if (exact)
        return exact;
    const variations = normalizeNameVariations(targetName);
    for (const variant of variations) {
        const match = items.find(i => i.name === variant || i.name.toLowerCase() === variant.toLowerCase());
        if (match)
            return match;
    }
    return undefined;
}
/**
 * Find variable by name with enhanced fuzzy matching.
 * Handles color naming patterns like "orange-100" vs "orange/100".
 */
function findVariableByNameFuzzy(varByName, targetName) {
    // Try exact match first
    const exact = varByName.get(targetName);
    if (exact)
        return exact;
    // Generate variations
    const variations = normalizeNameVariations(targetName);
    for (const variant of variations) {
        const match = varByName.get(variant);
        if (match)
            return match;
    }
    // Try case-insensitive search
    const lowerTarget = targetName.toLowerCase();
    for (const [name, variable] of varByName) {
        if (name.toLowerCase() === lowerTarget)
            return variable;
        // Also check with separator normalization
        const normalizedName = name.toLowerCase().replace(/[-/\s]/g, "_");
        const normalizedTarget = lowerTarget.replace(/[-/\s]/g, "_");
        if (normalizedName === normalizedTarget)
            return variable;
    }
    return undefined;
}
function normalizePayload(payload) {
    const out = new Map();
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
        if (!collData || typeof collData !== "object")
            continue;
        let modeMap = out.get(collName);
        if (!modeMap) {
            modeMap = new Map();
            out.set(collName, modeMap);
        }
        const firstKey = Object.keys(collData)[0];
        if (!firstKey)
            continue;
        const firstVal = collData[firstKey];
        const isLeafValue = (x) => typeof x === "number" ||
            typeof x === "string" ||
            (typeof x === "object" && x !== null && "r" in x && "g" in x && "b" in x && "a" in x);
        const isSingleMode = isLeafValue(firstVal);
        if (isSingleMode) {
            const varMap = new Map();
            for (const [varName, val] of Object.entries(collData)) {
                varMap.set(varName, val);
            }
            modeMap.set("default", varMap);
        }
        else {
            for (const [modeName, vars] of Object.entries(collData)) {
                if (!vars || typeof vars !== "object")
                    continue;
                const varMap = new Map();
                for (const [varName, val] of Object.entries(vars)) {
                    varMap.set(varName, val);
                }
                modeMap.set(modeName, varMap);
            }
        }
    }
    return out;
}
function convertToFigmaValue(raw, type) {
    if (type === "color" || type === "COLOR") {
        if (typeof raw === "string")
            return hexToRgba(raw);
        if (typeof raw === "object" && raw !== null && "r" in raw)
            return raw;
        return { r: 0, g: 0, b: 0, a: 1 };
    }
    if (type === "FLOAT" || typeof raw === "number")
        return Number(raw);
    if (typeof raw === "string" && /^\d+(\.\d+)?px?$/i.test(raw))
        return Number(raw.replace(/px?$/i, ""));
    return typeof raw === "string" ? raw : Number(raw);
}
function hexToRgba(hex) {
    const m = hex.replace(/^#/, "").match(/^([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (!m)
        return { r: 0, g: 0, b: 0, a: 1 };
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    const a = m[2] ? parseInt(m[2], 16) / 255 : 1;
    return { r, g, b, a };
}
function isRgba(v) {
    return typeof v === "object" && v !== null && "r" in v && "g" in v && "b" in v && "a" in v;
}
function toFigmaValue(v) {
    if (isRgba(v))
        return v;
    return v;
}
function inferVariableType(v) {
    if (isRgba(v))
        return "COLOR";
    if (typeof v === "number")
        return "FLOAT";
    return "STRING";
}
async function syncPayload(payload, options) {
    var _a, _b;
    const result = {
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
            const modeNameToId = new Map();
            for (const m of collection.modes) {
                modeNameToId.set(m.name, m.modeId);
                modeNameToId.set(m.name.toLowerCase(), m.modeId);
                modeNameToId.set(m.name.replace(/ /g, "-"), m.modeId);
                modeNameToId.set(m.name.replace(/ /g, "-").toLowerCase(), m.modeId);
            }
            const defaultModeId = (_a = collection.modes[0]) === null || _a === void 0 ? void 0 : _a.modeId;
            if (collection.modes.length === 1) {
                modeNameToId.set("default", defaultModeId);
                modeNameToId.set("Mode 1", defaultModeId);
            }
            const variables = allVariables.filter((v) => v.variableCollectionId === collection.id);
            const varByName = new Map(variables.map((v) => [v.name, v]));
            for (const [modeName, varMap] of modeToVars) {
                let modeId = modeNameToId.get(modeName);
                if (!modeId)
                    modeId = modeNameToId.get(modeName.toLowerCase());
                if (!modeId)
                    modeId = modeNameToId.get(modeName.replace(/-/g, " "));
                if (!modeId)
                    modeId = modeNameToId.get(modeName.replace(/-/g, " ").toLowerCase());
                if (!modeId && modeName === "default")
                    modeId = defaultModeId;
                if (!modeId) {
                    result.errors.push(`Collection "${collName}" (→ "${collection.name}"): mode "${modeName}" not found. Available: ${collection.modes.map(m => m.name).join(", ")}`);
                    continue;
                }
                for (const [varName, value] of varMap) {
                    // Use enhanced fuzzy matching to find variables
                    let variable = findVariableByNameFuzzy(varByName, varName);
                    const actualVarName = (_b = variable === null || variable === void 0 ? void 0 : variable.name) !== null && _b !== void 0 ? _b : varName;
                    if (!variable) {
                        if (options.createMissingVariables) {
                            try {
                                const dataType = inferVariableType(value);
                                const newVar = figma.variables.createVariable(varName, collection.id, dataType);
                                variable = newVar;
                                varByName.set(varName, newVar);
                                result.created.push(`${collName}/${varName}`);
                            }
                            catch (e) {
                                result.errors.push(`Create failed ${collName}/${varName}: ${String(e)}`);
                                continue;
                            }
                        }
                        else {
                            result.missingVariables.push({ collection: collName, variable: varName });
                            continue;
                        }
                    }
                    if (!variable)
                        continue;
                    try {
                        const figmaVal = toFigmaValue(value);
                        variable.setValueForMode(modeId, figmaVal);
                        if (!result.created.includes(`${collName}/${varName}`)) {
                            result.updated.push(`${collName}/${actualVarName}`);
                        }
                    }
                    catch (e) {
                        result.errors.push(`Set value ${collName}/${actualVarName}: ${String(e)}`);
                    }
                }
            }
        }
    }
    catch (e) {
        result.errors.push(`Sync error: ${String(e)}`);
        console.error("[TokenSync] Error:", e);
    }
    return result;
}
async function getFileInfo() {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    return {
        collections: collections.map(c => ({
            name: c.name,
            modes: c.modes.map(m => m.name)
        }))
    };
}
/** Serialize a Figma variable value to JSON-friendly form (for export). */
function serializeVariableValue(val) {
    var _a;
    if (val === null || val === undefined)
        return null;
    if (typeof val === "boolean" || typeof val === "number" || typeof val === "string")
        return val;
    if (typeof val === "object" && "r" in val && "g" in val && "b" in val) {
        return { r: val.r, g: val.g, b: val.b, a: (_a = val.a) !== null && _a !== void 0 ? _a : 1 };
    }
    if (typeof val === "object" && "type" in val && val.type === "VARIABLE_ALIAS") {
        return { type: "VARIABLE_ALIAS", id: val.id };
    }
    return val;
}
async function exportVariablesFromFigma() {
    var _a;
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const allVariables = await figma.variables.getLocalVariablesAsync();
    const modeIdToNameByCollection = new Map();
    const exportCollections = [];
    const repo = {};
    for (const coll of collections) {
        const modeIdToName = new Map();
        for (const m of coll.modes) {
            modeIdToName.set(m.modeId, m.name);
        }
        modeIdToNameByCollection.set(coll.id, modeIdToName);
        const collVars = allVariables.filter((v) => v.variableCollectionId === coll.id);
        const variablesExport = [];
        const repoColl = {};
        for (const v of collVars) {
            const valuesByMode = {};
            for (const [modeId, rawVal] of Object.entries(v.valuesByMode)) {
                const modeName = (_a = modeIdToName.get(modeId)) !== null && _a !== void 0 ? _a : modeId;
                valuesByMode[modeName] = serializeVariableValue(rawVal);
                let repoMode = repoColl[modeName];
                if (!repoMode) {
                    repoMode = {};
                    repoColl[modeName] = repoMode;
                }
                repoMode[v.name] = serializeVariableValue(rawVal);
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
function addVariableAliasIds(used, v) {
    if (v == null)
        return;
    if (Array.isArray(v)) {
        v.forEach((a) => {
            if (a && typeof a === "object" && "id" in a)
                used.add(a.id);
        });
    }
    else if (typeof v === "object" && v !== null && "id" in v) {
        used.add(v.id);
    }
}
function collectBoundVariableIds(node, used) {
    const bv = node.boundVariables;
    if (!bv || typeof bv !== "object")
        return;
    for (const key of Object.keys(bv)) {
        const val = bv[key];
        if (key === "componentProperties" && val && typeof val === "object" && !Array.isArray(val)) {
            for (const propVal of Object.values(val)) {
                addVariableAliasIds(used, propVal);
            }
        }
        else {
            addVariableAliasIds(used, val);
        }
    }
}
/** Collect all variable IDs that are used: bound on nodes/styles or referenced as alias in variable values. */
async function collectUsedVariableIds() {
    const used = new Set();
    // 1. Variable alias chains: any variable whose value is an alias to another variable keeps that target "in use"
    const allVariables = await figma.variables.getLocalVariablesAsync();
    for (const variable of allVariables) {
        for (const val of Object.values(variable.valuesByMode)) {
            if (val && typeof val === "object" && "type" in val && val.type === "VARIABLE_ALIAS") {
                used.add(val.id);
            }
        }
    }
    // 2. All nodes in the document (nodes may include PageNode; only those with boundVariables are relevant)
    const nodes = figma.root.findAll(() => true);
    for (const node of nodes) {
        try {
            if ("boundVariables" in node)
                collectBoundVariableIds(node, used);
        }
        catch (_) {
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
        const bv = style.boundVariables;
        if (bv && typeof bv === "object") {
            addVariableAliasIds(used, bv.paints);
        }
    }
    for (const style of textStyles) {
        const bv = style.boundVariables;
        if (bv && typeof bv === "object") {
            for (const key of Object.keys(bv)) {
                addVariableAliasIds(used, bv[key]);
            }
        }
    }
    for (const style of effectStyles) {
        const bv = style.boundVariables;
        if (bv && typeof bv === "object") {
            addVariableAliasIds(used, bv.effects);
        }
    }
    for (const style of gridStyles) {
        const bv = style.boundVariables;
        if (bv && typeof bv === "object") {
            addVariableAliasIds(used, bv.layoutGrids);
        }
    }
    return used;
}
async function analyzeUnusedVariables() {
    const [collections, allVariables, usedIds] = await Promise.all([
        figma.variables.getLocalVariableCollectionsAsync(),
        figma.variables.getLocalVariablesAsync(),
        collectUsedVariableIds(),
    ]);
    const collectionById = new Map(collections.map((c) => [c.id, c]));
    const unused = [];
    for (const v of allVariables) {
        if (v.remote)
            continue; // only consider local variables
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
async function removeVariables(variableIds) {
    const removed = [];
    const errors = [];
    for (const id of variableIds) {
        try {
            const variable = await figma.variables.getVariableByIdAsync(id);
            if (variable) {
                variable.remove();
                removed.push(id);
            }
            else {
                errors.push(`Variable ${id} not found (may already be removed).`);
            }
        }
        catch (e) {
            errors.push(`Failed to remove ${id}: ${String(e)}`);
        }
    }
    return { removed, errors };
}
figma.ui.onmessage = async (msg) => {
    var _a;
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
            }
            catch (e) {
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
            }
            catch (e) {
                figma.notify(`Analysis failed: ${String(e)}`, { error: true });
                figma.ui.postMessage({
                    type: "UNUSED_ANALYSIS_RESULT",
                    result: { unused: [], totalVariables: 0, usedCount: 0, error: String(e) },
                });
            }
            return;
        }
        if (msg.type === "REMOVE_UNUSED") {
            const variableIds = (_a = msg.variableIds) !== null && _a !== void 0 ? _a : [];
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
            }
            catch (e) {
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
            let payload;
            try {
                payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
            }
            catch (e) {
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
            }
            else {
                figma.notify(`Sync complete! ${summary}`);
            }
            figma.ui.postMessage({ type: "RESULT", result });
        }
        if (msg.type === "CLOSE") {
            figma.closePlugin();
        }
    }
    catch (e) {
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
