---
name: apply-design-principles
description: Loads and applies product/UX design principles and design system when designing or implementing features. Use when designing a new feature, implementing a new feature, or when the user asks for design or UX input.
---

# Apply Design Principles

Apply this skill when designing a new feature, implementing a new feature, or when the user requests design or UX input. Use it to align decisions with the designer’s guidance.

## When to apply

- Designing a new feature or user journey
- Implementing a new feature (UI, flows, or product behavior)
- User asks for design input, UX decisions, or product direction

## What to load

1. **Always:** [docs/design/DESIGN_PRINCIPLES.md](../../../docs/design/DESIGN_PRINCIPLES.md) — product principles, design process, brand and visual direction.
2. **When the work involves UI, layout, or visuals:** Load the styling stack in this order:
   - [.cursor/architecture/UI_AND_STYLING.md](../../architecture/UI_AND_STYLING.md) — primitives own states, semantic props only, forms, tokens, what not to use in app code, design workflow (Figma sync, Code Connect).
   - [docs/architecture/DESIGN_SYSTEM.md](../../../docs/architecture/DESIGN_SYSTEM.md) — full token system, card variants, semantic and component tokens.
   - `.cursor/styling.mdc` — rules (dark-only, no hardcoded colors, Tailwind usage).
   - When touching theme or token definitions: [.cursor/architecture/THEMING_ARCHITECTURE.md](../../architecture/THEMING_ARCHITECTURE.md).
   - When implementing from Figma or syncing tokens: [docs/design/DESIGN_WORKFLOW.md](../../../docs/design/DESIGN_WORKFLOW.md) and [docs/design/FIGMA_TOKEN_REFERENCE.md](../../../docs/design/FIGMA_TOKEN_REFERENCE.md).

## How to use

After loading the doc(s), briefly reflect on the approach against the principles. Either confirm alignment or call out tradeoffs and suggest small adjustments. Do not duplicate the full doc in the skill; reference it.

**Reflection checklist (quick validation):**

- Does this serve **data engineers first** and accelerate their work?
- Is **clarity** favored over fewer clicks or consistency at the cost of confusion?
- Is scope **right-sized for today** (modular, document what was descoped)?
- Does it match **brand/visual direction** (dark theme, orange primary, cool gray, modern and sophisticated)?
- If it’s a significant change: is **design quality in production** considered (edge cases, testing, user validation)?
- **Styling:** Are primitives used with semantic props only (`variant`, `error`, `readOnly`)? No raw hex or duplicate control/button/card styling at call sites; tokens from DESIGN_SYSTEM / theme.

## Context map

For feature design / UX: [.cursor/CONTEXT_MAP.md](../../CONTEXT_MAP.md) — design row loads DESIGN_PRINCIPLES.md (+ DESIGN_SYSTEM.md and styling.mdc when UI/styling involved). For UI styling / tokens / cards: load styling.mdc + UI_AND_STYLING.md + DESIGN_SYSTEM.md.
