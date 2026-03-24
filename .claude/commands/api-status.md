---
description: Show API endpoint provenance, mock status, drift detection, and handler coverage
---

# /api-status

Display a live status view of the API layer by reading the current spec and project state. No files are modified — this is a read-only command.

## Steps

### Step 1 — Read Project State

Read all available data sources in parallel (skip any that don't exist):

| Data | Source | What it tells us |
|------|--------|-----------------|
| Mode & data source | `generated-docs/context/intake-manifest.json` → `context.dataSource` | api-in-development, existing-api, new-api, mock-only |
| Mock layer active? | `web/.env.local` → `NEXT_PUBLIC_USE_MOCK_API` | Whether mocks are on or off |
| Endpoint provenance | `generated-docs/specs/api-spec.yaml` → `x-source` per endpoint | User-provided vs. inferred |
| Requirement mapping | `generated-docs/specs/api-spec.yaml` → `x-requirements` per endpoint | Which R/BR numbers each endpoint covers |
| Drift detection | Diff `api-spec.yaml` against `generated-docs/context/mock-spec-snapshot.yaml` | Have spec changes occurred since last mock refresh? |
| Last refresh timestamp | `generated-docs/context/mock-spec-snapshot.yaml` → `# Generated:` header comment | When `/api-mock-refresh` was last run |
| Handler coverage | Cross-ref spec endpoints against `web/src/mocks/handlers.ts` | Any endpoints missing mock handlers? |

**If no API spec exists** (`generated-docs/specs/api-spec.yaml` not found): Display "No API spec found. Run the DESIGN phase first." and stop.

### Step 2 — Build Status Output

Assemble the output using the sections below. Adapt based on what data is available.

#### Header Box

```
API Status
──────────
  Mode:         [dataSource from manifest, e.g. "API in development (mocked)"]
  Mock layer:   [Active/Inactive based on NEXT_PUBLIC_USE_MOCK_API]
  Spec:         generated-docs/specs/api-spec.yaml
  Last refresh: [timestamp from snapshot header, or "N/A" if no snapshot]
```

#### Endpoint Provenance

Parse every operation (method + path) from the spec's `paths` section. For each, read:
- `x-source` — if missing, treat as `user-provided` (implicit default for copy-path specs and pre-provenance specs)
- `x-requirements` — the R/BR numbers this endpoint covers

Display a table:

```
Endpoint Provenance ([N] user-provided, [M] inferred, [total] total)
────────────────────
  GET    /v1/users                    [icon] User spec    R1, R3
  POST   /v1/users                    [icon] User spec    R4
  PUT    /v1/users/{id}/permissions   [icon] Inferred     R5, BR2
```

Use `✅` for user-provided endpoints and `⚠️` for agent-inferred endpoints.

**When `dataSource` is NOT `api-in-development`:** Skip the provenance breakdown (all endpoints are authoritative). Just list endpoints with their requirement mappings.

#### Drift Detection

**Only show this section when `dataSource` is `api-in-development`.**

Compare `generated-docs/specs/api-spec.yaml` against `generated-docs/context/mock-spec-snapshot.yaml`:

- If no snapshot exists: "No mock snapshot found. Mock handlers may not have been generated yet."
- If specs are identical: "Spec and mock snapshot are in sync."
- If specs differ: List the differences using the endpoint matching rules:
  - **Match key:** HTTP method + normalized path template (parameter names ignored, trailing slashes ignored)
  - Show added endpoints, removed endpoints, and schema-changed endpoints

```
Drift Detection
───────────────
  ⚠️ Spec has changed since last mock refresh.
     Run /api-mock-refresh to reconcile.

  Changed since snapshot:
  - PUT /v1/users/{id} — response schema differs
  - GET /v1/users/{id}/activity — new endpoint (not in snapshot)
```

#### Handler Coverage

Cross-reference spec endpoints against `web/src/mocks/handlers.ts`. For each spec endpoint (method + path), check whether a corresponding handler exists in the file.

```
Handler Coverage
────────────────
  ✅ All [N] spec endpoints have mock handlers.
```

Or if gaps exist:

```
Handler Coverage
────────────────
  ⚠️ [M] of [N] spec endpoints are missing mock handlers:
  - POST /v1/notifications/send
  - GET /v1/reports/{id}/export
```

### Step 3 — Display

Output the assembled status as a single formatted message. This is read-only — do not modify any files.
