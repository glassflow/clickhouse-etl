/**
 * Extracts and resolves design tokens from theme CSS for Figma sync.
 * Reads base.css and theme.css; resolves var() references;
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
 * Parse a value to a primitive for Figma: number (for px), { r, g, b, a } for hex/rgba, string otherwise.
 */
function parseValue(raw) {
  const s = raw.trim();
  const rgbaMatch = s.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]) / 255,
      g: Number(rgbaMatch[2]) / 255,
      b: Number(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
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
 * semantic-tokens.css removed — all theme vars now in theme.css.
 */
function loadThemeVars(theme) {
  const basePath = path.join(THEMES_DIR, "base.css");
  const baseCss = fs.readFileSync(basePath, "utf8");
  const baseVars = extractRootVars(baseCss);

  const themePath = path.join(THEMES_DIR, "theme.css");
  const themeCss = fs.readFileSync(themePath, "utf8");
  const themeVars = extractVarsFromBlock(themeCss, `[data-theme='${theme}']`);

  const merged = new Map([...baseVars, ...themeVars]);
  return resolveAllVars(merged);
}

/**
 * Convert a hyphenated color name to Figma's slash format.
 * e.g., "orange-100" -> "orange/100", "gray-dark-50" -> "gray-dark/50"
 */
function toFigmaColorName(name) {
  const match = name.match(/^(.+)-(\d+)$/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return name;
}

/**
 * Map Tailwind color scale (50-950) to Radix scale (1-12).
 * Radix uses a 12-step scale where lower numbers are lighter.
 */
const TAILWIND_TO_RADIX_MAP = {
  "50": "1",
  "100": "2",
  "200": "3",
  "300": "4",
  "400": "5",
  "500": "6",
  "600": "7",
  "700": "8",
  "750": "9",
  "800": "10",
  "900": "11",
  "950": "12",
};

/**
 * Convert a Tailwind color name to Radix naming convention.
 * e.g., "orange-100" -> "orange/2", "gray-500" -> "gray/6"
 */
function toRadixColorName(name) {
  const match = name.match(/^(.+)-(\d+)$/);
  if (match) {
    const [, colorName, scale] = match;
    const radixScale = TAILWIND_TO_RADIX_MAP[scale];
    if (radixScale) {
      return `${colorName}/${radixScale}`;
    }
  }
  return name;
}

/**
 * Build the payload structure expected by the Figma client:
 * - mode: { "dark-mode": { varName: value } }  (app is dark-only)
 * - tw-colors: { "orange/100": hexOrRgba } - uses Figma's slash naming (keys match Figma collection name)
 * - rdx-colors: { "orange/2": hexOrRgba } - flat map for dark mode (Radix 1-12 scale)
 * - tw-border-radius: { rounded-xs: number, ... }
 * - tw-gap, tw-space, tw-margin: { "gap-1": number, ... }
 * - tw-font: { "size-xs": number, ... }
 */
export function extractTokens() {
  const darkVars = loadThemeVars("dark");

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
    const darkVal = darkVars.get(name);
    if (darkVal !== undefined) modeDark[name] = parseValue(darkVal);
  }

  // stroke-width, border-width from base (present in darkVars via base.css merge)
  const strokeWidth = darkVars.get("stroke-width");
  const borderWidth = darkVars.get("border-width");
  if (strokeWidth !== undefined) modeDark["stroke-width"] = parseValue(strokeWidth);
  if (borderWidth !== undefined) modeDark["border-width"] = parseValue(borderWidth);

  // All other theme variables (button-*, control-*, surface-*, option-*, etc.) for Figma mode sync.
  // Skip names already in modeDark; only add values that parse to color, number, or a short string.
  for (const [name, value] of darkVars) {
    if (modeDark[name] !== undefined) continue;
    const parsed = parseValue(value);
    if (parsed !== undefined && parsed !== null) {
      const isColor = typeof parsed === "object" && "r" in parsed && "g" in parsed && "b" in parsed;
      const isNumber = typeof parsed === "number";
      const isShortString = typeof parsed === "string" && parsed.length <= 200;
      if (isColor || isNumber || isShortString) modeDark[name] = parsed;
    }
  }

  // tw/colors: all --color-* from base (resolved), using Figma's slash naming
  const baseCss = fs.readFileSync(path.join(THEMES_DIR, "base.css"), "utf8");
  const baseOnly = resolveAllVars(extractRootVars(baseCss));
  const twColors = {};
  const rdxColorsDark = {};

  for (const [name, value] of baseOnly) {
    if (!name.startsWith("color-")) continue;
    const resolved = value.startsWith("var(") ? resolveValue(value, baseOnly) : value;
    if (resolved.startsWith("#")) {
      const colorName = name.replace(/^color-/, "");
      const parsedValue = parseValue(resolved);

      // tw/colors uses slash naming: orange-100 -> orange/100
      const figmaName = toFigmaColorName(colorName);
      twColors[figmaName] = parsedValue;

      // rdx/colors uses Radix 1-12 scale: orange-100 -> orange/2
      const radixName = toRadixColorName(colorName);
      rdxColorsDark[radixName] = parsedValue;
    }
  }

  // Add special colors for rdx/colors (white and black are common in Radix)
  if (twColors["white"]) rdxColorsDark["white"] = twColors["white"];
  if (twColors["black"]) rdxColorsDark["black"] = twColors["black"];

  // tw-border-radius: CSS uses --radius-* (--rounded-* aliases removed); keep rounded-* as Figma output keys
  const twBorderRadius = {};
  const radiusKeys = [
    ["radius-xs",   "rounded-xs"],
    ["radius-sm",   "rounded-sm"],
    ["radius-md",   "rounded-md"],
    ["radius-lg",   "rounded-lg"],
    ["radius-xl",   "rounded-xl"],
    ["radius-2xl",  "rounded-2xl"],
    ["radius-3xl",  "rounded-3xl"],
    ["radius-4xl",  "rounded-4xl"],
    ["radius-full", "rounded-full"],
    ["radius-none", "rounded-none"],
  ];
  for (const [cssKey, figmaKey] of radiusKeys) {
    const val = darkVars.get(cssKey);
    if (val !== undefined) twBorderRadius[figmaKey] = parseValue(val);
  }

  // tw/gap, tw/space, tw/margin: --gap-N / --space-N / --m-N aliases removed; read from --unit-xN
  const twGap = {};
  const twSpace = {};
  const twMargin = {};
  for (let n = 1; n <= 10; n++) {
    const unitVal = darkVars.get(`unit-x${n}`);
    if (unitVal !== undefined) {
      const px = parseValue(unitVal);
      twGap[`gap-${n}`] = px;
      twSpace[`space-x-${n}`] = px;
      twSpace[`space-y-${n}`] = px;
      twMargin[`m-${n}`] = px;
      twMargin[`mt-${n}`] = px;
      twMargin[`mb-${n}`] = px;
      twMargin[`ml-${n}`] = px;
      twMargin[`mr-${n}`] = px;
      twMargin[`mx-${n}`] = px;
      twMargin[`my-${n}`] = px;
    }
  }

  // tw/font: size/weight/family alias tokens removed; map from canonical scale tokens
  const twFont = {};

  // Font sizes: map canonical scale tokens to Figma output keys
  for (const [cssKey, figmaKey] of [
    ["font-size-caption-1", "size-xs"],   // 12px
    ["font-size-body-3",    "size-sm"],   // 14px
    ["font-size-body-2",    "size-base"], // 16px
    ["font-size-body-1",    "size-lg"],   // 18px
    ["font-size-title-4",   "size-xl"],   // 20px
  ]) {
    const v = darkVars.get(cssKey);
    if (v !== undefined) twFont[figmaKey] = parseValue(v);
  }

  // Font weights: canonical names still exist
  for (const [cssKey, figmaKey] of [
    ["font-weight-regular",  "weight-normal"],
    ["font-weight-medium",   "weight-medium"],
    ["font-weight-semibold", "weight-semibold"],
    ["font-weight-bold",     "weight-bold"],
  ]) {
    const v = darkVars.get(cssKey);
    if (v !== undefined) twFont[figmaKey] = parseValue(v);
  }

  // Font family
  const family = darkVars.get("font-family-body");
  if (family !== undefined) twFont["family-sans"] = family.replace(/^["']|["']$/g, "").trim();

  // leading-* aliases removed — skip (Figma won't update those variables)

  return {
    mode: {
      "dark-mode": modeDark,
    },
    "tw-colors": twColors,
    "rdx-colors": rdxColorsDark,
    "tw-border-radius": twBorderRadius,
    "tw-gap": twGap,
    "tw-space": twSpace,
    "tw-margin": twMargin,
    "tw-font": twFont,
  };
}

/**
 * Extract all button-related tokens (--button-*, radius, spacing, etc.) for manual Figma sync.
 * Returns { "dark-mode": { variables: {...}, sizes: {...} }, "variableNames": [...] }.
 */
export function extractButtonTokens() {
  const darkVars = loadThemeVars("dark");

  const buttonVarPrefixes = ["button-primary-", "button-secondary-", "button-tertiary-", "button-ghost-"];
  const otherVarNames = [
    "radius-md",
    "radius-sm",
    "radius-lg",
    "unit-x2",
    "unit-x3",
    "unit-x4",
    "unit-x6",
    "gap-2",
    "font-size-body-3",
    "font-weight-medium",
    "line-height-body-3",
    "letter-spacing-body-3",
    "font-family-body",
    "primary",
    "primary-foreground",
    "destructive",
    "secondary",
    "secondary-foreground",
    "accent",
    "accent-foreground",
    "background",
    "foreground",
    "input",
    "border",
    "ring",
    "button-primary-gradient-start",
    "button-primary-gradient-end",
    "button-primary-gradient-disabled-start",
    "button-primary-gradient-disabled-end",
  ];

  const collect = (vars) => {
    const out = {};
    for (const [name, value] of vars) {
      if (buttonVarPrefixes.some((p) => name.startsWith(p)) || otherVarNames.includes(name)) {
        const parsed = parseValue(value);
        if (parsed !== undefined && parsed !== null) out[name] = parsed;
      }
    }
    return out;
  };

  const variableNames = [
    ...new Set([
      ...otherVarNames,
      ...[...darkVars.keys()].filter((k) => buttonVarPrefixes.some((p) => k.startsWith(p))),
    ]),
  ].sort();

  const darkVariables = collect(darkVars);

  // Button size spec (from button.tsx: h-9=36, h-8=32, h-10=40; px-4=16, px-3=12, px-6=24; py-2=8; gap-2=8, gap-1.5=6)
  const sizes = {
    sm: { heightPx: 32, paddingXPx: 12, paddingYPx: 8, gapPx: 6, borderRadiusPx: 8 },
    default: { heightPx: 36, paddingXPx: 16, paddingYPx: 8, gapPx: 8, borderRadiusPx: 8 },
    lg: { heightPx: 40, paddingXPx: 24, paddingYPx: 8, gapPx: 8, borderRadiusPx: 8 },
    icon: { sizePx: 36, borderRadiusPx: 8 },
  };

  return {
    "dark-mode": { variables: darkVariables, sizes },
    variableNames,
    variants: [
      "default (primary)",
      "destructive",
      "outline",
      "secondary",
      "tertiary",
      "ghost",
      "link",
      "gradient",
    ],
    sizes: ["sm", "default", "lg", "icon"],
  };
}
