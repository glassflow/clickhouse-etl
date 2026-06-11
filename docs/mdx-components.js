import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs' // nextra-theme-blog or your custom theme
import { Tier } from './app/components/Tier'

// Get the default MDX components
const themeComponents = getThemeComponents()

// Merge components. Tier is registered globally so feature pages can drop in an
// edition badge without a per-file import.
export function useMDXComponents(components) {
  return {
    ...themeComponents,
    Tier,
    ...components
  }
}