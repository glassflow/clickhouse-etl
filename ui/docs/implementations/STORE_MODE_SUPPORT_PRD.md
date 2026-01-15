# Pipeline Store Refactor: Edit & Create Mode Support

## 🧭 Context

The current frontend app allows users to define and manage **data pipelines** that ingest data from Kafka, perform transformations (e.g. deduplication or joins), and write to ClickHouse.

The app supports **two usage modes**:

1. **Create mode** – the user builds a new pipeline configuration from scratch.
2. **Edit mode** – the user loads and modifies an existing pipeline configuration.

The app uses Zustand for state management with **multiple slices**, which currently form a single shared store (used in both modes).

As the application grows in complexity, the need has emerged to **better isolate concerns between "create" and "edit" workflows**, while keeping a **single, consistent source of truth** for the UI state.

---

## 🎯 Objective

Refactor the Zustand store to:

- Support seamless switching between `create` and `edit` modes
- Allow full hydration of the store from backend configuration when editing
- Track a “base config” to enable reset/discard functionality
- Avoid duplicating store logic or introducing multiple store instances
- Preserve existing component connections to the store

---

## 📐 Proposed Architecture

### Store Structure

- Use the existing Zustand store as the **draft pipeline state**
- Add new top-level slice or fields for:
  - `mode: 'create' | 'edit'`
  - `baseConfig: PipelineConfig | undefined`

### Hydration & Reset Workflow

- On entering **create mode**:
  - Clear/reset all slices to empty/default state
  - Set `mode = 'create'`
  - `baseConfig = undefined`

- On entering **edit mode**:
  - Fetch backend pipeline config
  - Set `mode = 'edit'`
  - Set `baseConfig = <fetched config>`
  - Hydrate each slice with values from `baseConfig`

- On **discard changes**:
  - Re-hydrate all slices from `baseConfig`

### Slice API Conventions

Each slice should expose two new methods:

- `hydrateFromConfig(config: PipelineConfig): void`
- `resetToInitial(config: PipelineConfig): void`

These methods will isolate business logic for state shaping inside each slice.

---

## 🛠 Implementation Steps

1. Add `mode` and `baseConfig` to the central Zustand store.
2. Create `hydrateFromConfig()` and `resetToInitial()` in each slice.
3. Update the edit mode entry point to fetch config, store it in `baseConfig`, and hydrate all slices.
4. Add a `discardChanges()` utility to rehydrate slices from `baseConfig`.
5. Refactor mode-aware components to rely solely on the hydrated store state.
6. Optionally add a utility to compute a dirty state by comparing `draft` vs `base`.

---

## ✅ Benefits

- Components remain unaware of the current mode
- Single store remains the source of truth
- No duplicated logic or dual store instantiation
- Clean handling of discard/reset functionality
- Easier to reason about UI state

---

## 📎 File Location Recommendation

This file should be placed at:
