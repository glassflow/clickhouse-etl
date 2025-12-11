# Form Architecture

## Stack

- React Hook Form 7 for form state.
- Zod 3 for schema validation and type inference.
- Config-driven field definitions in `src/config/*-form-config.ts`.
- Form utilities in `src/components/ui/form.tsx`.

## Flow

1. Define schema in `src/scheme/*.scheme.ts` (or `index.ts` exports).
2. Infer types from schema for forms.
3. Define form config (fields, groups, labels) in `src/config/*-form-config.ts`.
4. In Manager component: initialize `useForm` with `zodResolver(schema)`, defaults, mode.
5. Render via Renderer using `<FormField>`/`FormItem` etc., or `useRenderFormFields`.
6. On submit: validate, update store, call API/service.

## Manager vs Renderer

- **Manager**: owns `useForm`, resolver, defaultValues, submission, discard, read-only rules.
- **Renderer**: consumes form context; renders fields; no side effects.

## Config-Driven Rendering

- Use configs to define fields, options, groups.
- `useRenderFormFields` and `renderFormField` in `components/ui/form.tsx` help render standard inputs.
- Prefer configs for repeatable patterns (selects, toggles, grouped fields).

## Validation

- Schema first; keep messages user-friendly.
- Use discriminated unions for mode-dependent shapes (e.g., auth methods).
- Prefer `.min(..., 'message')` and enums for constrained values.
- For async validation (e.g., uniqueness), use schema `refine` or submit-time checks with explicit errors.

## Error Display

- Use `<FormMessage>` inside `<FormItem>`; RHF integrates errors automatically.
- For nested fields, use helper `getFieldError` when passing errors to custom components.

## Read-Only Mode

- Respect `readOnly` flag from mode/view; disable inputs and actions accordingly.
- Avoid triggering validations when in view mode; gate submit handlers.

## Submission Patterns

```typescript
const form = useForm<FormType>({
  resolver: zodResolver(Schema),
  defaultValues,
  mode: 'onBlur',
  criteriaMode: 'firstError',
})

const onSubmit = form.handleSubmit(async (data) => {
  await save(data)
  coreStore.markAsClean()
})
```

## Field Patterns

- **Selects**: use `components/ui/select` and map options from config.
- **Text/Input**: `Input`, `Textarea` with `<FormControl>`.
- **Switch/Checkbox**: `Switch`, `Checkbox` with controlled values.
- **Dynamic lists**: use `useFieldArray` for arrays (e.g., brokers).
- **Conditional fields**: use `watch` to show/hide (e.g., auth method).

## Defaults and Hydration

- Defaults from store or props; prefer `useMemo` for expensive defaults.
- For edit/view, hydrate from backend config via store hydration, then set as `defaultValues`.
- When discarding sections, rehydrate via `coreStore.hydrateSection(...)`.

## Best Practices

- Keep business logic out of renderers; place in managers/services.
- Avoid uncontrolled + controlled mix; prefer controlled via RHF.
- Keep schemas and configs in sync; add tests for critical schemas.
- Centralize file inputs handling (see `InputFile`, validation guides).
- Prefer minimal `'use client'`—only in components using hooks/DOM.

## Related Docs

- Component Architecture: ./COMPONENT_ARCHITECTURE.md
- State Management: ./STATE_MANAGEMENT.md
