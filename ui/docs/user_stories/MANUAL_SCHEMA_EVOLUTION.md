Below is a **structured, implementation-ready set of user stories** for supporting **manual schema evolution + new table creation** in the _Select Destination_ step.

I’ve grouped them into:

1. Core Flow Structure
2. New Table Creation (Schema Definition)
3. Mapping & Column Management
4. Order & Engine Handling
5. Validation & Errors
6. Manual Schema Evolution (Existing Pipeline)
7. Non-Regression Requirements

All stories follow consistent format and include acceptance criteria.

---

# EPIC 1 — Destination Selection Structure

---

## US-1: Choose Destination Path

**As a** user creating a new pipeline
**When I** land on the Clickhouse Mapping step
**I want** to choose between creating a new table or selecting an existing one  
**So that** I can either define a schema from scratch or reuse an existing ClickHouse table.

### Acceptance Criteria

- Two mutually exclusive options are visible:
  - “Create New Table”
  - “Use Existing Table”
- Selecting one hides the configuration of the other.
- Default selection is “Create New Table”.
- Switching between paths resets only path-specific fields.
- Batch settings remain visible and unchanged.

---

# EPIC 2 — New Table Definition (ClickHouse Table Creation)

---

## US-2: Display Table Settings for New Table Path

**As a** user creating a new table  
**I want** to configure table settings  
**So that** I can define how the ClickHouse table will be created.

### Acceptance Criteria

When “Create New Table” is selected:

User can:

- Enter Table Name (required)
- Select Database (from fetched list)
- Select Table Engine (dropdown)
- Select Order field (dropdown)

Validation:

- Table Name is required.
- Database is required.
- Engine is required.
- Order field is required.
- Deploy button is disabled until all required fields are valid.

---

## US-3: Select Table Engine

**As a** user creating a new table  
**I want** to choose a ClickHouse table engine  
**So that** the table matches my use case.

### Acceptance Criteria

- Engine dropdown lists supported engines:
  - MergeTree
  - ReplacingMergeTree
  - SummingMergeTree
  - AggregatingMergeTree
  - CollapsingMergeTree
  - VersionedCollapsingMergeTree
  - GraphiteMergeTree
- Engine list is configurable from backend.
- Engine selection is required.
- Changing engine does not reset mapping.

---

## US-4: Select Order Field

**As a** user creating a new table  
**I want** to select an order field based on incoming Kafka fields  
**So that** the table is properly ordered.

### Acceptance Criteria

- Order dropdown is populated from incoming Kafka fields.
- User must select exactly one field.
- If a destination column name for that field changes:
  - Order field updates automatically if bound to original field.
  - If renamed, system prompts user to confirm new order column.
- If order field mapping is deleted:
  - Order becomes invalid.
  - Validation error is shown.
  - Deploy is blocked.

---

# EPIC 3 — Schema Mapping (New Table Creation)

---

## US-5: Auto-Generate Mapping Based on Kafka Schema

**As a** user defining a new table  
**I want** incoming Kafka fields to auto-populate mapping  
**So that** I don’t manually recreate the schema.

### Acceptance Criteria

When:

- Table Name entered
- Database selected

Then:

- Mapping section appears.
- Each Kafka field generates a mapping row:
  - Incoming Field (readonly dropdown)
  - Inferred Data Type
  - Destination Column (editable, prefilled with same name)
- Data type is inferred from Kafka schema.
- Mapping section is hidden until Table Name + Database selected.

---

## US-6: Add Mapping (Schema Extension)

**As a** user  
**I want** to add additional mapping rows  
**So that** I can define new columns in destination table.

### Acceptance Criteria

- “Add Mapping” button exists.
- Clicking it adds a new empty row:
  - Incoming field selector
  - Data type selector
  - Destination column input
- User can:
  - Select from schema
  - Or define manually (if supported)
- New mapping defines a new ClickHouse column.

Validation:

- Destination column name must be unique.
- Data type required.
- Incoming field required unless manual mode enabled.

---

## US-7: Auto-Set Data Type When Selecting Field

**As a** user  
**I want** data type to auto-fill when selecting incoming field  
**So that** I don’t manually define types incorrectly.

### Acceptance Criteria

- Selecting a field auto-populates inferred type.
- User can override type manually.
- If overridden:
  - System validates compatibility before deploy.

---

## US-8: Prevent Duplicate Destination Columns

**As a** user  
**I want** to see an error if I duplicate a column name  
**So that** invalid schema cannot be created.

### Acceptance Criteria

If two destination columns have identical names:

- Error message appears:  
  “Column name already exists.”
- Highlight conflicting fields.
- Deploy disabled.

---

## US-9: Nullable Control

**As a** user  
**I want** to define if a column is Nullable  
**So that** I can control ClickHouse nullability.

### Acceptance Criteria

- Each mapping row has Nullable toggle.
- Default behavior:
  - Based on inferred schema (configurable).
- Toggling Nullable updates column definition.
- Non-nullable fields validated:
  - If Kafka field may be null → warning shown.

---

## US-10: Delete Mapping Row

**As a** user  
**I want** to remove mapping rows  
**So that** I can adjust schema before creation.

### Acceptance Criteria

- Each row has Delete action.
- Deleting:
  - Removes mapping row.
  - If it was used as Order field → Order becomes invalid.
  - Validation error displayed.

---

# EPIC 4 — Validation & Deployment Errors

---

## US-11: Show Validation Errors on Deploy

**As a** user  
**I want** to see clear validation errors  
**So that** I understand what is missing.

### Acceptance Criteria

On clicking Deploy:

If any required field missing:

- Table Name → “Enter table name”
- Database → “Select database”
- Engine → “Select table engine”
- Order → “Select field to order by”

Errors:

- Inline
- Field highlighted
- Deploy blocked

---

# EPIC 5 — Manual Schema Evolution (Existing Pipeline)

This covers your critical requirement.

---

## US-12: Stop Pipeline Before Schema Modification

**As a** user  
**I want** to stop a running pipeline before modifying schema  
**So that** changes are safe.

### Acceptance Criteria

- If pipeline is running:
  - Schema editing disabled.
  - Banner shows: “Pipeline must be stopped to modify schema.”
- Stop action available.
- Once stopped:
  - Schema becomes editable.

---

## US-13: Edit Existing ClickHouse Table Schema

**As a** user  
**I want** to modify the ClickHouse table schema from UI  
**So that** it conforms to changed Kafka schema.

### Acceptance Criteria

When editing existing pipeline:

User can:

- Add column (ALTER TABLE ADD COLUMN)
- Drop column (ALTER TABLE DROP COLUMN)
- Modify column type (ALTER TABLE MODIFY COLUMN)
- Change Nullable property
- Rename column (if supported)

All operations:

- Show preview of SQL.
- Require confirmation.
- Executed atomically.
- Error surfaced if ClickHouse fails.

---

## US-14: Add Column During Schema Evolution

**As a** user  
**I want** to add new columns when Kafka schema changes  
**So that** pipeline can resume without failure.

### Acceptance Criteria

- Add column UI similar to mapping row.
- User defines:
  - Column name
  - Type
  - Nullable
- System executes:  
  `ALTER TABLE ADD COLUMN`
- On success:
  - Schema updated.
  - Mapping updated.
- On failure:
  - Error shown.
  - No partial UI update.

---

## US-15: Modify Column Type

**As a** user  
**I want** to modify a column type  
**So that** it matches updated Kafka schema.

### Acceptance Criteria

- User can edit type.
- System warns:  
  “Changing type may cause data conversion issues.”
- On confirmation:  
  Executes:  
  `ALTER TABLE MODIFY COLUMN`
- Handles ClickHouse error responses.

---

## US-16: Resume Pipeline After Schema Change

**As a** user  
**I want** to restart pipeline after schema evolution  
**So that** data ingestion resumes.

### Acceptance Criteria

- Resume button visible when schema valid.
- Pre-flight validation:
  - Kafka fields match mapping.
  - Order column exists.
- If valid:
  - Pipeline starts.
- If invalid:
  - Detailed mismatch error shown.

---

# EPIC 6 — Join Journey Mapping

---

## US-17: Schema Mapping in Join Flow

**As a** user  
**I want** mapping to include fields from both topics  
**So that** joined output is correct.

### Acceptance Criteria

- All fields from Left + Right topic displayed.
- If same field name exists:
  - Left topic field selected by default.
- User can override mapping.
- Duplicate destination names prevented.
- Same validation rules as single-topic flow.

---

# EPIC 7 — Non-Regression

---

## US-18: Preserve Batch Settings

**As a** user  
**I want** batch size and timeout to remain unchanged  
**So that** existing ingestion behavior is preserved.

### Acceptance Criteria

- Batch Size and Batch Timeout always visible in Select Destination.
- Schema evolution changes do NOT modify batch settings.
- Switching between new/existing table paths does NOT reset batch settings.
- Editing schema does NOT reset batch settings.

---

# Implementation-Level Summary

To support manual schema evolution properly, backend must support:

- ALTER TABLE ADD COLUMN
- ALTER TABLE DROP COLUMN
- ALTER TABLE MODIFY COLUMN
- Optional: RENAME COLUMN
- Safe execution with rollback handling
- Schema introspection via system.columns

UI must:

- Fetch current table schema
- Diff Kafka schema vs ClickHouse schema
- Allow controlled reconciliation

---

# Critical Architectural Note

Manual schema evolution requires:

1. Pipeline stop enforcement
2. Atomic ClickHouse operations
3. Schema diffing logic
4. Validation before restart

Without schema diffing, users will break pipelines repeatedly.

---

If you want next step, I can now:

- Convert this into Linear-ready tickets
- Convert into PRD document
- Convert into backend API contract
- Or design schema diff algorithm for ClickHouse vs Kafka schema detection

---

## What the new screenshots add (and what your stories currently miss)

### 1) It’s **Pause**, not **Stop** (and it’s asynchronous)

- Screenshot shows **Active pipeline** with a **Pause** button.
- A modal explains: pausing waits for in-flight/queued events to finish (“might take some time”).

**Problem:** Your stories assume “Stop pipeline before schema modification” (US-12). That’s not what the UI does. The requirement is: **pipeline must be paused to edit**, and pausing is not immediate.

**Required change**

- Replace “Stop” with “Pause” as the gating state (or support both, but UI clearly emphasizes Pause).
- Add acceptance criteria for **pausing-in-progress** state and edit locking until pause completes.

---

### 2) There is an explicit **Edit mode** with **Save Changes / Discard**

- Active pipeline view shows **Edit** and **Discard** actions at the bottom.
- When paused, you get **Save Changes** / **Discard**, and there’s a **Start** button to resume.

**Problem:** Your stories talk about “schema editing disabled/enabled”, but you don’t define:

- entering edit mode,
- unsaved draft state,
- discard behavior,
- save behavior independent of pipeline start.

**Required new story**

- “Enter Edit Mode (draft changes)”
- “Discard changes reverts draft without touching ClickHouse”
- “Save changes applies ALTERs + updates pipeline mapping config”

---

### 3) Nullability rules are **asymmetric**

From the screenshots:

- **NOT NULL → Nullable is allowed**
- **Nullable → NOT NULL is NOT allowed** (blocked)
- Newly added mapping row: “Can be deleted or set not nullable until starting pipeline” suggests **special rules for new columns before restart**.

**Problem:** Your nullable story (US-9) treats Nullable as a normal toggle. It’s not. It’s constrained by ClickHouse realities + your product policy.

**Required update**

- Add explicit AC that **nullable-to-not-nullable is blocked** (with explanation).
- Add special handling for **newly added columns while paused**:
  - allow deleting the column before restart,
  - allow making it NOT NULL **only before starting pipeline** (if that’s indeed the rule).

---

### 4) “Add Mapping” is a **menu with two distinct paths**

New screenshots show:

- Add Mapping expands options:
  - **Select field from schema**
  - **Add field manually**

**Problem:** Your US-6 mentions “select from schema or define manually”, but it doesn’t model the UI or validation differences.

**Required update**

- Split into two stories or at least two explicit AC paths:
  - add-from-schema (auto type)
  - add-manual (type required, name required, may not exist in Kafka schema)

---

### 5) There is a **Reload** action for schema/table metadata

There is a **Reload** button near the table selector in edit UI.

**Problem:** Not captured at all.

**Required new story**

- “Reload ClickHouse schema/table metadata while editing” (to handle out-of-band changes).

---

## Concrete edits to your existing stories (delta)

### Replace / revise US-12 (Stop gating)

**Rename to:** US-12: Pause pipeline before applying schema changes
**Add AC:**

- While pipeline is Active: schema fields are read-only; Edit is allowed but Save is blocked until paused.
- Clicking Pause opens confirmation modal.
- After confirmation: UI shows “Pausing…” state; controls disabled.
- Only when status = Paused:
  - mapping rows become editable,
  - Add Mapping enabled,
  - Save Changes enabled (subject to validation).

---

### Add NEW: US-19 Enter Edit Mode (draft state)

**As a** user
**I want** to enter an edit mode for Select Destination
**So that** I can stage changes before applying them.

**AC**

- Clicking **Edit** enters edit mode and shows Save Changes / Discard.
- Draft changes are local until Save.
- Leaving page prompts if there are unsaved changes.

---

### Add NEW: US-20 Discard Draft Changes

**AC**

- Clicking Discard reverts UI to last saved pipeline config.
- No ALTER TABLE calls are executed on discard.
- Works both in paused and active (if draft exists).

---

### Update US-9 (Nullable) to include asymmetric constraints

**Add AC**

- For **existing ClickHouse columns**:
  - NOT NULL → Nullable allowed
  - Nullable → NOT NULL blocked with inline message:
    “Cannot change Nullable column to NOT NULL.”
- For **new columns added during paused edit**:
  - Nullable defaults configurable
  - User may set NOT NULL **only before restarting pipeline** (if that is the intended rule)
  - After pipeline restarts, NOT NULL cannot be toggled (field locks)

If you actually plan to support nullable→not-nullable later, you’ll need a separate “migration mode” story with a backfill requirement. But screenshots indicate you are intentionally _not_ doing that.

---

### Update US-6 / US-7 (Add Mapping) to match the menu UX

**Add AC**

- Add Mapping opens menu with:
  - Select field from schema
  - Add field manually
- Select-from-schema:
  - incoming field required
  - data type auto-filled
- Add-manual:
  - incoming field can be empty or “manual”
  - data type required
  - destination column required

---

### Add NEW: US-21 Reload Schema

**As a** user
**I want** to reload ClickHouse schema metadata
**So that** I can sync UI after external schema changes.

**AC**

- Reload fetches latest table schema and updates mapping UI.
- If reload detects conflicts with draft changes:
  - user gets a conflict banner and must resolve before saving.

---

## One more important hole: “Save Changes” vs “Start”

Your current stories blur “apply schema changes” and “resume pipeline”. Screens show these are separate: you can save while paused, then Start.

You should model it explicitly:

### Add NEW: US-22 Save schema/mapping changes while paused

**AC**

- Save Changes executes required ALTER operations (add/modify/drop as applicable).
- Updates pipeline config mapping.
- On success: shows confirmation; pipeline remains Paused.
- Start button remains a separate action.

### Update US-16 (Resume) to be “Start after successful save”

**AC**

- Start is disabled if there are unsaved edits or validation errors.

---

## Summary: are you covered?

**Partially.** You covered the overall capability, but you missed the _actual operating model_ shown in the screenshots:

- **Pause (async) → Edit mode (draft) → Save Changes (apply ALTERs) → Start**
- Nullability is **one-way** for existing columns
- Add Mapping has **two explicit creation paths**
- There’s a **Reload** capability
- Discard exists and must be defined

If you want, I can rewrite the full “Manual Schema Evolution” epic as a clean, minimal set of tickets that exactly matches the UI you’re building (pause/edit/save/start), without the extra assumptions about “stop” and generic ALTER support.
