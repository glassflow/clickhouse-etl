import figma from '@figma/code-connect'
import { Badge } from '@/src/components/ui/badge'

/**
 * Figma Code Connect — Badge
 *
 * HOW TO LINK:
 * 1. Select your Badge component in Figma
 * 2. Right-click → "Copy link to selection"
 * 3. Replace FIGMA_BADGE_URL below
 *
 * Variants map to: default | secondary | destructive | outline | success | warning | error
 */

// TODO: Replace with your Figma Badge component URL
const FIGMA_BADGE_URL =
  'https://www.figma.com/design/REPLACE_FILE_ID/REPLACE_FILE_NAME?node-id=REPLACE_NODE_ID'

figma.connect(Badge, FIGMA_BADGE_URL, {
  props: {
    variant: figma.enum('Variant', {
      Default: 'default',
      Secondary: 'secondary',
      Destructive: 'destructive',
      Outline: 'outline',
      Success: 'success',
      Warning: 'warning',
      Error: 'error',
    }),
    label: figma.string('Label'),
  },
  example: ({ variant, label }) => <Badge variant={variant}>{label}</Badge>,
  imports: ["import { Badge } from '@/src/components/ui/badge'"],
})
