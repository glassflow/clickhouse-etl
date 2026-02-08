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
2. **When the work involves UI, layout, or visuals:** Also load [docs/architecture/DESIGN_SYSTEM.md](../../../docs/architecture/DESIGN_SYSTEM.md) and follow `.cursor/styling.mdc` for tokens and components.

## How to use

After loading the doc(s), briefly reflect on the approach against the principles. Either confirm alignment or call out tradeoffs and suggest small adjustments. Do not duplicate the full doc in the skill; reference it.

**Reflection checklist (quick validation):**

- Does this serve **data engineers first** and accelerate their work?
- Is **clarity** favored over fewer clicks or consistency at the cost of confusion?
- Is scope **right-sized for today** (modular, document what was descoped)?
- Does it match **brand/visual direction** (dark theme, orange primary, cool gray, modern and sophisticated)?
- If it’s a significant change: is **design quality in production** considered (edge cases, testing, user validation)?

## Context map

For feature design / UX work, [.cursor/CONTEXT_MAP.md](../../CONTEXT_MAP.md) points to DESIGN_PRINCIPLES.md and, when relevant, DESIGN_SYSTEM.md and styling rules.
