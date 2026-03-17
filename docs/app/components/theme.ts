// Shared design tokens for docs components.
// Colors sourced from the UI design system (ui/src/themes/base.css).

// Chart series palette — colors from the GlassFlow website and UI design system
export const SERIES_COLORS = {
  blue400:  '#60a5fa',  // UI blue-400
  purple:   '#673ae4',  // website secondary
  orange:   '#fa6838',  // website primary CTA
  yellow500: '#f59e0b', // UI yellow-500
  red400:   '#e68075',  // UI red-400
  red500:   '#e22c2c',  // UI red-500
}

// Light/dark theme tokens — used for chart axes, grids, tooltips, and diagram fills
export const CHART_THEME = {
  light: {
    cardBg:        '#ffffff',
    cardBorder:    'rgba(0, 0, 0, 0.08)',
    grid:          '#e5e7eb',  // gray-200
    axis:          '#e5e7eb',
    tick:          '#6b7280',  // gray-500
    label:         '#6b7280',
    legendText:    '#374151',  // gray-700
    tooltipBg:     '#ffffff',
    tooltipBorder: 'rgba(0, 0, 0, 0.1)',
    tooltipLabel:  '#6b7280',
    tooltipText:   '#374151',
    tooltipValue:  '#111827',  // gray-900
  },
  dark: {
    cardBg:        '#1c1e29',  // website dark card
    cardBorder:    'rgba(255, 255, 255, 0.08)',
    grid:          'rgba(255, 255, 255, 0.06)',
    axis:          'rgba(255, 255, 255, 0.06)',
    tick:          '#9ca3af',  // gray-400
    label:         '#9ca3af',
    legendText:    '#d1d5db',  // gray-300
    tooltipBg:     '#0c0b0e',  // website darkest bg
    tooltipBorder: 'rgba(255, 255, 255, 0.12)',
    tooltipLabel:  '#9ca3af',
    tooltipText:   '#d1d5db',
    tooltipValue:  '#f9fafb',  // gray-50
  },
}

// Mermaid theme variables derived from the same tokens
export const MERMAID_THEME_VARS = {
  light: {
    primaryColor:       '#fff4e6',
    primaryBorderColor: SERIES_COLORS.orange,
    primaryTextColor:   '#111827',
    lineColor:          '#6b7280',
    secondaryColor:     '#f9fafb',
    tertiaryColor:      '#f9fafb',
  },
  dark: {},  // mermaid's built-in 'dark' theme is sufficient
}
