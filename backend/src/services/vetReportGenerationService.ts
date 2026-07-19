import OpenAI from 'openai';
import type { ReportType } from '../models/VetReport';
import {
  GROUNDING_RULES,
  extractGrounding,
  sanitizeSections,
  sanitizeOwnerSummary,
  buildStyleDirectives,
  buildStyleReferenceBlock,
  type ReportStyleProfile,
} from './aiGuardrails';

export const REPORT_MODEL = 'gemini-3.1-flash-lite';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Thrown when the model's response can't be parsed as the expected JSON shape. */
export class ReportGenerationError extends Error {
  raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = 'ReportGenerationError';
    this.raw = raw;
  }
}

// response_format: json_object constrains Groq's decoding to syntactically valid JSON,
// so the old regex-based unescaped-newline repair is no longer needed — a markdown-fence
// strip plus a brace-extraction fallback is enough of a safety net.
function extractJSON(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new SyntaxError('No JSON object found in response');
  }
}

// The model occasionally nests an object/array under a key despite instructions;
// flatten anything non-string to its JSON text so every section stays a plain string.
function normalizeToStringMap(parsed: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'string') {
      out[k] = v;
    } else if (v !== null && v !== undefined) {
      out[k] = JSON.stringify(v, null, 2);
    } else {
      out[k] = '';
    }
  }
  return out;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcAge(dob: Date): string {
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''}`;
}

function patientBlock(pet: any): string {
  const age = pet.dateOfBirth ? calcAge(pet.dateOfBirth) : 'unknown';
  return `PATIENT INFORMATION:
- Name: ${pet.name}
- Species/Breed: ${pet.species === 'canine' ? 'Canine' : 'Feline'} / ${pet.breed}
- Sex: ${pet.sex}
- Age: ${age}
- Weight: ${pet.weight} kg
- Allergies: ${(pet.allergies || []).join(', ') || 'None on file'}
- Sterilization: ${pet.sterilization}`;
}

// All vital fields share one vet-authored note (see updateAllVitalNotes in the staged
// modal), so any one of them carries it — pull it out once instead of repeating it
// per vital line in the prompt.
function extractVitalsNotes(vitals: any): string {
  const note = Object.values(vitals || {}).find((v: any) => !!v?.notes) as any;
  return note?.notes || '';
}

function formatVaccinationBlock(vaccinations?: any[]): string {
  if (!vaccinations || vaccinations.length === 0) return 'VACCINATION HISTORY:\n  (none on file)';
  return `VACCINATION HISTORY:\n${vaccinations.map((v) => {
    const date = v.dateAdministered ? new Date(v.dateAdministered).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
    const nextDue = v.nextDueDate ? new Date(v.nextDueDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
    const dose = v.boosterNumber > 0 ? `Booster #${v.boosterNumber}` : `Dose #${v.doseNumber}`;
    return `  - ${v.vaccineName} | ${dose} | Administered: ${date} | Next due: ${nextDue} | Status: ${v.status}`;
  }).join('\n')}`;
}

function isDeceasedRecord(record: any): boolean {
  return record?.emergencyCase?.outcome === 'deceased';
}

const MAX_DETAILED_RECORDS = 15;

function formatRecordSummaryLine(record: any, index: number): string {
  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Unknown date';
  const assessment = (record.assessment || '').slice(0, 160);
  return `VISIT ${index + 1} — ${visitDate}: ${record.chiefComplaint || 'No chief complaint'}${assessment ? ` | Assessment: ${assessment}` : ''}${isDeceasedRecord(record) ? ' | PATIENT OUTCOME: DECEASED' : ''}`;
}

function formatRecordBlock(record: any, index: number): string {
  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `    - ${k}: ${v.value}`)
    .join('\n');
  const vitalsNotes = extractVitalsNotes(record.vitals);
  const medLines = (record.medications || [])
    .map((m: any) => `    - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');
  const testLines = (record.diagnosticTests || [])
    .map((t: any) => `    - [${t.testType}] ${t.name}: Result: ${t.result || 'N/A'}, Normal Range: ${t.normalRange || 'N/A'}${t.notes ? ` — ${t.notes}` : ''}`)
    .join('\n');
  const preventiveLines = (record.preventiveCare || [])
    .map((p: any) => `    - ${p.careType}: ${p.product}${p.notes ? ` — ${p.notes}` : ''}`)
    .join('\n');
  const extras: string[] = [];
  if (record.surgeryRecord?.surgeryType) {
    extras.push(`  Surgery: ${record.surgeryRecord.surgeryType}${record.surgeryRecord.vetRemarks ? ` — ${record.surgeryRecord.vetRemarks}` : ''}`);
  }
  if (record.confinementAction === 'confined') {
    extras.push(`  Confinement: ${record.confinementDays || 0} day(s)`);
  }
  if (isDeceasedRecord(record)) {
    extras.push(`  PATIENT OUTCOME: DECEASED — the patient passed away during or as a result of this visit${record.emergencyCase?.dispositionNotes ? `: ${record.emergencyCase.dispositionNotes}` : ''}. This MUST be stated explicitly wherever this visit is discussed; do not describe ongoing treatment, recovery, or a future prognosis for this visit as if the patient survived.`);
  }
  if (record.immunityTesting?.enabled && record.immunityTesting.rows?.length) {
    const titers = record.immunityTesting.rows
      .map((r: any) => `    - ${r.disease}: Score ${r.score ?? 'N/A'} | ${r.status}${r.action ? ` — ${r.action}` : ''}`)
      .join('\n');
    extras.push(`  Immunity/Titer Testing (${record.immunityTesting.kitName || 'kit'}, ${record.immunityTesting.testDate ? new Date(record.immunityTesting.testDate).toLocaleDateString('en-PH') : 'N/A'}):\n${titers}`);
  }
  if (record.immunityTesting?.antigenEnabled && record.immunityTesting.antigenRows?.length) {
    const antigens = record.immunityTesting.antigenRows
      .map((r: any) => `    - ${r.disease}: ${r.result}`)
      .join('\n');
    extras.push(`  Antigen Testing (${record.immunityTesting.antigenDate ? new Date(record.immunityTesting.antigenDate).toLocaleDateString('en-PH') : 'N/A'}):\n${antigens}`);
  }

  return `VISIT ${index + 1} — ${visitDate}
  Chief Complaint: ${record.chiefComplaint || 'Not specified'}
  Vitals:
${vitalLines || '    (no vitals recorded)'}
  Vitals Notes: ${vitalsNotes || '(none)'}
  SOAP:
    Subjective: ${record.subjective || '(none)'}
    Assessment: ${record.assessment || '(none)'}
    Plan: ${record.plan || '(none)'}
  Visit Summary: ${record.visitSummary || '(none)'}
  Vet Notes: ${record.vetNotes || '(none)'}
  Medications:
${medLines || '    (none)'}
  Diagnostic Tests:
${testLines || '    (none)'}
  Preventive Care:
${preventiveLines || '    (none)'}${extras.length ? '\n' + extras.join('\n') : ''}`;
}

function buildConsolidatedAIPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string,
  vaccinations?: any[]
): string {
  const overflow = Math.max(0, records.length - MAX_DETAILED_RECORDS);
  const summarized = records.slice(0, overflow);
  const detailed = records.slice(overflow);
  const summaryBlock = summarized.length
    ? `EARLIER VISITS (condensed):\n${summarized.map((r, i) => formatRecordSummaryLine(r, i)).join('\n')}\n\n`
    : '';
  const detailBlock = detailed.map((r, i) => formatRecordBlock(r, overflow + i)).join('\n\n');

  return `You are a veterinary medical report writer. Generate a CONSOLIDATED Veterinary Diagnostic Report covering the patient's ${records.length} visit${records.length !== 1 ? 's' : ''} listed below, in chronological order (oldest first). This is a longitudinal case history, not a single-visit report: identify trends across visits and integrate findings across the whole timeline.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}

${summaryBlock}${detailBlock}

${formatVaccinationBlock(vaccinations)}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Generate the consolidated report in the following JSON format. Each value should be a well-written paragraph or structured text suitable for a professional medical report. Use clinical language. Do NOT include markdown headers. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY the JSON object.

{
  "clinicalSummary": "A narrative covering the patient's presentation across all visits: initial presenting signs, how the condition evolved, physical exam findings over time, vital trends (especially weight), and current status.",
  "laboratoryInterpretation": "Interpretation of all diagnostic tests across visits, grouped by test type and ordered chronologically. Highlight changes between repeat tests. If no tests were done, say so briefly.",
  "assessment": "Working diagnoses across the case history, supported by evidence from labs, vitals, and clinical signs over time. Note resolved vs ongoing problems and current status (stable/critical/improving).",
  "managementPlan": "The current treatment and management orders, plus a brief history of prior treatments and the patient's response: medications (with dosages, routes, frequencies), supportive care, monitoring parameters, diet, activity restrictions, and any vaccinations administered or due.",
  "prognosis": "Overall prognosis with supporting rationale based on the full visit history and treatment response. Include outlook with compliance to treatment plan."
}`;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildAIPrompt(
  pet: any,
  record: any,
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string,
  vaccinations?: any[]
): string {
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `  - ${k}: ${v.value}`)
    .join('\n');
  const vitalsNotes = extractVitalsNotes(record.vitals);
  const medLines = (record.medications || [])
    .map((m: any) => `  - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');
  const testLines = (record.diagnosticTests || [])
    .map((t: any) => `  - [${t.testType}] ${t.name}: Result: ${t.result || 'N/A'}, Normal Range: ${t.normalRange || 'N/A'}${t.notes ? ` — ${t.notes}` : ''}`)
    .join('\n');
  const preventiveLines = (record.preventiveCare || [])
    .map((p: any) => `  - ${p.careType}: ${p.product}${p.notes ? ` — ${p.notes}` : ''}`)
    .join('\n');
  const vaccinationLines = formatVaccinationBlock(vaccinations);

  return `You are a veterinary medical report writer. Generate a formal Veterinary Diagnostic Report using the clinical data below.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
CLINIC: ${record.clinicId}

CHIEF COMPLAINT: ${record.chiefComplaint || 'Not specified'}
${isDeceasedRecord(record) ? `\nPATIENT OUTCOME: DECEASED — the patient passed away during or as a result of this visit${record.emergencyCase?.dispositionNotes ? `: ${record.emergencyCase.dispositionNotes}` : ''}. The assessment and prognosis sections MUST state this outcome explicitly. Do NOT describe a management plan, recovery expectations, or forward-looking prognosis as if the patient survived.\n` : ''}
VITALS:
${vitalLines || '  (no vitals recorded)'}

VITALS NOTES: ${vitalsNotes || '(none)'}

SOAP NOTES:
  Subjective: ${record.subjective || '(none)'}
  Assessment: ${record.assessment || '(none)'}
  Plan: ${record.plan || '(none)'}

VISIT SUMMARY: ${record.visitSummary || '(none)'}
VET NOTES: ${record.vetNotes || '(none)'}
OVERALL OBSERVATION: ${record.overallObservation || '(none)'}

MEDICATIONS PRESCRIBED:
${medLines || '  (none)'}

DIAGNOSTIC TESTS:
${testLines || '  (none)'}

PREVENTIVE CARE:
${preventiveLines || '  (none)'}

${vaccinationLines}

PERSISTENT VET NOTES (ongoing notes kept by the vet across all visits for this patient):
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT (provided by the attending vet for this report):
${vetContextNotes || '(none provided)'}

---
Generate the report in the following JSON format. Each value should be a well-written paragraph or structured text suitable for a professional medical report. Use clinical language appropriate for a formal veterinary document. Do NOT include markdown headers. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY the JSON object.

{
  "clinicalSummary": "A narrative paragraph covering the patient's presenting signs, physical exam findings, vital parameter interpretation, body condition, and any notable abnormalities.",
  "laboratoryInterpretation": "Detailed interpretation of all diagnostic tests. If there are blood work results, include a structured interpretation (parameter, result, reference, interpretation). Include hematology if available. Group by test type. If no tests were done, say so briefly.",
  "assessment": "Working diagnoses listed and supported by evidence from labs, vitals, and clinical signs. Include current status (stable/critical/improving).",
  "managementPlan": "All treatment and management orders: confinement, IV fluids, medications (with dosages, routes, frequencies from the prescriptions), supportive care, monitoring parameters, diet, and activity restrictions, and any vaccinations administered or due (name, date, next due date from VACCINATION HISTORY).",
  "prognosis": "Overall prognosis with supporting rationale based on the full visit history and treatment response. Include outlook with compliance to treatment plan."
}`;
}

function buildSoapPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  // Multiple visits → integrated chronological SOAP progress note
  if (records.length > 1) {
    const overflow = Math.max(0, records.length - MAX_DETAILED_RECORDS);
    const summarized = records.slice(0, overflow);
    const detailed = records.slice(overflow);
    const summaryBlock = summarized.length
      ? `EARLIER VISITS (condensed):\n${summarized.map((r, i) => formatRecordSummaryLine(r, i)).join('\n')}\n\n`
      : '';
    const detailBlock = detailed.map((r, i) => formatRecordBlock(r, overflow + i)).join('\n\n');

    return `You are a veterinary medical report writer. Generate an integrated SOAP Progress Note covering the patient's ${records.length} visits listed below, in chronological order (oldest first). Each SOAP section must synthesize the information across ALL visits, referencing visit dates and showing how the case progressed.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}

${summaryBlock}${detailBlock}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Write an integrated SOAP Progress Note spanning all visits. Reference dates where relevant. Do NOT include markdown headers. Avoid em-dashes (—). Output ONLY this JSON object.

{
  "subjective": "The owner's reports and patient history across the visits: initial complaint, how symptoms evolved between visits, and home observations. Present chronologically with dates.",
  "objective": "Objective data across visits: vital parameter trends (note changes between visits), physical examination findings over time, and diagnostic test results in chronological order.",
  "assessment": "The clinical assessment across the case: working diagnoses, how they were confirmed or revised between visits, and the patient's current status (improving/stable/declining).",
  "plan": "The evolving treatment plan: what was prescribed or performed at each visit, the response to treatment, and the current active plan including medications, follow-ups, and monitoring."
}`;
  }

  const record = records[0] || {};
  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `  - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
    .join('\n');
  const medLines = (record.medications || [])
    .map((m: any) => `  - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');
  const testLines = (record.diagnosticTests || [])
    .map((t: any) => `  - [${t.testType}] ${t.name}: Result: ${t.result || 'N/A'}${t.notes ? ` — ${t.notes}` : ''}`)
    .join('\n');

  return `You are a veterinary medical report writer. Generate a SOAP Progress Note for a single veterinary visit.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
VISIT DATE: ${visitDate}

CHIEF COMPLAINT: ${record.chiefComplaint || 'Not specified'}

RECORDED VITALS:
${vitalLines || '  (no vitals recorded)'}

RAW SOAP FROM RECORD:
  Subjective (owner report): ${record.subjective || '(none)'}
  Assessment (vet notes): ${record.assessment || '(none)'}
  Plan (vet plan): ${record.plan || '(none)'}

VISIT SUMMARY: ${record.visitSummary || '(none)'}
VET NOTES: ${record.vetNotes || '(none)'}
OVERALL OBSERVATION: ${record.overallObservation || '(none)'}

MEDICATIONS PRESCRIBED:
${medLines || '  (none)'}

DIAGNOSTIC TESTS:
${testLines || '  (none)'}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Expand the raw SOAP data into a well-written SOAP Progress Note suitable for a formal medical record. Do NOT include markdown headers. Avoid em-dashes (—). Output ONLY this JSON object.

{
  "subjective": "The owner's chief complaint and patient history as reported. Include onset, duration, progression, and any home observations. Write in third-person clinical style.",
  "objective": "All objective data recorded at this visit: vital parameters with interpretation, physical examination findings, body condition, and results of any diagnostic tests performed. Structure clearly.",
  "assessment": "The veterinarian's clinical assessment and working diagnoses, supported by the subjective and objective findings. State primary and differential diagnoses as applicable.",
  "plan": "The complete treatment and management plan: medications prescribed (name, dosage, route, frequency, duration), additional diagnostics ordered, supportive care, diet, activity instructions, and follow-up timeline."
}`;
}

function buildDiagnosticPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  const testBlocks = records.map((r, i) => {
    const visitDate = r.createdAt
      ? new Date(r.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Unknown date';
    const tests = (r.diagnosticTests || [])
      .map((t: any) => `    - [${t.testType}] ${t.name}: Result: ${t.result || 'N/A'}, Normal Range: ${t.normalRange || 'N/A'}${t.notes ? ` — ${t.notes}` : ''}`)
      .join('\n');
    const immunityLines: string[] = [];
    if (r.immunityTesting?.enabled && r.immunityTesting.rows?.length) {
      const titers = r.immunityTesting.rows
        .map((row: any) => `    - ${row.disease}: Score ${row.score ?? 'N/A'} | ${row.status}${row.action ? ` — ${row.action}` : ''}`)
        .join('\n');
      immunityLines.push(`  Immunity/Titer Testing (${r.immunityTesting.kitName || 'kit'}, ${r.immunityTesting.testDate ? new Date(r.immunityTesting.testDate).toLocaleDateString('en-PH') : 'N/A'}):\n${titers}`);
    }
    if (r.immunityTesting?.antigenEnabled && r.immunityTesting.antigenRows?.length) {
      const antigens = r.immunityTesting.antigenRows
        .map((row: any) => `    - ${row.disease}: ${row.result}`)
        .join('\n');
      immunityLines.push(`  Antigen Testing (${r.immunityTesting.antigenDate ? new Date(r.immunityTesting.antigenDate).toLocaleDateString('en-PH') : 'N/A'}):\n${antigens}`);
    }
    const vitalsNotes = extractVitalsNotes(r.vitals);
    return `VISIT ${i + 1} — ${visitDate} (Chief Complaint: ${r.chiefComplaint || 'N/A'})
  Diagnostic Tests:
${tests || '    (no diagnostic tests recorded for this visit)'}
${immunityLines.length ? immunityLines.join('\n') + '\n' : ''}  Vitals Notes: ${vitalsNotes || '(none)'}
  SOAP Assessment: ${r.assessment || '(none)'}
  Overall Observation: ${r.overallObservation || '(none)'}`;
  }).join('\n\n');

  return `You are a veterinary diagnostic report writer. Generate a Diagnostic Test Report based on the tests performed across the visit(s) below.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}

${testBlocks}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Generate a formal Diagnostic Test Report. Write each section as flowing prose or a structured text list — plain text only, no nested JSON. Reference visit dates where relevant. Do NOT include markdown headers. Avoid em-dashes (—). Output ONLY a flat JSON object where every value is a plain string.

{
  "testsSummary": "Plain-text list of all diagnostic tests performed. For each test state: test name, type, date performed, and the clinical indication. Write as a prose paragraph or a simple line-by-line list using hyphens.",
  "resultsInterpretation": "Plain-text interpretation of every test result. State the parameter name, the recorded result, the reference range, and the clinical significance in plain prose. Note any abnormal values explicitly. Do not use nested JSON — write this as a single plain-text block.",
  "clinicalCorrelation": "Prose paragraph integrating the laboratory and imaging findings with the patient's clinical signs, physical examination, and history. Explain how the results support or refine the clinical picture. A vitals table is already shown to the reader elsewhere — do NOT catalog or restate vital readings; mention a vital only if clinically abnormal, described qualitatively, and otherwise draw on each visit's Vitals Notes for context.",
  "recommendations": "Plain-text list of recommended follow-up tests, monitoring intervals, treatment adjustments, or referrals, in order of urgency. Write as prose or a hyphen-separated list."
}`;
}

function buildSurgeryPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  // Prefer records that actually document a surgery; fall back to everything selected
  const surgicalRecords = records.filter((r: any) => r.surgeryRecord?.surgeryType);
  const base = surgicalRecords.length > 0 ? surgicalRecords : records;

  // Multiple surgical visits → one report covering each procedure chronologically
  if (base.length > 1) {
    const blocks = base.map((r: any, i: number) => {
      const d = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Unknown date';
      const vitals = Object.entries(r.vitals || {})
        .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
        .map(([k, v]: any) => `    - ${k}: ${v.value}`)
        .join('\n');
      const vitalsNotes = extractVitalsNotes(r.vitals);
      const meds = (r.medications || [])
        .map((m: any) => `    - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
        .join('\n');
      return `PROCEDURE ${i + 1} — ${d}
  Surgery Type: ${r.surgeryRecord?.surgeryType || '(not specified)'}
  Surgeon Remarks: ${r.surgeryRecord?.vetRemarks || '(none)'}
  Indication / Chief Complaint: ${r.chiefComplaint || 'Not specified'}
  Pre-operative Vitals:
${vitals || '    (no vitals recorded)'}
  Pre-operative Vitals Notes: ${vitalsNotes || '(none)'}
  SOAP Assessment: ${r.assessment || '(none)'}
  SOAP Plan: ${r.plan || '(none)'}
  Medications / Anesthetic Agents:
${meds || '    (none recorded)'}
  Confinement: ${r.confinementAction === 'confined' ? `Yes — ${r.confinementDays || 0} day(s)` : 'None'}`;
    }).join('\n\n');

    return `You are a veterinary surgical report writer. Generate a Surgical and Anesthesia Report covering the ${base.length} procedures listed below, in chronological order (oldest first). Address each procedure within the sections, referencing procedure dates.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}

${blocks}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Generate a formal Surgical and Anesthesia Report covering ALL procedures above. Use clinical language appropriate for a surgical log. Reference each procedure by date. Do NOT include markdown headers. Avoid em-dashes (—). Output ONLY this JSON object.

{
  "preoperativeSummary": "For each procedure: the patient's condition and fitness for anesthesia prior to surgery, relevant history, and indication. Present chronologically by date. Pre-op vital values are already shown in a table elsewhere in the report — do NOT catalog or restate them; mention a value only if clinically abnormal, described qualitatively, and otherwise draw on each procedure's Pre-operative Vitals Notes for context.",
  "surgicalProcedure": "Description of each surgical procedure performed: approach, technique, intraoperative findings, closure, and materials. Cover every procedure by date.",
  "intraoperativeMonitoring": "Vital parameters monitored during each procedure, intraoperative events or interventions, and patient response.",
  "postoperativeCare": "Post-operative recovery, pain management, wound care, post-op medications, dietary restrictions, and activity limitations for each procedure, plus the current active care plan.",
  "complications": "Any complications encountered across the procedures, or findings that warrant monitoring. State 'No intraoperative or post-operative complications noted' if applicable."
}`;
  }

  const record = base[0] || {};
  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `  - ${k}: ${v.value}`)
    .join('\n');
  const vitalsNotes = extractVitalsNotes(record.vitals);
  const medLines = (record.medications || [])
    .map((m: any) => `  - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');

  return `You are a veterinary surgical report writer. Generate a Surgical and Anesthesia Report for the procedure below.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
SURGERY DATE: ${visitDate}

CHIEF COMPLAINT / INDICATION: ${record.chiefComplaint || 'Not specified'}

SURGERY TYPE: ${record.surgeryRecord?.surgeryType || '(not specified)'}
SURGEON REMARKS: ${record.surgeryRecord?.vetRemarks || '(none)'}

PRE-OPERATIVE VITALS:
${vitalLines || '  (no vitals recorded)'}

PRE-OPERATIVE VITALS NOTES: ${vitalsNotes || '(none)'}

SOAP NOTES:
  Subjective: ${record.subjective || '(none)'}
  Assessment: ${record.assessment || '(none)'}
  Plan: ${record.plan || '(none)'}

VISIT SUMMARY: ${record.visitSummary || '(none)'}
VET NOTES: ${record.vetNotes || '(none)'}
OVERALL OBSERVATION: ${record.overallObservation || '(none)'}

MEDICATIONS / ANESTHETIC AGENTS:
${medLines || '  (none recorded)'}

CONFINEMENT: ${record.confinementAction === 'confined' ? `Yes — ${record.confinementDays || 0} day(s)` : 'None'}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Generate a formal Surgical and Anesthesia Report. Use clinical language appropriate for a surgical log. Do NOT include markdown headers. Avoid em-dashes (—). Output ONLY this JSON object.

{
  "preoperativeSummary": "Patient condition and fitness for anesthesia prior to surgery. Include relevant history, physical status, and indication for the procedure. Pre-op vital values are already shown in a table elsewhere in the report — do NOT catalog or restate them; mention a value only if clinically abnormal, described qualitatively, and otherwise draw on PRE-OPERATIVE VITALS NOTES for context.",
  "surgicalProcedure": "Step-by-step description of the surgical procedure performed: patient positioning, surgical approach, technique, findings intraoperatively, closure, and materials used.",
  "intraoperativeMonitoring": "Vital parameters monitored during the procedure, any intraoperative events, interventions, or complications encountered, and patient response.",
  "postoperativeCare": "Immediate post-operative recovery, pain management, wound care instructions, medications prescribed post-op, dietary restrictions, and activity limitations.",
  "complications": "Any complications encountered intraoperatively or post-operatively, or findings that warrant monitoring. State 'No intraoperative or post-operative complications noted' if applicable."
}`;
}

function buildHealthCertificatePrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  const latestRecord = records[records.length - 1] || {};
  const visitDate = latestRecord.createdAt
    ? new Date(latestRecord.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const vitalLines = Object.entries(latestRecord.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `  - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
    .join('\n');
  const preventiveLines = records.flatMap((r) =>
    (r.preventiveCare || []).map((p: any) => {
      const d = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
      return `  - [${d}] ${p.careType}: ${p.product}${p.notes ? ` — ${p.notes}` : ''}`;
    })
  ).join('\n');

  return `You are a veterinary health certificate writer. Generate a formal Veterinary Health Certificate for the patient below.

${patientBlock(pet)}

CERTIFYING VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
EXAMINATION DATE: ${visitDate}

MOST RECENT EXAMINATION VITALS:
${vitalLines || '  (no vitals recorded)'}

MOST RECENT EXAMINATION NOTES:
  Overall Observation: ${latestRecord.overallObservation || '(none)'}
  Assessment: ${latestRecord.assessment || '(none)'}
  Visit Summary: ${latestRecord.visitSummary || '(none)'}

PREVENTIVE CARE HISTORY (all visits):
${preventiveLines || '  (none recorded)'}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT (e.g. destination country, purpose of travel, specific requirements):
${vetContextNotes || '(none provided)'}

---
Generate a formal Veterinary Health Certificate. Use official, certifying language. Do NOT include markdown headers. Avoid em-dashes (—). Output ONLY this JSON object.

{
  "patientHealthStatus": "Official statement of the patient's current health status based on physical examination. Include body condition, absence of clinical signs of communicable disease, and overall fitness assessment.",
  "vaccinationHistory": "Record of vaccinations on file, including vaccine names, dates administered, and current status (up to date / overdue). State clearly if vaccination records are incomplete.",
  "parasiteControl": "Parasite prevention and control measures on record: deworming, flea/tick prevention, heartworm prevention — including products used, dates, and coverage intervals.",
  "travelClearance": "Official veterinary clearance statement certifying the animal is free of signs of infectious or communicable disease, fit for transport, and meets the health requirements stated in the veterinarian context notes."
}`;
}

function buildDischargeSummaryPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  // Discharge instructions are anchored to the most recent visit; earlier selected
  // visits are included as condensed context so the recovery story is complete.
  const record = records[records.length - 1] || {};
  const priorVisits = records.slice(0, -1);
  const priorBlock = priorVisits.length
    ? `\nPRIOR VISITS IN THIS CASE (context):\n${priorVisits.map((r, i) => formatRecordSummaryLine(r, i)).join('\n')}\n`
    : '';

  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `  - ${k}: ${v.value}`)
    .join('\n');
  const vitalsNotes = extractVitalsNotes(record.vitals);
  // Pull medications from every selected visit, not just the discharge visit itself —
  // the medications table shown alongside this report is built the same way, and a med
  // prescribed on an earlier visit in the case is still relevant to send the pet home with.
  const medLines = records
    .flatMap((r: any) => r.medications || [])
    .map((m: any) => `  - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');
  const confinement = record.confinementAction === 'confined'
    ? `Confined for ${record.confinementDays || 0} day(s).`
    : 'Not confined.';

  const deceased = isDeceasedRecord(record);

  return `You are a veterinary discharge summary writer. Generate a Discharge Summary in plain, clear, owner-friendly language for the most recent visit below${priorVisits.length ? ', taking the prior visits into account as case history' : ''}.
${priorBlock}
${deceased ? `\nPATIENT OUTCOME: DECEASED — the patient did not survive this visit${record.emergencyCase?.dispositionNotes ? `: ${record.emergencyCase.dispositionNotes}` : ''}. This is NOT a routine discharge. Every section below MUST reflect this outcome honestly and compassionately: do not write medication, feeding, activity, or follow-up instructions as if the pet is going home. Explain what happened plainly and gently instead.\n` : ''}
${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
DISCHARGE DATE: ${visitDate}

CHIEF COMPLAINT: ${record.chiefComplaint || 'Not specified'}

VITALS AT DISCHARGE:
${vitalLines || '  (no vitals recorded)'}

VITALS NOTES: ${vitalsNotes || '(none)'}

ASSESSMENT / DIAGNOSIS: ${record.assessment || '(none)'}
VISIT SUMMARY: ${record.visitSummary || '(none)'}
VET NOTES: ${record.vetNotes || '(none)'}
OVERALL OBSERVATION: ${record.overallObservation || '(none)'}

MEDICATIONS TO GO HOME WITH:
${medLines || '  (none prescribed)'}

CONFINEMENT: ${confinement}

SOAP PLAN: ${record.plan || '(none)'}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Write a Discharge Summary for the pet owner. Use plain, clear language, no medical jargon unless explained. Address the owner directly. Avoid em-dashes. Do NOT include markdown headers. Output ONLY this JSON object.

{
  "diagnosisSummary": "Plain-language summary of what was found and diagnosed today. Explain the condition simply. What does it mean for the pet's daily life? A vitals table is already shown to the owner elsewhere in the report — do NOT catalog or restate vital readings; mention a vital only if clinically abnormal, described in plain terms, and otherwise draw on VITALS NOTES for context the owner should know.",
  "medications": "For each medication prescribed: what it is called, what it does, how to give it (dose, route, timing with or without food), and for how long. Write as a practical guide for the owner.",
  "feedingInstructions": "Dietary instructions for the recovery period: what to feed, what to avoid, portion sizes, and feeding schedule. If no restrictions, say so clearly.",
  "activityRestrictions": "What the pet can and cannot do during recovery. Include rest requirements, exercise limits, bathing restrictions, and any special handling instructions.",
  "followUpCare": "When to return for a recheck visit, what the veterinarian will check, and what the owner should monitor at home between now and the follow-up.",
  "warningSignsToWatch": "Specific signs that mean the owner should contact the clinic immediately or go to an emergency vet. Be specific and clear — list each sign separately."
}`;
}

function buildReferralLetterPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string,
  vaccinations?: any[]
): string {
  const overflow = Math.max(0, records.length - MAX_DETAILED_RECORDS);
  const summarized = records.slice(0, overflow);
  const detailed = records.slice(overflow);
  const summaryBlock = summarized.length
    ? `EARLIER VISITS (condensed):\n${summarized.map((r, i) => formatRecordSummaryLine(r, i)).join('\n')}\n\n`
    : '';
  const detailBlock = detailed.map((r, i) => formatRecordBlock(r, overflow + i)).join('\n\n');

  const vaccinationBlock = formatVaccinationBlock(vaccinations);

  return `You are a veterinary referral letter writer. Generate a professional Veterinary Referral Letter from the attending veterinarian to a specialist.

${patientBlock(pet)}

REFERRING VETERINARIAN: Dr. ${vet?.firstName || ''} ${vet?.lastName || ''}

${summaryBlock}${detailBlock}

${vaccinationBlock}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT (referral reason, specialist type, specific questions, urgency):
${vetContextNotes || '(none provided)'}

---
Write a formal, professional Veterinary Referral Letter. Address it generically to "Dear Colleague" or "To the Consulting Specialist". Use clinical language. Reference visit dates. Avoid em-dashes (—). Do NOT include markdown headers. Output ONLY this JSON object.

{
  "referralReason": "Clear statement of the primary reason for referral and the specific clinical question or service being requested from the specialist. Include urgency level.",
  "clinicalHistory": "Complete and concise patient history: onset and progression of the primary problem, relevant past medical history, prior diagnostic workup, and owner observations. Reference visit dates.",
  "currentFindings": "Current physical examination findings, most recent vital parameters, and results of diagnostic tests performed to date. Be specific and include values.",
  "treatmentsToDate": "Treatments already attempted: medications (names, dosages, durations), procedures performed, and the patient's response to each. Include what has or has not worked.",
  "referralRequest": "Specific request to the specialist: what type of consultation, workup, or management is being sought. Include any specific questions the referring veterinarian wants answered, and preferred communication method for feedback."
}`;
}

function formatMonitoringEntryBlock(entry: any, index: number): string {
  const when = entry.recordedAt
    ? new Date(entry.recordedAt).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown time';
  const metric = (m: any) => (m?.value !== undefined && m?.value !== null ? `${m.value} ${m.unit || ''}`.trim() : 'N/A');
  return `LOG ${index + 1} — ${when} (${entry.entryType === 'daily' ? 'Daily check' : 'Spot check'}, flag: ${entry.clinicalFlag || 'normal'})
  Temperature: ${metric(entry.temperature)} | Heart Rate: ${metric(entry.heartRate)} | Respiratory Rate: ${metric(entry.respiratoryRate)}
  Weight: ${metric(entry.weight)} | SpO2: ${metric(entry.spo2)} | Blood Glucose: ${metric(entry.bloodGlucose)}
  Body Condition Score: ${metric(entry.bodyConditionScore)} | Pain Score: ${entry.painScore ?? 'N/A'}
  Hydration: ${entry.hydrationStatus || '(not noted)'} | Appetite: ${entry.appetite || '(not noted)'}
  Clinical Notes: ${entry.clinicalNotes || '(none)'}
  Follow-up Action: ${entry.followUpAction || 'watch'}${entry.followUpInHours ? ` (recheck in ${entry.followUpInHours}h)` : ''}${entry.requiresImmediateReview ? ' — FLAGGED FOR IMMEDIATE REVIEW' : ''}`;
}

function buildConfinementPrompt(
  pet: any,
  confinementRecord: any,
  monitoringEntries: any[],
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  const admissionDate = confinementRecord.admissionDate
    ? new Date(confinementRecord.admissionDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const dischargeDate = confinementRecord.dischargeDate
    ? new Date(confinementRecord.dischargeDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const overflow = Math.max(0, records.length - MAX_DETAILED_RECORDS);
  const detailedRecords = records.slice(overflow);
  const recordBlocks = detailedRecords.map((r, i) => formatRecordBlock(r, overflow + i)).join('\n\n');

  const logBlocks = monitoringEntries.map((e, i) => formatMonitoringEntryBlock(e, i)).join('\n\n');

  return `You are a veterinary confinement report writer. Generate a Confinement Report documenting the patient's admission, day-by-day monitoring, and current status during this inpatient stay.

${patientBlock(pet)}

ATTENDING VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
REASON FOR CONFINEMENT: ${confinementRecord.reason || 'Not specified'}
ADMISSION DATE: ${admissionDate}
STATUS: ${confinementRecord.status === 'discharged' ? `Discharged on ${dischargeDate}` : 'Currently confined'}
ADMISSION NOTES: ${confinementRecord.notes || '(none)'}

VISITS / TREATMENTS DURING THIS STAY:
${recordBlocks || '  (no linked medical records)'}

MONITORING LOG (chronological, ${monitoringEntries.length} entr${monitoringEntries.length === 1 ? 'y' : 'ies'}):
${logBlocks || '  (no monitoring entries recorded)'}

PERSISTENT VET NOTES:
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT:
${vetContextNotes || '(none provided)'}

---
Generate the confinement report in the following JSON format. Reference specific log dates/times where relevant so the timeline is traceable. Use clinical language. Do NOT include markdown headers. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY the JSON object.

{
  "admissionSummary": "Why the patient was admitted, presenting condition, and initial findings at admission. Include the admitting diagnosis or working problem list. A vitals table is already shown to the reader elsewhere in the report — do NOT catalog or restate vital readings at admission; mention a value only if clinically abnormal, described qualitatively, and otherwise draw on the linked visit's Vitals Notes for context.",
  "monitoringTimeline": "A chronological narrative of the monitoring log: how vitals and clinical condition trended over the stay, notable abnormal or critical entries with their dates, and how the team responded to each flagged finding.",
  "treatmentsGiven": "All treatments, medications, procedures, and supportive care administered during the stay, drawn from the linked visit records, in chronological order.",
  "currentStatus": "The patient's condition as of the most recent monitoring entry (or at discharge if discharged): stable, improving, critical, or resolved, with supporting vitals/observations.",
  "recommendations": "Next steps: continued monitoring needs, discharge readiness or discharge instructions, follow-up care, and any warning signs to watch for going forward."
}`;
}

function buildHumanizePrompt(
  sections: any,
  petName: string,
  petType: string,
  medications?: HumanizeMedication[],
  reportDate?: string | null
): string {
  const sectionTexts = Object.entries(sections)
    .filter(([, v]) => typeof v === 'string' && (v as string).trim())
    .map(([k, v]) => `${k}:\n"${v}"`)
    .join('\n\n');

  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  // The owner-summary treatment plan is rendered as a structured table/timeline whose clinical
  // columns (dose, schedule, dates, status) come straight from the record — never the model.
  // The model only writes one plain-language "what it does" line per medication, matched by name.
  const medBlock = medications?.length
    ? `\n\nMEDICATIONS (${petName}'s actual prescriptions — write one plain-language explanation for each, matched by exact name):\n` +
      medications
        .map((m, i) => `  ${i + 1}. "${m.name}" — ${m.dosage} via ${m.route}, ${m.frequency}${m.duration ? ` for ${m.duration}` : ''}${fmt(m.endDate) ? ` (course ends ${fmt(m.endDate)})` : ''}`)
        .join('\n')
    : '';

  // Concrete dates the model may reference so the follow-up guidance is specific, not vague.
  // Never invent a date beyond these; if none apply, give the clearest timeframe the report states.
  const treatmentEnds = (medications ?? [])
    .map((m) => fmt(m.endDate))
    .filter((d): d is string => !!d);
  const latestEnd = treatmentEnds.length ? treatmentEnds[treatmentEnds.length - 1] : null;
  const dateBlock = fmt(reportDate) || latestEnd
    ? `\n\nKEY DATES (use these to give a SPECIFIC return/recheck date — do not invent others):${fmt(reportDate) ? `\n  - Report date: ${fmt(reportDate)}` : ''}${latestEnd ? `\n  - Treatment course ends: ${latestEnd}` : ''}`
    : '';

  const treatmentsSchema = medications?.length
    ? `,
  "treatments": [
    ${medications
      .map((m) => `{ "name": "${m.name.replace(/"/g, "'")}", "whatItDoes": "One plain, simple sentence stating what this medication does for ${petName}. Do NOT mention doses, dates, or schedules (those are shown separately)." }`)
      .join(',\n    ')}
  ]`
    : '';

  return `Below is a formal veterinary report for a pet owner. Translate each section into plain language a non-medical pet owner can understand. Keep it honest and clear; do not add reassurance or filler that states no fact. Use "${petName}" or "your ${petType}" naturally throughout.

${sectionTexts || '(no sections available)'}${medBlock}${dateBlock}

---
Rewrite each section in plain language for the pet owner. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY this JSON object:

{
  "whatWeFound": "A plain-language summary of how ${petName} presented and what the vet observed. Explain any abnormal findings simply.",
  "testResultsExplained": "Explain the lab or test results in simple terms. What does each result mean for ${petName}'s health?",
  "theDiagnosis": "State the diagnoses in plain language. What condition does ${petName} have and what does it mean for daily life?",
  "whatsHappeningInTheirBody": "In plain language, explain what is going on inside ${petName}'s body.",
  "theTreatmentPlan": "A short 1-2 sentence intro to the treatment plan for ${petName}. The individual medications are listed separately in the treatments array, so do NOT repeat each one here.",
  "whatToExpect": "In a plain, honest tone, explain what the future looks like for ${petName}, and what to watch out for. When you mention a recheck or return visit, be SPECIFIC about timing: give an actual date (e.g. 'around July 19, when the treatment course finishes') using the KEY DATES above or the interval stated in the report, rather than vague phrases like 'in a few days'. If the report gives no follow-up timing, say so plainly instead of guessing."${treatmentsSchema}
}`;
}

function buildAddendumDraftPrompt(params: {
  reportType: ReportType;
  pet: any;
  vet: any;
  reportTitle: string;
  records: any[];
  updatedSourceCount: number;
  newRecordCount: number;
}): string {
  const { reportType, pet, vet, reportTitle, records, updatedSourceCount, newRecordCount } = params;
  const updatedBlocks = records.length
    ? records.map((record: any, index) => {
        if (record?.changes && Array.isArray(record.changes) && record.changes.length) {
          const when = record.updatedAt
            ? new Date(record.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'Unknown date';
          const details = record.changes
            .map((change: any) => `${change.label || change.field}: ${change.before} -> ${change.after}`)
            .join('; ');
          return `UPDATE ${index + 1} — ${when}: ${details}`;
        }
        return formatRecordSummaryLine(record, index);
      }).join('\n')
    : '(no updated medical records provided)';

  return `You are writing an addendum for a finalized veterinary report.

Report title: ${reportTitle || 'Untitled Report'}
Report type: ${reportType}

PATIENT INFORMATION:
- Name: ${pet?.name || 'Unknown'}
- Species: ${pet?.species || 'Unknown'}
- Breed: ${pet?.breed || 'Unknown'}

ATTENDING VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}

UPDATE CONTEXT:
- New completed visits since last sync: ${newRecordCount}
- Updated linked medical records: ${updatedSourceCount}

UPDATED MEDICAL RECORDS:
${updatedBlocks}

---
Write a concise addendum that only describes the current updated medical-record facts. Do not invent prior values. Do not mention internal database or sync terminology. Keep it suitable for a medico-legal report note. Output ONLY this JSON object:

{
  "text": "A concise addendum describing the correction or updated record facts in complete clinical sentences. Mention dates or record identifiers only when they help the clinician understand what changed."
}`;
}

function buildAddendumValidationPrompt(params: {
  reportType: ReportType;
  pet: any;
  reportTitle: string;
  addendumText: string;
  records: any[];
}): string {
  const { reportType, pet, reportTitle, addendumText, records } = params;
  const recordSummary = records.length
    ? records.map((record, index) => formatRecordBlock(record, index)).join('\n\n')
    : '(no linked medical records provided)';

  return `You are checking whether a proposed addendum matches the current veterinary medical record data.

Report title: ${reportTitle || 'Untitled Report'}
Report type: ${reportType}
Patient: ${pet?.name || 'Unknown'}

CURRENT MEDICAL RECORD DATA:
${recordSummary}

PROPOSED ADDENDUM:
"""
${addendumText}
"""

---
Judge whether the addendum is faithful to the medical record data above. Flag contradictions, unsupported values, missing critical facts, or wording that changes the meaning of the records. If the addendum is accurate but too vague, say so. Output ONLY this JSON object:

{
  "valid": true,
  "confidence": "high",
  "issues": [],
  "suggestedRevision": "",
  "summary": "A short verdict sentence explaining whether the addendum matches the record data."
}`;
}

export async function draftReportAddendum(params: {
  reportType: ReportType;
  pet: any;
  vet: any;
  reportTitle: string;
  records: any[];
  updatedSourceCount: number;
  newRecordCount: number;
}): Promise<string> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI service not configured');
  }

  const prompt = buildAddendumDraftPrompt(params);

  const completion = await openai.chat.completions.create({
    model: REPORT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a veterinary medico-legal report assistant. Output valid JSON only, with a single text field that contains a concise addendum. Do not invent facts.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJSON(raw);
  } catch {
    throw new ReportGenerationError('AI returned an unexpected response. Please try again.', raw);
  }

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
  if (!text) {
    throw new ReportGenerationError('AI returned an empty addendum draft. Please try again.', raw);
  }
  return text;
}

export async function validateReportAddendum(params: {
  reportType: ReportType;
  pet: any;
  reportTitle: string;
  addendumText: string;
  records: any[];
}): Promise<{ valid: boolean; confidence: string; issues: string[]; suggestedRevision: string; summary: string }> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI service not configured');
  }

  const prompt = buildAddendumValidationPrompt(params);

  const completion = await openai.chat.completions.create({
    model: REPORT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a veterinary documentation auditor. Output valid JSON only. Be strict about factual accuracy and unsupported claims.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 1600,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJSON(raw);
  } catch {
    throw new ReportGenerationError('AI returned an unexpected response. Please try again.', raw);
  }

  return {
    valid: Boolean(parsed.valid),
    confidence: typeof parsed.confidence === 'string' ? parsed.confidence : 'unknown',
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
    suggestedRevision: typeof parsed.suggestedRevision === 'string' ? parsed.suggestedRevision : '',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateReportParams {
  reportType: ReportType;
  pet: any;
  vet: any;
  records: any[];
  vetContextNotes: string;
  persistentNotes: string;
  vaccinations?: any[];
  /** Required when reportType === 'confinement'. */
  confinementRecord?: any;
  /** Required when reportType === 'confinement'; chronological monitoring log entries. */
  monitoringEntries?: any[];
  /** Phase 2 vet-style adaptation: the attending vet's explicit style preferences (tone/format only). */
  styleProfile?: ReportStyleProfile | null;
  /** Phase 2 vet-style adaptation: section text from the vet's own past finalized reports (voice only). */
  styleExemplars?: string[];
}

/** Builds the type-specific prompt, calls the model, and returns a flat string-only sections map. */
export async function generateReportSections(params: GenerateReportParams): Promise<Record<string, string>> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI service not configured');
  }

  const { reportType, pet, vet, records, vetContextNotes, persistentNotes, vaccinations, confinementRecord, monitoringEntries, styleProfile, styleExemplars } = params;

  let prompt: string;
  switch (reportType) {
    case 'confinement':
      if (!confinementRecord) {
        throw new Error('confinementRecord is required to generate a confinement report');
      }
      prompt = buildConfinementPrompt(pet, confinementRecord, monitoringEntries || [], records, vet, vetContextNotes, persistentNotes);
      break;

    case 'soap':
      prompt = buildSoapPrompt(pet, records, vet, vetContextNotes, persistentNotes);
      break;
    case 'diagnostic':
      prompt = buildDiagnosticPrompt(pet, records, vet, vetContextNotes, persistentNotes);
      break;
    case 'surgery':
      prompt = buildSurgeryPrompt(pet, records, vet, vetContextNotes, persistentNotes);
      break;
    case 'healthCertificate':
      prompt = buildHealthCertificatePrompt(pet, records, vet, vetContextNotes, persistentNotes);
      break;
    case 'dischargeSummary':
      prompt = buildDischargeSummaryPrompt(pet, records, vet, vetContextNotes, persistentNotes);
      break;
    case 'referralLetter':
      prompt = buildReferralLetterPrompt(pet, records, vet, vetContextNotes, persistentNotes, vaccinations);
      break;
    default:
      prompt = records.length > 1
        ? buildConsolidatedAIPrompt(pet, records, vet, vetContextNotes, persistentNotes, vaccinations)
        : buildAIPrompt(pet, records[0] || {}, vet, vetContextNotes, persistentNotes, vaccinations);
  }

  const completion = await openai.chat.completions.create({
    model: REPORT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert veterinary medical report writer. Structured clinical data (MEDICATIONS PRESCRIBED entries with dosage, route, frequency, and duration; diagnostic test results; vaccination records) is the authoritative prescription record. PERSISTENT VET NOTES and ADDITIONAL VET CONTEXT are supplementary: use them for background and clinical reasoning, but if they conflict with the structured data (for example a different medication duration or dose), follow the structured data and do not restate the conflicting value from the notes. Output ONLY a flat JSON object where every value is a plain text string (a paragraph or structured prose). NEVER use nested objects, arrays, or sub-keys as values — each key maps to exactly one string. No markdown fences, no extra text outside the JSON.' +
          GROUNDING_RULES,
      },
      // Style directives + fact-masked few-shot exemplars are appended AFTER the clean prompt.
      // Grounding is computed from the clean prompt only (below), so exemplar text can never make
      // another patient's numbers count as grounded.
      { role: 'user', content: prompt + buildStyleDirectives(styleProfile) + buildStyleReferenceBlock(styleExemplars || []) },
    ],
    temperature: 0.3,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJSON(raw);
  } catch (parseErr) {
    throw new ReportGenerationError('AI returned an unexpected response. Please try again.', raw);
  }

  // Deterministic guardrails: key-lock to the report type, strip fluff/formatting, and log any
  // numeric value not present in the source. The clean `prompt` (without style exemplars) contains
  // every real number, medication, and date the model was given, so it is the grounding source.
  const medNames = records.flatMap((r: any) => (r.medications || []).map((m: any) => m.name).filter(Boolean));
  const grounding = extractGrounding(prompt, medNames);
  return sanitizeSections(normalizeToStringMap(parsed), reportType, grounding);
}

/** Minimal medication shape the humanize prompt needs to request a per-med explanation. */
export interface HumanizeMedication {
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  /** ISO date the treatment course ends; anchors a specific recheck date in whatToExpect. */
  endDate?: string | null;
}

export interface OwnerSummary {
  whatWeFound: string;
  testResultsExplained: string;
  whatsHappeningInTheirBody: string;
  theDiagnosis: string;
  theTreatmentPlan: string;
  whatToExpect: string;
  /** Plain-language blurbs keyed by exact medication name; empty when no medications supplied. */
  treatments: { name: string; whatItDoes: string }[];
}

/** Translates an already-generated sections map into a plain-language owner summary. */
export async function humanizeReportSections(
  sections: any,
  petName: string,
  petType: string,
  medications?: HumanizeMedication[],
  reportDate?: string | null
): Promise<OwnerSummary> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI service not configured');
  }

  const prompt = buildHumanizePrompt(sections, petName, petType, medications, reportDate);

  const completion = await openai.chat.completions.create({
    model: REPORT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a veterinary health communicator. Your job is to translate formal veterinary diagnostic reports into plain, easy-to-understand language for pet owners who have no medical background. Avoid jargon. Use simple words. Use plain, respectful, non-alarming language; do not add reassurance, encouragement, or filler that states no fact. Output valid JSON only — no markdown fences, no extra text.' +
          GROUNDING_RULES,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';

  let parsed: Record<string, any>;
  try {
    parsed = extractJSON(raw) as Record<string, any>;
  } catch {
    throw new ReportGenerationError('AI returned an unexpected response. Please try again.', raw);
  }

  const treatments = Array.isArray(parsed.treatments)
    ? parsed.treatments
        .filter((t: any) => t && typeof t.name === 'string')
        .map((t: any) => ({ name: String(t.name), whatItDoes: typeof t.whatItDoes === 'string' ? t.whatItDoes : '' }))
    : [];

  const draft: OwnerSummary = {
    whatWeFound: parsed.whatWeFound ?? '',
    testResultsExplained: parsed.testResultsExplained ?? '',
    whatsHappeningInTheirBody: parsed.whatsHappeningInTheirBody ?? '',
    theDiagnosis: parsed.theDiagnosis ?? '',
    theTreatmentPlan: parsed.theTreatmentPlan ?? '',
    whatToExpect: parsed.whatToExpect ?? '',
    treatments,
  };

  // Grounding source: the (vet-approved) clinical sections plus the real medication data and
  // report date. The owner narrative should carry no raw numbers/dates, so any ungrounded number
  // in a sentence marks it as invented and that sentence is dropped by sanitizeOwnerSummary.
  const medNames = (medications || []).map((m) => m.name).filter(Boolean);
  const groundingSource = [
    JSON.stringify(sections ?? {}),
    (medications || []).map((m) => `${m.name} ${m.dosage} ${m.frequency} ${m.duration} ${m.endDate ?? ''}`).join(' '),
    reportDate ?? '',
  ].join(' ');
  return sanitizeOwnerSummary(draft, extractGrounding(groundingSource, medNames));
}
