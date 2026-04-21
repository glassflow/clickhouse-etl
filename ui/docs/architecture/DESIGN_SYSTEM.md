# Design System Architecture

## Overview

This design system uses a **layered architecture** that separates concerns and makes color management efficient:

1. **Base Layer** (`base.css`) - Raw color values and foundation tokens (typography, spacing, radius, shadows)
2. **Theme Layer** (`theme.css`) - Single theme file with `[data-theme='dark']` containing semantic color mappings, state-based semantic tokens (control, surface, option), and component-specific tokens (button, card, input, etc.). Dark-only; light theme removed.
3. **Integration Layer** (`globals.css`) - Tailwind CSS, shadcn/ui integration, and utility classes

## 🎨 Color Token System

### Base Color Tokens (base.css)

All raw color values are defined in `base.css` using semantic naming:

```css
/* Primary Colors */
--color-orange-500: #ffa24b; /* Main brand color */
--color-orange-400: #ffb366; /* Lighter variant */
--color-orange-600: #e7872e; /* Darker variant */

/* Red/Critical Colors */
--color-red-500: #cb2d2b; /* Error states */
--color-red-400: #e68075; /* Lighter error */
--color-red-600: #8e1d1d; /* Darker error */

/* Green/Positive Colors */
--color-green-500: #00d370; /* Success states */
--color-green-400: #57b17c; /* Lighter success */
--color-green-600: #0d7544; /* Darker success */

/* Neutral Colors */
--color-gray-50: #ffffff; /* Pure white */
--color-gray-100: #f9fafb; /* Very light gray */
--color-gray-900: #111827; /* Very dark gray */
--color-gray-950: #000000; /* Pure black */

/* Dark Theme Specific */
--color-gray-dark-50: #f3f3f5; /* Dark theme light text */
--color-gray-dark-950: #0e0e10; /* Dark theme background */

/* Interactive State Colors */
--color-orange-hover-light: color-mix(in srgb, var(--color-orange-300) 20%, white);
--color-black-hover-light: color-mix(in srgb, var(--color-black-300) 15%, white);
```

### Theme Color Mappings (theme.css)

The theme file references base tokens to create semantic color mappings and component-specific tokens (dark theme only):

```css
/* Tokens apply to :root (immediate on load) AND [data-theme='dark'] (explicit theme hook) */
:root,
[data-theme='dark'] {
  /* Semantic color mappings */
  --color-background-primary: var(--color-orange-300);
  --color-background-primary-faded: var(--color-brown-800);
  --color-foreground-critical: var(--color-red-500);
  --color-background-page: var(--color-gray-dark-600);

  /* Component-specific tokens (Button, Card, Input, Chip, etc.) */
  --button-primary-bg: var(--color-background-primary);
  --button-primary-text: var(--color-on-background-primary);
  --card-bg: var(--color-background-elevation-raised);
  --input-bg: var(--color-background-regular);

  /* shadcn/ui integration */
  --background: var(--color-background-page);
  --foreground: var(--color-foreground-neutral);
  --primary: var(--color-background-primary);
}
```

The theme file contains:

- **Semantic color mappings**: Background, foreground, border colors for each semantic category (primary, critical, warning, positive, neutral, disabled, info)
- **Component-specific tokens**: Detailed tokens for buttons, cards, inputs, chips, badges, toggles, loaders, selects
- **shadcn/ui variables**: Integration with shadcn/ui component library

## 🎭 Semantic Tokens (in theme.css)

### State-Based Semantic Tokens

Semantic tokens (control, surface, option, etc.) are defined in `theme.css` under `[data-theme='dark']` and bridge base colors and component styles:

```css
[data-theme='dark'] {
  /* Control Tokens - for form controls */
  --control-bg: var(--color-background-elevation-raised-faded-2);
  --control-bg-hover: var(--color-background-elevation-raised-faded);
  --control-border: var(--color-border-neutral-faded);
  --control-border-focus: var(--color-border-primary);

  /* Surface Tokens - for cards, containers, modals */
  --surface-bg: var(--color-background-elevation-raised);
  --surface-bg-raised: var(--color-background-elevation-raised);
  --surface-border: var(--color-border-neutral-faded);

  /* Option Tokens - for dropdown items, menu items */
  --option-bg-hover: rgba(255, 162, 75, 0.1);
  --option-bg-selected: rgba(255, 162, 75, 0.15);

  /* Card Tokens - specialized card variants */
  --card-bg-elevated: linear-gradient(180deg, var(--color-black-300) 0%, var(--color-black-400) 100%);
  --card-border-warm-start: var(--color-brown-950);
  --card-border-hover-warm: var(--color-orange-hover-light);

  /* Text Tokens */
  --text-primary: var(--color-foreground-neutral);
  --text-secondary: var(--color-foreground-neutral-faded);
  --text-link: var(--color-foreground-primary);
}
```

> **Theme selector note:** Semantic tokens use `:root, [data-theme='dark']` — not just `[data-theme='dark']`. This ensures tokens are available immediately on page load before React hydration sets the `data-theme` attribute, preventing a flash of unstyled shadcn/ui components. It also satisfies Figma Variable modes, which need a `:root` baseline.

**Naming Convention**: `--{category}-{property}-{state}`

- Categories: `control`, `surface`, `option`, `card`, `table`, `chip`, `text`
- Properties: `bg`, `border`, `fg` (foreground), `shadow`
- States: (default=omit), `hover`, `focus`, `active`, `disabled`, `error`, `selected`

## 🎨 Interactive States & Hover Effects

### Card Component Variants

The design system provides multiple card variants with sophisticated hover effects:

**Card Elevated** (`.card-elevated`):

```css
.card-elevated {
  background: var(--card-bg-elevated);
  border: 1px solid transparent;
  position: relative;
  transition: all var(--duration-medium) var(--easing-standard);

  /* Gradient border using pseudo-element */
  &::before {
    background: linear-gradient(180deg, var(--card-border-warm-start) 0%, var(--card-border-warm-end) 100%);
    /* Mask technique for gradient borders */
  }
}

.card-elevated:hover {
  background: var(--card-bg-elevated-hover);
  box-shadow: var(--card-shadow-hover);
  &::before {
    background: linear-gradient(180deg, var(--card-border-hover-warm) 0%, var(--card-border-hover-warm) 100%);
  }
}
```

**Other Card Variants**:

- `.card-dark` - Dark theme card with gradient border
- `.card-outline` - Simple solid border, semi-transparent background
- `.card-regular` - Standard card with warm gradient border
- `.card-elevated-subtle` - Subtle card with cool (blue) gradient border
- `.feedback-card` - Info/blue themed card
- `.content-card` - Content-focused card variant

**Surface Gradient Border** (`.surface-gradient-border`):
Utility class for gradient borders on any element (used in modals, dropdowns, etc.)

### Hover Effect Benefits

1. **Visual Hierarchy**: Cards stand out clearly when hovered
2. **Smooth Transitions**: All effects use consistent timing functions (`--duration-medium`, `--easing-standard`)
3. **Accessibility**: Subtle but noticeable changes
4. **Performance**: Hardware-accelerated transforms and transitions
5. **Theme-Aware**: All hover effects adapt to light/dark themes automatically

## 🚀 Benefits of This Approach

### 1. **Single Source of Truth**

- Change a color once in `base.css` → updates everywhere
- No more hunting for hardcoded color values
- Cascading updates through all layers

### 2. **Easy Color Updates**

```css
/* Want to change the primary color? Just update this: */
--color-orange-300: #new-color-here;
/* All themes, semantic tokens, and components automatically update! */
```

### 3. **Consistent Color Scale**

- Each color has a complete scale (50-950, with additional shades like 750)
- Easy to maintain color harmony
- Predictable naming convention
- Separate scales for dark-specific grays (`gray-dark-*`) alongside neutral grays (`gray-*`)

### 4. **Dark-Only, Single Source of Truth**

- The app is dark-only — light theme was removed (see `docs/design/DESIGN_SIMPLIFICATION.md`)
- All theme tokens live in `src/themes/theme.css` under `:root, [data-theme='dark']`
- `data-theme` attribute is still set (by `ThemeProvider`) for explicit hook compatibility
- No light-mode branches or conditionals anywhere in the codebase

### 5. **State-Based Semantic Tokens**

- Component-agnostic tokens (`--control-*`, `--surface-*`, `--option-*`)
- Reusable across different component implementations
- Clear separation between color values and component usage

### 6. **Component-Specific Tokens**

- Detailed tokens for buttons, cards, inputs, chips, etc.
- Easy to customize component styles without touching base colors
- Supports multiple variants per component

### 7. **Interactive State Management**

- Dedicated hover color tokens
- Consistent transition timing (`--duration-fast`, `--duration-medium`, `--duration-slow`)
- Hardware-accelerated animations
- State-based tokens for hover, focus, active, disabled, error, selected

## 📋 Token Naming Conventions

### Base Colors

- `--color-{color}-{shade}` (e.g., `--color-orange-500`)
- Shades: 50, 100, 200, 300, 400, 500, 600, 700, 750, 800, 900, 950
- Colors: orange, red, green, yellow, blue, brown, slate, gray, gray-dark, black, white
- Special: `gray-dark-*` for dark-specific neutrals (backgrounds, surfaces); `gray-light-*` was removed with the light theme

### Semantic Colors (Theme Layer)

- `--color-{category}-{variant}` (e.g., `--color-background-primary`)
- Categories: `background`, `foreground`, `border`, `on-background`
- Variants: `primary`, `critical`, `warning`, `positive`, `neutral`, `disabled`, `info`, `regular`
- Modifiers: `-faded` for lighter/more subtle variants

### Semantic Tokens (Semantic Tokens Layer)

- `--{category}-{property}-{state}` (e.g., `--control-bg-hover`)
- Categories: `control`, `surface`, `option`, `card`, `table`, `chip`, `text`, `btn`
- Properties: `bg`, `border`, `fg`, `shadow`
- States: (default=omit), `hover`, `focus`, `active`, `disabled`, `error`, `selected`, `highlighted`

### Component-Specific Tokens (Theme Layer)

- `--{component}-{property}-{variant}-{state}` (e.g., `--button-primary-bg-hover`)
- Components: `button`, `card`, `input`, `chip`, `badge`, `toggle`, `loader`, `select`
- Properties: `bg`, `text`, `border`, `shadow`, `padding-x`, `font-size`, etc.
- Variants: `primary`, `secondary`, `tertiary`, `ghost`, `card`, `card-secondary`
- States: (default=omit), `hover`, `active`, `disabled`, `focus`

### Interactive Colors

- `--color-{color}-hover-{state}` (e.g., `--color-orange-hover-light`)
- States: `light`, `dark`, `lighter`, `darker`
- Uses `color-mix()` for dynamic color blending

## 🛠️ How to Use

### 1. Adding a New Color

```css
/* In base.css */
--color-purple-500: #8b5cf6;
--color-purple-400: #a78bfa;
--color-purple-600: #7c3aed;

/* In theme.css - add semantic mapping */
[data-theme='dark'] {
  --color-background-accent: var(--color-purple-500);
}

/* In theme.css - add state-based tokens if needed */
[data-theme='dark'] {
  --surface-bg-accent: var(--color-background-accent);
}
```

### 2. Changing an Existing Color

```css
/* In base.css - change this: */
--color-orange-300: #ff6b35; /* New orange */

/* All themes, semantic tokens, and components automatically use the new color! */
```

### 3. Adding Tokens to an Existing Theme

> **Dark-only app.** The light theme was removed in the design simplification refactor. All tokens live in `src/themes/theme.css` under `:root, [data-theme='dark']`. Do not create a separate theme file unless a new theme is explicitly planned.

```css
/* In theme.css — add new semantic tokens to the existing block */
:root,
[data-theme='dark'] {
  /* New semantic mapping */
  --color-background-accent: var(--color-purple-500);

  /* New component token */
  --button-accent-bg: var(--color-background-accent);
}
```

### 4. Using Tokens in Components

**In React/TSX with Tailwind CSS:**

```tsx
// Using CSS custom properties with Tailwind's arbitrary values
<div className="bg-[var(--surface-bg)] border border-[var(--surface-border)]">
  <button className="bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]">
    Click me
  </button>
</div>

// Using semantic text tokens
<p className="text-[var(--text-primary)]">Primary text</p>
<span className="text-[var(--text-secondary)]">Secondary text</span>
```

**In CSS files:**

```css
.my-component {
  background-color: var(--surface-bg);
  border: 1px solid var(--surface-border);
  color: var(--surface-fg);
  transition: all var(--duration-medium) var(--easing-standard);
}

.my-component:hover {
  background-color: var(--surface-bg-raised);
  box-shadow: var(--surface-shadow);
}
```

### 5. Using Card Utility Classes

```tsx
// Pre-built card variants
<div className="card-elevated">Elevated card with warm gradient border</div>
<div className="card-elevated-subtle">Subtle card with cool gradient border</div>
<div className="card-outline">Simple outline card</div>
<div className="card-dark">Dark theme card</div>
<div className="surface-gradient-border">Any element with gradient border</div>
```

### 6. Adding Hover Effects

```css
/* Use existing semantic tokens */
.my-component:hover {
  background-color: var(--surface-bg-raised);
  border-color: var(--control-border-hover);
}

/* Use component-specific tokens */
.button:hover {
  background-color: var(--button-primary-hover);
  box-shadow: var(--btn-shadow-hover);
}

/* Or create custom hover states using color-mix */
--color-custom-hover: color-mix(in srgb, var(--color-blue-500) 15%, white);
```

## 🎯 Best Practices

### 1. **Always Use Base Tokens in Theme Files**

❌ Don't do this:

```css
--color-background-primary: #ffa24b; /* Hardcoded */
```

✅ Do this:

```css
--color-background-primary: var(--color-orange-300); /* References base */
```

### 2. **Use Semantic Tokens in Components**

❌ Don't do this:

```css
.button {
  background-color: var(--color-orange-300); /* Too specific */
}
```

✅ Do this:

```css
.button {
  background-color: var(--button-primary-bg); /* Component token */
  /* OR */
  background-color: var(--control-bg); /* Semantic token */
}
```

### 3. **Prefer Semantic Tokens Over Theme Colors**

For reusable, component-agnostic styling:

❌ Don't do this:

```css
.input {
  background: var(--color-background-regular);
  border: var(--color-border-neutral);
}
```

✅ Do this:

```css
.input {
  background: var(--control-bg);
  border: var(--control-border);
}
```

### 4. **Use Component Tokens for Component-Specific Styling**

When styling specific components:

```css
.primary-button {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  padding: var(--button-primary-padding-y) var(--button-primary-padding-x);
  font-size: var(--button-primary-font-size);
}
```

### 5. **Maintain Color Scale Consistency**

- Each color should have a complete scale (50-950, with 750 for special cases)
- Use consistent shade increments
- Document any deviations
- Use `gray-dark-*` for dark-specific neutrals; do not introduce `gray-light-*` (light theme is removed)

### 6. **Interactive State Guidelines**

- Use dedicated state tokens (`--control-bg-hover`, `--surface-bg-raised`)
- Keep transitions under 300ms for responsiveness (`--duration-fast`, `--duration-medium`)
- Use hardware-accelerated properties (transform, opacity)
- Ensure sufficient contrast ratios
- Use semantic tokens for state management (`--option-bg-selected`, `--control-border-focus`)

### 7. **Token-Driven Components**

Always use semantic tokens — never hardcode hex values or raw Tailwind color classes:

```css
/* Uses design system tokens — correct */
.component {
  background: var(--surface-bg);
  color: var(--surface-fg);
  border: var(--surface-border);
}
```

### 8. **Combining Tailwind and CSS Variables**

Use Tailwind's arbitrary value syntax for CSS variables:

```tsx
// ✅ Good - combines Tailwind utilities with design tokens
<div className="p-4 rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)]">
  <p className="text-[var(--text-primary)]">Content</p>
</div>

// ❌ Avoid - hardcoded values
<div className="p-4 rounded-lg bg-gray-800 border border-gray-600">
  <p className="text-white">Content</p>
</div>
```

## 🔄 Migration Guide

If you have existing hardcoded colors:

1. **Find the color value** in your components
2. **Add it to base.css** with appropriate naming
3. **Update theme files** to reference the base token (if needed)
4. **Add semantic tokens** in theme.css (if reusable)
5. **Update components** to use semantic or component tokens

Example:

```css
/* Before */
.button {
  background-color: #ffa24b;
  color: #000000;
  padding: 12px 16px;
}

/* After */
/* In base.css */
--color-orange-300: #ffa24b;

/* In theme.css */
--button-primary-bg: var(--color-background-primary);
--button-primary-text: var(--color-on-background-primary);
--button-primary-padding-y: var(--unit-x3);
--button-primary-padding-x: var(--unit-x2);

/* In component */
.button {
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
  padding: var(--button-primary-padding-y) var(--button-primary-padding-x);
}
```

### Migrating from Hardcoded Tailwind Classes

```tsx
/* Before */
<div className="bg-gray-800 text-white border border-gray-600">
  <button className="bg-orange-500 text-black hover:bg-orange-600">
    Click
  </button>
</div>

/* After */
<div className="bg-[var(--surface-bg)] text-[var(--surface-fg)] border border-[var(--surface-border)]">
  <button className="bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]">
    Click
  </button>
</div>
```

## 📊 Color Scale Reference

| Shade | Usage                      | Example              | Notes                           |
| ----- | -------------------------- | -------------------- | ------------------------------- |
| 50    | Backgrounds, subtle fills  | `--color-gray-50`    | Lightest shade                  |
| 100   | Light backgrounds, borders | `--color-orange-100` | Very light                      |
| 200   | Neutral backgrounds        | `--color-gray-200`   | Light                           |
| 300   | Borders, dividers          | `--color-gray-300`   | Medium-light                    |
| 400   | Disabled states            | `--color-gray-400`   | Medium                          |
| 500   | Primary colors, main text  | `--color-orange-500` | Base color (varies by color)    |
| 600   | Hover states, emphasis     | `--color-orange-600` | Medium-dark                     |
| 700   | Secondary text             | `--color-gray-700`   | Dark                            |
| 750   | Special dark variants      | `--color-red-750`    | Used for dark theme backgrounds |
| 800   | Dark backgrounds           | `--color-orange-800` | Very dark                       |
| 900   | Very dark backgrounds      | `--color-gray-900`   | Darkest (except 950)            |
| 950   | Pure black/white           | `--color-gray-950`   | Maximum contrast                |

**Note**: The actual primary brand color is `--color-orange-300` (not 500), which is the main orange used throughout the app.

## 🎨 Interactive States Reference

### Color Hover States

| State         | Usage                   | Example                       |
| ------------- | ----------------------- | ----------------------------- |
| hover-light   | Light hover backgrounds | `--color-orange-hover-light`  |
| hover-dark    | Dark hover backgrounds  | `--color-orange-hover-dark`   |
| hover-lighter | Very light hover states | `--color-black-hover-lighter` |

### Semantic Token States

| Category | Property | States Available                                                    | Example                    |
| -------- | -------- | ------------------------------------------------------------------- | -------------------------- |
| control  | bg       | (default), hover, focus, disabled, error                            | `--control-bg-hover`       |
| surface  | bg       | (default), raised, overlay, sunken                                  | `--surface-bg-raised`      |
| option   | bg       | (default), hover, selected, highlighted                             | `--option-bg-selected`     |
| card     | border   | (default), warm, cool, error, selected                              | `--card-border-hover-warm` |
| text     | (none)   | primary, secondary, accent, disabled, link, error, success, warning | `--text-link-hover`        |

## 🏗️ Architecture Layers Summary

```text
┌─────────────────────────────────────────────────────────┐
│ Integration Layer (globals.css)                        │
│ - Tailwind CSS integration                             │
│ - Utility classes                                       │
│ - Container system                                      │
│ - shadcn/ui variable mappings                          │
└─────────────────────────────────────────────────────────┘
                        ↑
┌─────────────────────────────────────────────────────────┐
│ Theme Layer (theme.css, [data-theme='dark'])           │
│ - Semantic color mappings                              │
│ - State-based semantic tokens (control, surface, option)│
│ - Component-specific tokens (button, card, input)      │
│ - shadcn/ui integration                                │
└─────────────────────────────────────────────────────────┘
                        ↑
┌─────────────────────────────────────────────────────────┐
│ Base Layer (base.css)                                  │
│ - Raw color values                                     │
│ - Typography scale                                     │
│ - Spacing units                                        │
│ - Shadows, animations, z-index                         │
│ - Single source of truth                               │
└─────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```text
src/
├── app/
│   ├── globals.css                    # Integration layer
│   └── styles/
│       ├── index.css                   # Component style imports
│       └── components/
│           ├── button.css
│           ├── card.css                # Card utility classes
│           ├── input.css
│           └── ...
└── themes/
    ├── base.css                        # Base layer (primitives, spacing, typography)
    └── theme.css                       # Theme layer (dark only; semantic + component tokens)
```

## 🔗 Integration with shadcn/ui

The design system integrates with shadcn/ui components by mapping design tokens to shadcn/ui variables:

```css
/* In theme files */
--background: var(--color-background-page);
--foreground: var(--color-foreground-neutral);
--primary: var(--color-background-primary);
--primary-foreground: var(--color-on-background-primary);
--card: var(--color-background-elevation-raised);
--border: var(--color-border-neutral-faded);
--ring: var(--color-background-primary);
```

This allows shadcn/ui components to automatically use the design system colors.

## 🎯 Component Usage Patterns

### Pattern 1: Using Semantic Tokens (Recommended)

```tsx
// Best for reusable, component-agnostic styling
<div className="bg-[var(--surface-bg)] border border-[var(--surface-border)]">
  <input className="bg-[var(--control-bg)] border-[var(--control-border)]" />
</div>
```

### Pattern 2: Using Component Tokens

```tsx
// Best for component-specific styling
<button className="bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]">Submit</button>
```

### Pattern 3: Using Card Utility Classes

```tsx
// Best for card components
<div className="card-elevated p-6">
  <h2 className="text-[var(--text-heading)]">Card Title</h2>
</div>
```

This architecture makes your design system **maintainable**, **scalable**, **theme-aware**, and **developer-friendly**! 🎉
