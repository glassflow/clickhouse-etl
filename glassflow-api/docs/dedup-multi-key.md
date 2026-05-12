# Multi-Key Deduplication

The `routing.field.name` config accepts any [gjson path expression](https://github.com/tidwall/gjson#path-syntax), which means you can deduplicate on a composite key made from multiple fields — not just a single field.

## Single-field dedup (standard)

```json
{
  "routing": {
    "type": "field",
    "field": { "name": "event_id" }
  }
}
```

Produces a `Nats-Msg-Id` like `abc123`.

## Multi-field dedup using gjson array multipath

To deduplicate on a combination of fields, use gjson's array multipath syntax:

```json
{
  "routing": {
    "type": "field",
    "field": { "name": "[user_id,session_id]" }
  }
}
```

For a message `{"user_id": "u1", "session_id": "s1", ...}` this produces `Nats-Msg-Id: ["u1","s1"]`.

Mixed types work correctly — strings are quoted, numbers are unquoted, matching their JSON representation:

```json
{ "name": "[user_id,session_count]" }
// → Nats-Msg-Id: ["u1",42]
```

## Why array syntax and not object syntax

gjson also supports an object multipath form like `{"a":user_id,"b":session_id}`, which **looks** equivalent but is not safe for deduplication. The key order in the output follows the order of fields in the query string, so two pipeline instances configured with `{"a":f1,"b":f2}` and `{"b":f2,"a":f1}` produce **different** `Nats-Msg-Id` values for the same message — causing duplicates to slip through.

The array form `[f1,f2]` is positional and has no keys, so the output is always identical for the same field values regardless of who configured it or when.

**Use `[field1,field2,...]` for multi-key dedup. Never use `{...}` object multipath.**
