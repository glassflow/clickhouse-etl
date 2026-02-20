/**
 * Extracts and resolves design tokens from theme CSS for Figma sync.
 * Reads base.css, semantic-tokens.css, and theme files; resolves var() references;
 * outputs a structure keyed by Figma collection and variable name.
 *
 * Usage: called by sync-tokens-to-figma.mjs; can be run standalone for dry-run.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = path.resolve(__dirname, "../../src/themes");

const REM_BASE_PX = 16;

/**
 * Extract custom properties from CSS content for a given selector.
 * Returns Map of variable name (without --) -> raw value string.
 */
function extractVarsFromBlock(cssContent, selectorPattern) {
  const map = new Map();
  const selectorRegex = new RegExp(
    `(${selectorPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*\\{([^}]*)\\}`,
    "gs"
  );
  const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let blockMatch;
  while ((blockMatch = selectorRegex.exec(cssContent)) !== null) {
    const block = blockMatch[2];
    let varMatch;
    while ((varMatch = varRegex.exec(block)) !== null) {
      map.set(varMatch[1], varMatch[2].trim());
    }
  }
  return map;
}

/**
 * Extract all --var: value from content (any selector). Used for :root-only files.
 */
function extractRootVars(cssContent) {
  const map = new Map();
  const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = varRegex.exec(cssContent)) !== null) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

/**
 * Resolve var(--name) in a value string using the provided variables map.
 * Single pass; does not resolve nested var() in the substituted value.
 */
function resolveValue(valueStr, vars) {
  return valueStr.replace(/var\(\s*--([a-zA-Z0-9-]+)\s*\)/g, (_, name) => {
    const v = vars.get(name);
    return v !== undefined ? v : valueStr;
  });
}

/**
 * Fully resolve all variables: iterate until no more var() left or max iterations.
 */
function resolveAllVars(vars) {
  const out = new Map(vars);
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;
    for (const [name, value] of out) {
      const resolved = resolveValue(value, out);
      if (resolved !== value) {
        out.set(name, resolved);
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Parse a value to a primitive for Figma: number (for px), { r, g, b, a } for hex, string otherwise.
 */
function parseValue(raw) {
  const s = raw.trim();
  if (/^#([0-9a-fA-F]{8})$/.test(s)) {
    const hex = s.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }
  if (/^#([0-9a-fA-F]{6})$/.test(s)) {
    const hex = s.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: 1,
    };
  }
  const pxMatch = s.match(/^([\d.]+)px$/);
  if (pxMatch) return Number(pxMatch[1]);
  const remMatch = s.match(/^([\d.]+)rem$/);
  if (remMatch) return Number((parseFloat(remMatch[1]) * REM_BASE_PX).toFixed(4));
  const numMatch = s.match(/^([\d.]+)$/);
  if (numMatch) return Number(numMatch[1]);
  return s;
}

/**
 * Load and merge variables for a theme (dark or light).
 */
function loadThemeVars(theme) {
  const basePath = path.join(THEMES_DIR, "base.css");
  const baseCss = fs.readFileSync(basePath, "utf8");
  const baseVars = extractRootVars(baseCss);

  const semanticPath = path.join(THEMES_DIR, "semantic-tokens.css");
  const semanticCss = fs.readFileSync(semanticPath, "utf8");
  const semanticVars = extractVarsFromBlock(
    semanticCss,
    `[data-theme='${theme}']`
  );

  const themePath = path.join(THEMES_DIR, theme, "theme.css");
  const themeCss = fs.readFileSync(themePath, "utf8");
  const themeVars = extractVarsFromBlock(themeCss, `[data-theme='${theme}']`);

  const merged = new Map([...baseVars, ...semanticVars, ...themeVars]);
  return resolveAllVars(merged);
}

/**
 * Build the payload structure expected by the Figma client:
 * - mode: { "light-mode": { varName: value }, "dark-mode": { ... } }
 * - tw-colors, rdx-colors: { key: hexOrRgba }
 * - tw-border-radius: { rounded-xs: number, ... }
 * - tw-gap, tw-space, tw-margin: { "gap-1": number, ... }
 * - tw-font: { "size-xs": number, ... }
 */
export function extractTokens() {
  const lightVars = loadThemeVars("light");
  const darkVars = loadThemeVars("dark");
  const baseVars = loadThemeVars("light"); // base is same for both; we already have full resolution from light load

  const modeLight = {};
  const modeDark = {};

  const modeVarNames = [
    "background",
    "foreground",
    "border",
    "destructive",
    "secondary",
    "muted",
    "muted-foreground",
    "primary",
    "primary-foreground",
    "secondary-foreground",
    "accent",
    "accent-foreground",
    "ring",
    "input",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "sidebar",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
    "chart-1",
    "chart-2",
    "chart-3",
    "chart-4",
    "chart-5",
    "semantic-background",
    "semantic-border",
    "semantic-foreground",
    "background-color",
    "radius",
    "radius-xs",
    "radius-sm",
    "radius-md",
    "radius-lg",
    "radius-xl",
    "radius-2xl",
    "radius-3xl",
    "radius-4xl",
    "radius-full",
    "radius-none",
  ];

  for (const name of modeVarNames) {
    const lightVal = lightVars.get(name);
    const darkVal = darkVars.get(name);
    if (lightVal !== undefined) modeLight[name] = parseValue(lightVal);
    if (darkVal !== undefined) modeDark[name] = parseValue(darkVal);
  }

  // stroke-width, border-width from base
  const strokeWidth = baseVars.get("stroke-width");
  const borderWidth = baseVars.get("border-width");
  if (strokeWidth !== undefined) {
    modeLight["stroke-width"] = parseValue(strokeWidth);
    modeDark["stroke-width"] = parseValue(strokeWidth);
  }
  if (borderWidth !== undefined) {
    modeLight["border-width"] = parseValue(borderWidth);
    modeDark["border-width"] = parseValue(borderWidth);
  }

  // tw-colors / rdx-colors: all --color-* from base (resolved)
  const baseCss = fs.readFileSync(path.join(THEMES_DIR, "base.css"), "utf8");
  const baseOnly = resolveAllVars(extractRootVars(baseCss));
  const twColors = {};
  for (const [name, value] of baseOnly) {
    if (!name.startsWith("color-")) continue;
    const resolved = value.startsWith("var(") ? resolveValue(value, baseOnly) : value;
    if (resolved.startsWith("#")) {
      twColors[name.replace(/^color-/, "")] = parseValue(resolved);
    }
  }

  // tw-border-radius: our CSS uses --rounded-xs etc.
  const twBorderRadius = {};
  const roundedKeys = [
    "rounded-xs",
    "rounded-sm",
    "rounded-md",
    "rounded-lg",
    "rounded-xl",
    "rounded-2xl",
    "rounded-3xl",
    "rounded-4xl",
    "rounded-full",
    "rounded-none",
  ];
  for (const key of roundedKeys) {
    const val = baseVars.get(key);
    if (val !== undefined) twBorderRadius[key] = parseValue(val);
  }

  // tw-gap, tw-space, tw-margin: --gap-1..10, --space-1..10, --m-1..10
  const twGap = {};
  const twSpace = {};
  const twMargin = {};
  for (let n = 1; n <= 10; n++) {
    const g = baseVars.get(`gap-${n}`);
    const s = baseVars.get(`space-${n}`);
    const m = baseVars.get(`m-${n}`);
    if (g !== undefined) twGap[`gap-${n}`] = parseValue(g);
    if (s !== undefined) {
      twSpace[`space-x-${n}`] = parseValue(s);
      twSpace[`space-y-${n}`] = parseValue(s);
    }
    if (m !== undefined) {
      twMargin[`m-${n}`] = parseValue(m);
      twMargin[`mt-${n}`] = parseValue(m);
      twMargin[`mb-${n}`] = parseValue(m);
      twMargin[`ml-${n}`] = parseValue(m);
      twMargin[`mr-${n}`] = parseValue(m);
      twMargin[`mx-${n}`] = parseValue(m);
      twMargin[`my-${n}`] = parseValue(m);
    }
  }

  // tw-font: --size-xs, --leading-3..8, --weight-*, --family-sans
  const twFont = {};
  const sizeKeys = ["size-xs", "size-sm", "size-base", "size-lg", "size-xl"];
  for (const k of sizeKeys) {
    const v = baseVars.get(k);
    if (v !== undefined) twFont[k] = parseValue(v);
  }
  for (let n = 3; n <= 8; n++) {
    const v = baseVars.get(`leading-${n}`);
    if (v !== undefined) twFont[`leading-${n}`] = parseValue(v);
  }
  for (const w of ["weight-normal", "weight-medium", "weight-semibold", "weight-bold"]) {
    const v = baseVars.get(w);
    if (v !== undefined) twFont[w] = parseValue(v);
  }
  const family = baseVars.get("family-sans");
  if (family !== undefined) twFont["family-sans"] = family.replace(/^["']|["']$/g, "").trim();

  return {
    mode: {
      "light-mode": modeLight,
      "dark-mode": modeDark,
    },
    "tw-colors": twColors,
    "rdx-colors": { ...twColors },
    "tw-border-radius": twBorderRadius,
    "tw-gap": twGap,
    "tw-space": twSpace,
    "tw-margin": twMargin,
    "tw-font": twFont,
  };
}
