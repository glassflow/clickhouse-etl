import figma from '@figma/code-connect'
import { Button } from '@/src/components/ui/button'

/**
 * Figma Code Connect — Button
 *
 * HOW TO LINK THIS FILE TO FIGMA:
 * 1. Open your Figma design system file
 * 2. Select the Button component (the main component, not an instance)
 * 3. Right-click → "Copy/Paste as" → "Copy link to selection"
 * 4. Replace the FIGMA_BUTTON_URL string below with that URL
 *
 * FIGMA PROPERTY NAME MAPPING:
 * The keys in figma.enum() / figma.boolean() / figma.string() must exactly match
 * the property names shown in the Figma properties panel for this component.
 * Update the left-hand side keys (e.g. 'Primary') to match your Figma property values.
 *
 * PUBLISH:
 *   pnpm figma:publish
 */

// TODO: Replace with your Figma Button component URL
const FIGMA_BUTTON_URL =
  'https://www.figma.com/design/REPLACE_FILE_ID/REPLACE_FILE_NAME?node-id=REPLACE_NODE_ID'

figma.connect(Button, FIGMA_BUTTON_URL, {
  props: {
    variant: figma.enum('Variant', {
      Default: 'default',
      Primary: 'primary',
      Destructive: 'destructive',
      Outline: 'outline',
      Secondary: 'secondary',
      Tertiary: 'tertiary',
      Ghost: 'ghost',
      'Ghost Outline': 'ghostOutline',
      Link: 'link',
      Card: 'card',
      'Card Secondary': 'cardSecondary',
      Gradient: 'gradient',
    }),
    size: figma.enum('Size', {
      Default: 'default',
      Small: 'sm',
      Large: 'lg',
      Icon: 'icon',
    }),
    label: figma.string('Label'),
    disabled: figma.boolean('Disabled'),
    loading: figma.boolean('Loading'),
  },
  example: ({ variant, size, label, disabled, loading }) => (
    <Button variant={variant} size={size} disabled={disabled} loading={loading}>
      {label}
    </Button>
  ),
  imports: ["import { Button } from '@/src/components/ui/button'"],
})
