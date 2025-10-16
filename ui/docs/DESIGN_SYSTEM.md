# Design System Architecture

## Overview

This design system uses a **three-layer architecture** that separates concerns and makes color management extremely efficient:

1. **Base Layer** (`base.css`) - Raw color values and foundation tokens
2. **Theme Layer** (`theme.css`) - Semantic color mappings for each theme
3. **Integration Layer** (`globals.css`) - shadcn/ui and Tailwind integration

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

Theme files reference base tokens to create semantic color mappings:

```css
/* Dark Theme */
[data-theme='dark'] {
  --color-background-primary: var(--color-orange-500);
  --color-background-primary-faded: var(--color-orange-800);
  --color-foreground-critical: var(--color-red-500);
  --color-background-page: var(--color-gray-dark-950);
}

/* Light Theme */
[data-theme='light'] {
  --color-background-primary: var(--color-orange-500);
  --color-background-primary-faded: var(--color-orange-100);
  --color-foreground-critical: var(--color-red-500);
  --color-background-page: var(--color-gray-50);
}
```

## 🎭 Interactive States & Hover Effects

### Card Elevated Hover Effects

The `.card-elevated` class features sophisticated hover effects that make cards stand out:

```css
.card-elevated {
  /* Base state */
  background: linear-gradient(180deg, var(--color-black-300) 0%, var(--color-black-400) 100%);
  border: 1px solid transparent;
  transition: all var(--duration-medium) var(--easing-standard);

  /* Gradient border using pseudo-element */
  &::before {
    background: linear-gradient(180deg, var(--color-orange-950) 0%, var(--color-black-400) 100%);
    transition: all var(--duration-medium) var(--easing-standard);
  }
}

.card-elevated:hover {
  /* Lighter background for prominence */
  background: linear-gradient(180deg, var(--color-black-hover-light) 0%, var(--color-black-hover-lighter) 100%);

  /* Enhanced shadow for depth */
  box-shadow:
    0px 2px 8px -2px rgba(0, 0, 0, 0.6),
    0px 8px 16px 0px rgba(0, 0, 0, 0.1),
    0px 16px 32px 0px rgba(0, 0, 0, 0.08);

  /* Subtle lift effect */
  transform: translateY(-1px);

  /* More pronounced border gradient */
  &::before {
    background: linear-gradient(
      180deg,
      var(--color-orange-hover-light) 0%,
      color-mix(in srgb, var(--color-black-400) 70%, var(--color-orange-200)) 50%,
      var(--color-orange-hover-light) 100%
    );
    padding: 1.5px; /* Thicker border */
  }
}
```

### Hover Effect Benefits

1. **Visual Hierarchy**: Cards stand out clearly when hovered
2. **Smooth Transitions**: All effects use consistent timing functions
3. **Accessibility**: Subtle but noticeable changes
4. **Performance**: Hardware-accelerated transforms and transitions

## 🚀 Benefits of This Approach

### 1. **Single Source of Truth**

- Change a color once in `base.css` → updates everywhere
- No more hunting for hardcoded color values

### 2. **Easy Color Updates**

```css
/* Want to change the primary color? Just update this: */
--color-orange-500: #new-color-here;
/* All themes automatically update! */
```

### 3. **Consistent Color Scale**

- Each color has a complete scale (50-950)
- Easy to maintain color harmony
- Predictable naming convention

### 4. **Theme Flexibility**

- Dark theme can use different variants of the same base color
- Easy to create new themes (high contrast, etc.)
- Consistent semantic meaning across themes

### 5. **Interactive State Management**

- Dedicated hover color tokens
- Consistent transition timing
- Hardware-accelerated animations

## 📋 Color Naming Convention

### Base Colors

- `--color-{color}-{shade}` (e.g., `--color-orange-500`)
- Shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
- Colors: orange, red, green, yellow, blue, gray, gray-dark

### Semantic Colors

- `--color-{category}-{variant}` (e.g., `--color-background-primary`)
- Categories: background, foreground, border
- Variants: primary, critical, warning, positive, neutral, disabled, info

### Interactive Colors

- `--color-{color}-hover-{state}` (e.g., `--color-orange-hover-light`)
- States: light, dark, lighter, darker

## 🛠️ How to Use

### 1. Adding a New Color

```css
/* In base.css */
--color-purple-500: #8b5cf6;
--color-purple-400: #a78bfa;
--color-purple-600: #7c3aed;

/* In theme.css */
--color-background-accent: var(--color-purple-500);
```

### 2. Changing an Existing Color

```css
/* In base.css - change this: */
--color-orange-500: #ff6b35; /* New orange */

/* All themes automatically use the new color! */
```

### 3. Creating a New Theme

```css
[data-theme='high-contrast'] {
  --color-background-primary: var(--color-orange-600); /* Darker for contrast */
  --color-background-page: var(--color-gray-950);
  --color-foreground-neutral: var(--color-gray-50);
}
```

### 4. Adding Hover Effects

```css
/* Use existing hover tokens */
.my-component:hover {
  background-color: var(--color-orange-hover-light);
  border-color: var(--color-orange-hover-dark);
}

/* Or create custom hover states */
--color-custom-hover: color-mix(in srgb, var(--color-blue-500) 15%, white);
```

## 🎯 Best Practices

### 1. **Always Use Base Tokens**

❌ Don't do this:

```css
--color-background-primary: #ffa24b; /* Hardcoded */
```

✅ Do this:

```css
--color-background-primary: var(--color-orange-500); /* References base */
```

### 2. **Use Semantic Names in Components**

❌ Don't do this:

```css
.button {
  background-color: var(--color-orange-500); /* Too specific */
}
```

✅ Do this:

```css
.button {
  background-color: var(--color-background-primary); /* Semantic */
}
```

### 3. **Maintain Color Scale Consistency**

- Each color should have a complete scale (50-950)
- Use consistent shade increments
- Document any deviations

### 4. **Interactive State Guidelines**

- Use dedicated hover color tokens
- Keep transitions under 300ms for responsiveness
- Use hardware-accelerated properties (transform, opacity)
- Ensure sufficient contrast ratios

## 🔄 Migration Guide

If you have existing hardcoded colors:

1. **Find the color value** in your components
2. **Add it to base.css** with appropriate naming
3. **Update theme files** to reference the base token
4. **Update components** to use semantic theme tokens

Example:

```css
/* Before */
.button {
  background-color: #ffa24b;
}

/* After */
/* In base.css */
--color-orange-500: #ffa24b;

/* In theme.css */
--color-background-primary: var(--color-orange-500);

/* In component */
.button {
  background-color: var(--color-background-primary);
}
```

## 📊 Color Scale Reference

| Shade | Usage                      | Example              |
| ----- | -------------------------- | -------------------- |
| 50    | Backgrounds, subtle fills  | `--color-gray-50`    |
| 100   | Light backgrounds, borders | `--color-orange-100` |
| 200   | Neutral backgrounds        | `--color-gray-200`   |
| 300   | Borders, dividers          | `--color-gray-300`   |
| 400   | Disabled states            | `--color-gray-400`   |
| 500   | Primary colors, main text  | `--color-orange-500` |
| 600   | Hover states, emphasis     | `--color-orange-600` |
| 700   | Secondary text             | `--color-gray-700`   |
| 800   | Dark backgrounds           | `--color-orange-800` |
| 900   | Very dark backgrounds      | `--color-gray-900`   |
| 950   | Pure black/white           | `--color-gray-950`   |

## 🎨 Interactive States Reference

| State         | Usage                   | Example                       |
| ------------- | ----------------------- | ----------------------------- |
| hover-light   | Light hover backgrounds | `--color-orange-hover-light`  |
| hover-dark    | Dark hover backgrounds  | `--color-orange-hover-dark`   |
| hover-lighter | Very light hover states | `--color-black-hover-lighter` |

This architecture makes your design system **maintainable**, **scalable**, and **developer-friendly**! 🎉
