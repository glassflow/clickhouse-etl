import figma from '@figma/code-connect'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/src/components/ui/card'

/**
 * Figma Code Connect — Card
 *
 * HOW TO LINK:
 * 1. Select your Card component in Figma
 * 2. Right-click → "Copy link to selection"
 * 3. Replace FIGMA_CARD_URL below
 *
 * Card variants available in code:
 *   default | dark | outline | elevated | elevatedSubtle | regular | feedback | content | selectable
 *
 * State modifier classes (add via className prop):
 *   card-dark-error / card-dark-selected   — for dark cards with error/selected state
 *   card-outline-error / card-outline-selected — for outline cards with error/selected state
 */

// TODO: Replace with your Figma Card component URL
const FIGMA_CARD_URL =
  'https://www.figma.com/design/REPLACE_FILE_ID/REPLACE_FILE_NAME?node-id=REPLACE_NODE_ID'

figma.connect(Card, FIGMA_CARD_URL, {
  props: {
    variant: figma.enum('Variant', {
      Default: 'default',
      Dark: 'dark',
      Outline: 'outline',
      Elevated: 'elevated',
      'Elevated Subtle': 'elevatedSubtle',
      Regular: 'regular',
      Feedback: 'feedback',
      Content: 'content',
      Selectable: 'selectable',
    }),
  },
  example: ({ variant }) => (
    <Card variant={variant}>
      <CardHeader>
        <CardTitle>Title</CardTitle>
        <CardDescription>Description</CardDescription>
      </CardHeader>
      <CardContent>Content goes here</CardContent>
      <CardFooter>Footer</CardFooter>
    </Card>
  ),
  imports: [
    "import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/src/components/ui/card'",
  ],
})
