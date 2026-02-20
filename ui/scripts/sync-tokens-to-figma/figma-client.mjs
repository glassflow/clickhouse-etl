/**
 * Figma Variables REST API client for syncing token values.
 * Requires FIGMA_ACCESS_TOKEN (with file_variables:read and file_variables:write)
 * and FIGMA_FILE_KEY. API is available for Enterprise plan with Full seats.
 *
 * @see https://developers.figma.com/docs/rest-api/variables
 * @see https://developers.figma.com/docs/rest-api/variables-endpoints
 */

const FIGMA_API_BASE = "https://api.figma.com/v1";

/**
 * Convert our parsed value to Figma API format.
 * - Already { r, g, b, a } -> as-is (COLOR)
 * - number -> as-is (FLOAT)
 * - string -> as-is (STRING)
 */
function toFigmaValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object" && "r" in value && "g" in value && "b" in value) {
    return { r: value.r, g: value.g, b: value.b, a: value.a ?? 1 };
  }
  return value;
}

/**
 * GET local variables from a file.
 * @returns { Promise<{ variables: Object, variableCollections: Object }> }
 */
export async function getLocalVariables(fileKey, accessToken) {
  const url = `${FIGMA_API_BASE}/files/${fileKey}/variables/local`;
  const res = await fetch(url, {
    headers: { "X-Figma-Token": accessToken },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API GET variables failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.message || "Figma API error");
  return data.meta || { variables: {}, variableCollections: {} };
}

/**
 * Build variableModeValues array for POST from our extracted payload and Figma's current variables.
 * Maps by collection name and variable name; matches mode names (e.g. "light-mode", "dark-mode").
 */
function buildVariableModeValues(payload, meta) {
  const { variables, variableCollections } = meta;
  const collectionByName = new Map();
  for (const [id, col] of Object.entries(variableCollections)) {
    collectionByName.set(col.name, { id, ...col });
  }

  const variableModeValues = [];

  // mode: two modes "light-mode" and "dark-mode"
  const modePayload = payload.mode;
  if (modePayload && (modePayload["light-mode"] || modePayload["dark-mode"])) {
    const col = collectionByName.get("mode");
    if (!col) {
      console.warn("Figma file has no variable collection named 'mode'; skipping mode variables.");
    } else {
      const modeNameToId = new Map(col.modes.map((m) => [m.name, m.modeId]));
      for (const [varName, value] of Object.entries(modePayload["light-mode"] || {})) {
        const variable = findVariableByName(variables, col.id, varName);
        const modeId = modeNameToId.get("light-mode");
        if (variable && modeId) {
          variableModeValues.push({
            variableId: variable.id,
            modeId,
            value: toFigmaValue(value),
          });
        }
      }
      for (const [varName, value] of Object.entries(modePayload["dark-mode"] || {})) {
        const variable = findVariableByName(variables, col.id, varName);
        const modeId = modeNameToId.get("dark-mode");
        if (variable && modeId) {
          variableModeValues.push({
            variableId: variable.id,
            modeId,
            value: toFigmaValue(value),
          });
        }
      }
    }
  }

  // Single-mode collections: tw-colors, rdx-colors, tw-border-radius, tw-gap, tw-space, tw-margin, tw-font
  const singleModeCollections = [
    "tw-colors",
    "rdx-colors",
    "tw-border-radius",
    "tw-gap",
    "tw-space",
    "tw-margin",
    "tw-font",
  ];
  for (const collName of singleModeCollections) {
    const values = payload[collName];
    if (!values || typeof values !== "object") continue;
    const col = collectionByName.get(collName);
    if (!col) {
      console.warn(`Figma file has no collection '${collName}'; skipping.`);
      continue;
    }
    const defaultModeId = col.defaultModeId || (col.modes && col.modes[0] && col.modes[0].modeId);
    if (!defaultModeId) continue;
    for (const [varName, value] of Object.entries(values)) {
      const variable = findVariableByName(variables, col.id, varName);
      if (variable) {
        variableModeValues.push({
          variableId: variable.id,
          modeId: defaultModeId,
          value: toFigmaValue(value),
        });
      }
    }
  }

  return variableModeValues;
}

function findVariableByName(variables, variableCollectionId, name) {
  for (const v of Object.values(variables)) {
    if (v.variableCollectionId === variableCollectionId && v.name === name) return v;
  }
  return null;
}

/**
 * POST variable mode values to Figma.
 * @param { string } fileKey
 * @param { string } accessToken
 * @param { Array<{ variableId, modeId, value }> } variableModeValues
 */
export async function postVariableModeValues(fileKey, accessToken, variableModeValues) {
  if (variableModeValues.length === 0) {
    console.warn("No variable mode values to post.");
    return { meta: {} };
  }
  const url = `${FIGMA_API_BASE}/files/${fileKey}/variables`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Figma-Token": accessToken,
    },
    body: JSON.stringify({ variableModeValues }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API POST variables failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.message || "Figma API error");
  return data;
}

/**
 * Full sync: get current variables, build variableModeValues from payload, POST.
 */
export async function syncPayloadToFigma(fileKey, accessToken, payload) {
  const meta = await getLocalVariables(fileKey, accessToken);
  const variableModeValues = buildVariableModeValues(payload, meta);
  const updated = await postVariableModeValues(fileKey, accessToken, variableModeValues);
  return { variableModeValuesCount: variableModeValues.length, ...updated };
}
