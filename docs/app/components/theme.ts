// Shared design tokens for docs components.
// Colors sourced from the UI design system (ui/src/themes/base.css).

// Orange brand palette — used for data series, highlights
export const BRAND_COLORS = {
  orange200: '#feac5e',
  orange300: '#ffa24b',  // primary brand
  orange400: '#ff9933',
  orange500: '#ff8b1f',
  orange600: '#e28024',
}

// Light/dark theme tokens — used for chart axes, grids, tooltips, and diagram fills
export const CHART_THEME = {
  light: {
    grid:          '#e5e7eb',  // gray-200
    axis:          '#e5e7eb',
    tick:          '#6b7280',  // gray-500
    label:         '#6b7280',
    legendText:    '#374151',  // gray-700
    tooltipBg:     '#ffffff',
    tooltipBorder: '#e5e7eb',
    tooltipLabel:  '#6b7280',
    tooltipText:   '#374151',
    tooltipValue:  '#111827',  // gray-900
  },
  dark: {
    grid:          '#374151',  // gray-700
    axis:          '#374151',
    tick:          '#9ca3af',  // gray-400
    label:         '#9ca3af',
    legendText:    '#d1d5db',  // gray-300
    tooltipBg:     '#1f2937',  // gray-800
    tooltipBorder: '#374151',
    tooltipLabel:  '#9ca3af',
    tooltipText:   '#d1d5db',
    tooltipValue:  '#f9fafb',  // gray-50
  },
}

// Mermaid theme variables derived from the same tokens
export const MERMAID_THEME_VARS = {
  light: {
    primaryColor:       '#fff4e6',
    primaryBorderColor: BRAND_COLORS.orange300,
    primaryTextColor:   '#111827',
    lineColor:          '#6b7280',
    secondaryColor:     '#f9fafb',
    tertiaryColor:      '#f9fafb',
  },
  dark: {},  // mermaid's built-in 'dark' theme is sufficient
}
