# Marketing Landing Page — Improvement Backlog

> File: `src/components/marketing/MarketingLandingPage.tsx`
> Analyzed: 2026-04-23 | Branch at time of analysis: `fix-passing-ghost-fields-in-mapping`

These are deferred improvements identified via UX/brand audit. The page is structurally sound; the changes below close the gap between the current neutral presentation and the **Precise, Energized, Sophisticated** brand identity.

---

## Priority Order

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Fix ambient glow to use orange alpha token | 2 lines | High — brand signature |
| 2 | Drop "demo" from headline copy | 5 words | High — credibility |
| 3 | Orange accent on headline key phrase | 1 `<span>` | Medium — brand expression |
| 4 | Add eyebrow credential badge above heading | 6 lines | Medium — trust signal |
| 5 | Mini-visual height bump | 1 class | Low — polish |
| 6 | Rename "Try the Demo:" section label | 3 words | Low — copy clarity |
| 7 | Add left→right directional hint | 6 lines | Low — conversion |
| 8 | Improve step 03 description copy | 1 sentence | Low — polish |

---

## 1. Fix Ambient Glow — Use Brand Orange, Not Brown

**Root cause:** The glow currently uses `--color-background-primary-faded` which resolves to `--color-brown-800` (`#503319`). At `opacity: 0.45` this is nearly invisible and adds no brand warmth.

```tsx
// BEFORE
style={{
  background:
    'radial-gradient(ellipse at top, var(--color-background-primary-faded) 0%, transparent 70%)',
  opacity: 0.45,
}}

// AFTER — use the existing orange alpha token, drop the opacity suppression
style={{
  background:
    'radial-gradient(ellipse at top, var(--color-orange-alpha-15) 0%, transparent 65%)',
}}
```

`--color-orange-alpha-15` is already in `base.css` as `rgba(255, 162, 75, 0.15)`. No new tokens needed. This is the same subtle-warmth treatment used on the modal `surface-gradient-border`.

---

## 2. Drop "Demo" from the Headline

**Root cause:** The word "demo" signals a toy or prototype. Data engineers building production pipelines will hesitate at this framing.

```tsx
// BEFORE
"Build your first demo data pipeline from Kafka to ClickHouse in minutes."

// AFTER
"Stream Kafka data into ClickHouse. Production-ready in minutes."
```

---

## 3. Orange Accent on the Key Heading Phrase

**Root cause:** The entire `<h1>` is one flat neutral color. The brand accent (`--color-foreground-primary`) only appears in the 80px step thumbnails — a missed brand expression on the page's most prominent element.

```tsx
// BEFORE
<h1 className="title-2 italic animate-fade-in-up" style={{ color: 'var(--text-heading)', ... }}>
  Build your first demo data pipeline from Kafka to ClickHouse in minutes.
</h1>

// AFTER — pair with change #2 above
<h1 className="title-2 italic animate-fade-in-up" style={{ color: 'var(--text-heading)', animationFillMode: 'both' }}>
  Stream Kafka data into ClickHouse.{' '}
  <span style={{ color: 'var(--text-accent)' }}>Production-ready in minutes.</span>
</h1>
```

`--text-accent` is already defined as `var(--color-foreground-primary)` in `theme.css`. No new tokens needed.

---

## 4. Add an Eyebrow Credential Badge Above the Heading

**Root cause:** The heading starts with no context. A small technical credential statement before the pitch establishes authority for the target audience (data engineers).

```tsx
{/* Insert above <h1>, inside the flex flex-col gap-10 container */}
<div
  className="flex items-center gap-2 caption-1 animate-fade-in-up"
  style={{ color: 'var(--color-foreground-primary)', animationFillMode: 'both' }}
>
  <div
    className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
    style={{ background: 'var(--color-foreground-primary)' }}
  />
  Native Kafka → ClickHouse — sub-second latency
</div>
```

The pulsing orange dot mirrors the "active connection" indicator used inside the product, bringing the app's visual language into the marketing context.

---

## 5. Mini-Visual Height Bump

**Root cause:** At `h-[44px]` the `ClickHouseVisual` bar chart and `KafkaStreamVisual` tracks are compressed. A small height increase gives them room to read clearly.

```tsx
// BEFORE
className="flex-shrink-0 w-[80px] h-[44px] rounded overflow-hidden"

// AFTER
className="flex-shrink-0 w-[80px] h-[52px] rounded overflow-hidden"
```

Width stays the same so the step row layout is unaffected.

---

## 6. Rename "Try the Demo:" Section Label

**Root cause:** The steps are informational, not interactive. "Try the Demo:" is misleading and undersells the product.

```tsx
// BEFORE
"Try the Demo:"

// AFTER — option A: honest label
"How it works"

// AFTER — option B: remove entirely
// The orange mono step numbers (01, 02, 03) already organize the section visually.
```

---

## 7. Add Left→Right Directional Hint

**Root cause:** The left content panel provides zero visual direction toward the auth form on the right. A small prompt at the bottom of the content column helps orient first-time visitors.

```tsx
{/* Insert after the final <div style={{ borderTop: ... }} />, before closing the content column */}
<p
  className="caption-1 animate-fade-in-up"
  style={{
    color: 'var(--text-secondary)',
    animationDelay: '640ms',
    animationFillMode: 'both',
  }}
>
  No infrastructure required —{' '}
  <span style={{ color: 'var(--text-link)' }}>sign up on the right to get started</span>
</p>
```

`--text-link` resolves to `var(--color-foreground-primary)` (orange). No new tokens needed.

---

## 8. Improve Step 03 Description Copy

**Root cause:** "Map your data to ClickHouse using GlassFlow's optimized native sink." — "Map" understates the capability and "native sink" is jargon without context.

```tsx
// BEFORE
"Map your data to ClickHouse using GlassFlow's optimized native sink."

// AFTER
"Route transformed events to ClickHouse with GlassFlow's high-throughput native sink."
```

---

## Token Reference

All changes above use existing tokens — no new additions to `base.css` or `theme.css` required.

| Token used | Resolves to |
|-----------|-------------|
| `--color-orange-alpha-15` | `rgba(255, 162, 75, 0.15)` |
| `--text-accent` | `var(--color-foreground-primary)` → `#ffa24b` |
| `--text-link` | `var(--color-foreground-primary)` → `#ffa24b` |
| `--color-foreground-primary` | `var(--color-orange-300)` → `#ffa24b` |
