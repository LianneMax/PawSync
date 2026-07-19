# PawSync AI Generation Architecture (Implemented)

This document summarizes the live AI pipeline currently implemented in backend and frontend.

## 1) End-to-End Pipeline

```mermaid
flowchart TD
  A[Create Vet Report Draft] --> B[POST /vet-reports/:id/generate]
  B --> C[Load Pet, Vet, Records, Notes, Optional Vaccinations/Confinement Logs]
  C --> D[Sanitize vetContextNotes]
  D --> E[Build Prompt by reportType]
  E --> F[Apply Style Adaptation\n(profile + masked exemplars)]
  F --> G[LLM Call: llama-3.3-70b-versatile\nresponse_format=json_object]
  G --> H[Parse + Normalize JSON]
  H --> I[Deterministic Guardrails\n(key lock, strip fluff/format, grounding checks)]
  I --> J[Save sections, mark AI generated, clear ownerSummary]

  J --> K[Finalize + Signature Required]
  K --> L[POST /vet-reports/:id/humanize]
  L --> M[Owner Summary Generation]
  M --> N[Owner Sanitizer (stricter grounding)]
  N --> O[Merge DB-derived treatment rows + AI whatItDoes]
  O --> P[PATCH /vet-reports/:id/share]
  P --> Q[Frozen Snapshot Once Shared]
  Q --> R[Only Addenda Allowed]
```

## 2) Hallucination and Anti-Fluff Guardrails

Guardrails are deterministic and run server-side after model output, before persistence.

- Prompt-level grounding rules are injected for both clinical generation and humanize.
- JSON shape lock is enforced per report type; unknown generated keys are dropped.
- Formatting cleanup removes markdown formatting artifacts and em/en dashes.
- Fluff removal strips content-free reassurance patterns unless the sentence has clinical signal.
- Grounding extracts allowed numeric tokens from source context.
- Clinical mode logs unsupported numeric values but does not silently alter medico-legal content.
- Owner mode drops sentences containing unsupported numeric tokens.
- Vet context note is sanitized before prompt use (control-char stripping, override-phrase neutralization, length cap).
- Structured treatment columns for owner summary are sourced from medical records, not AI.

## 3) Style Adaptation Workflow

Style adaptation is implemented as style-only controls with guardrail backstops:

1. Vet sets style profile in Vet Settings UI.
2. Profile is saved to User.reportStyleProfile.
3. During report generation, backend fetches:
- reportStyleProfile from vet account
- up to 2 recent finalized reports of same reportType
4. Service builds:
- style directives from profile (verbosity, format, reading level, spelling, no-analogies flag, extra notes)
- style reference block from exemplars after factual masking/redaction
5. Prompt appends style directives and masked exemplars.
6. Output still passes deterministic sanitizer and key/grounding checks before save.

Result: tone and structure can adapt, while clinical facts remain grounded to current patient data.

## 4) Current Business Rules (Implemented)

### Lifecycle and Access Rules

| Rule | Enforcement |
|---|---|
| AI generation requires configured API key | generate/humanize endpoints return 503 if missing |
| Finalized report cannot be regenerated | generate endpoint blocks when status=finalized |
| Finalization requires content + vet signature | update endpoint validates non-empty sections and signature |
| Finalized can revert to draft only if not shared | update endpoint allows draft rollback only pre-share |
| Sharing allowed only for finalized reports | share endpoint blocks draft sharing |
| Sharing requires complete owner summary narrative fields | share endpoint validates all owner summary text fields |
| Shared report cannot be unshared | share endpoint blocks shared=false after shared=true |
| Shared report owner summary is locked | humanize and owner-summary patch block post-share |
| Finalized report content is immutable after share | edits/regeneration blocked; corrections go to addenda |
| Addenda only for finalized reports | addenda endpoint blocks non-finalized reports |

### AI Content Rules

| Rule | Enforcement |
|---|---|
| Use grounded facts from supplied context | Prompt rules + grounding sanitizer |
| No extra generated section keys | Report-type key whitelist lock |
| Remove fluff reassurance | Banned sentence pattern stripping with clinical-signal exception |
| Remove markdown/em-dash styling artifacts | formatting sanitizer |
| Owner summary numeric hallucination suppression | owner-mode sentence drop on unsupported numbers |
| Clinical numeric anomalies are auditable | clinical-mode warning logs for unsupported numbers |
| Treatment plan facts stay record-authoritative | owner treatment rows built from DB, AI writes whatItDoes only |
| Vet context cannot easily inject instruction overrides | sanitizeVetContext before prompt injection |

## 5) Endpoint Rule Matrix

| Endpoint | Primary Purpose | Key Gates |
|---|---|---|
| POST /vet-reports/:id/generate | Generate clinical sections | AI configured, report exists, not finalized |
| PUT /vet-reports/:id | Edit report / finalize / unfinalize | finalized lock rules, signature+content required for finalize |
| POST /vet-reports/:id/humanize | Generate owner summary | AI configured, report finalized, not shared |
| PATCH /vet-reports/:id/owner-summary | Manual owner summary edits | finalized required, summary exists, not shared |
| PATCH /vet-reports/:id/share | Share with owner | finalized required, owner summary completeness, one-way share |
| POST /vet-reports/:id/addenda | Post-finalization correction | finalized required; append-only correction path |

## 6) Notes on Scope

- Current grounding checks are primarily token-level for numbers and medication-name support, not full semantic fact verification.
- Vet context is sanitized on generation use; if needed, additional sanitization-at-write can be added where notes are saved.
- Guardrails are deterministic and auditable (no second LLM guard call).
- Owner-mode number grounding exempts digits inside a recognized "Month Day[, Year]" phrase, since the humanize prompt deliberately asks the model to compute a specific recheck/return date from the report date and stated interval; that computed day number won't appear verbatim in the source otherwise, and without the exemption the whole sentence (often carrying a diagnostic-test callback alongside the date) was silently dropped.
- REPORT_MODEL is `llama-3.3-70b-versatile` (Groq) as of 2026-07-19, replacing the deprecated `meta-llama/llama-4-scout-17b-16e-instruct`. On Groq's on-demand tier this model has a daily token budget (TPD) that is noticeably tighter than the old model's; sustained report generation can exhaust it, surfacing as a 502 from the generate/humanize endpoints (`ReportGenerationError`/OpenAI 429). Worth monitoring or moving to a paid Groq tier if generation volume grows.
