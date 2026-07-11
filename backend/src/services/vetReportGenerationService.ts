import OpenAI from 'openai';
import type { ReportType } from '../models/VetReport';

export const REPORT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildAIPrompt(
  pet: any,
  record: any,
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `  - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
    .join('\n');
  const medLines = (record.medications || [])
    .map((m: any) => `  - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');
  const testLines = (record.diagnosticTests || [])
    .map((t: any) => `  - [${t.testType}] ${t.name}: Result: ${t.result || 'N/A'}, Normal Range: ${t.normalRange || 'N/A'}${t.notes ? ` — ${t.notes}` : ''}`)
    .join('\n');
  const preventiveLines = (record.preventiveCare || [])
    .map((p: any) => `  - ${p.careType}: ${p.product}${p.notes ? ` — ${p.notes}` : ''}`)
    .join('\n');

  return `You are a veterinary medical report writer. Generate a formal Veterinary Diagnostic Report using the clinical data below.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
CLINIC: ${record.clinicId}

CHIEF COMPLAINT: ${record.chiefComplaint || 'Not specified'}

VITALS:
${vitalLines || '  (no vitals recorded)'}

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

PERSISTENT VET NOTES (ongoing notes kept by the vet across all visits for this patient):
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT (provided by the attending vet for this report):
${vetContextNotes || '(none provided)'}

---
Generate the report in the following JSON format. Each value should be a well-written paragraph or structured text suitable for a professional medical report. Use clinical language appropriate for a formal veterinary document. Do NOT include markdown headers. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY the JSON object.

{
  "clinicalSummary": "A narrative paragraph covering the patient's presenting signs, physical exam findings, vital parameter interpretation, body condition, and any notable abnormalities.",
  "laboratoryInterpretation": "Detailed interpretation of all diagnostic tests. If there are blood work results, include a structured interpretation (parameter, result, reference, interpretation). Include hematology if available. Group by test type. If no tests were done, say so briefly.",
  "diagnosticIntegration": "A summary table-style text integrating all body systems examined: System | Findings | Interpretation. Cover Cardiac, Respiratory, Hepatic, Renal, Metabolic, Oral/Inflammatory as applicable based on available data.",
  "assessment": "Working diagnoses listed and supported by evidence from labs, vitals, and clinical signs. Include current status (stable/critical/improving).",
  "managementPlan": "All treatment and management orders: confinement, IV fluids, medications (with dosages, routes, frequencies from the prescriptions), supportive care, monitoring parameters, diet, and activity restrictions.",
  "prognosis": "Overall prognosis with supporting rationale based on findings. Include outlook with compliance to treatment plan."
}`;
}

const MAX_DETAILED_RECORDS = 15;

function formatRecordBlock(record: any, index: number): string {
  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const vitalLines = Object.entries(record.vitals || {})
    .filter(([, v]: any) => v?.value !== undefined && v?.value !== '' && v?.value !== null)
    .map(([k, v]: any) => `    - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
    .join('\n');
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
  if (record.emergencyCase?.isEmergency) {
    extras.push(`  Emergency case: triage ${record.emergencyCase.triageLevel || 'unspecified'}, outcome ${record.emergencyCase.outcome || 'unspecified'}`);
  }
  if (record.pregnancyRecord?.isPregnant) {
    extras.push(`  Pregnancy: confirmed via ${record.pregnancyRecord.confirmationMethod}, due ${record.pregnancyRecord.expectedDueDate ? new Date(record.pregnancyRecord.expectedDueDate).toDateString() : 'unknown'}`);
  }
  if (record.confinementAction === 'confined') {
    extras.push(`  Confinement: ${record.confinementDays || 0} day(s)`);
  }
  const immunity = record.immunityTesting;
  if (immunity?.enabled && immunity.rows?.length) {
    const titers = immunity.rows
      .map((r: any) => `    - ${r.disease}: Score ${r.score ?? 'N/A'} | ${r.status}${r.action ? ` — ${r.action}` : ''}`)
      .join('\n');
    extras.push(`  Immunity/Titer Testing (${immunity.kitName || 'kit'}, ${immunity.testDate ? new Date(immunity.testDate).toLocaleDateString('en-PH') : 'N/A'}):\n${titers}`);
  }
  if (immunity?.antigenEnabled && immunity.antigenRows?.length) {
    const antigens = immunity.antigenRows
      .map((r: any) => `    - ${r.disease}: ${r.result}`)
      .join('\n');
    extras.push(`  Antigen Testing (${immunity.antigenDate ? new Date(immunity.antigenDate).toLocaleDateString('en-PH') : 'N/A'}):\n${antigens}`);
  }
  return `VISIT ${index + 1} — ${visitDate}
  Chief Complaint: ${record.chiefComplaint || 'Not specified'}
  Vitals:
${vitalLines || '    (no vitals recorded)'}
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

function formatRecordSummaryLine(record: any, index: number): string {
  const visitDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Unknown date';
  const assessment = (record.assessment || '').slice(0, 160);
  return `VISIT ${index + 1} — ${visitDate}: ${record.chiefComplaint || 'No chief complaint'}${assessment ? ` | Assessment: ${assessment}` : ''}`;
}

function buildConsolidatedAIPrompt(
  pet: any,
  records: any[],
  vet: any,
  vetContextNotes: string,
  persistentVetNotes: string
): string {
  const overflow = Math.max(0, records.length - MAX_DETAILED_RECORDS);
  const summarized = records.slice(0, overflow);
  const detailed = records.slice(overflow);
  const summaryBlock = summarized.length
    ? `EARLIER VISITS (condensed):\n${summarized.map((r, i) => formatRecordSummaryLine(r, i)).join('\n')}\n\n`
    : '';
  const detailBlock = detailed.map((r, i) => formatRecordBlock(r, overflow + i)).join('\n\n');

  return `You are a veterinary medical report writer. Generate a CONSOLIDATED Veterinary Diagnostic Report covering the patient's ${records.length} visit${records.length !== 1 ? 's' : ''} listed below, in chronological order (oldest first). This is a longitudinal case history, not a single-visit report: identify trends across visits (weight changes, recurring complaints, response to treatment, disease progression or resolution) and integrate findings across the whole timeline.

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}

${summaryBlock}${detailBlock}

PERSISTENT VET NOTES (ongoing notes kept by the vet across all visits for this patient):
${persistentVetNotes || '(none on file)'}

ADDITIONAL VET CONTEXT (provided by the attending vet for this report):
${vetContextNotes || '(none provided)'}

---
Generate the consolidated report in the following JSON format. Each value should be a well-written paragraph or structured text suitable for a professional medical report. Use clinical language. Reference visits by date where relevant. Do NOT include markdown headers. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY the JSON object.

{
  "clinicalSummary": "A narrative covering the patient's presentation across all visits: initial presenting signs, how the condition evolved, physical exam findings over time, vital trends (especially weight), and current status.",
  "laboratoryInterpretation": "Interpretation of all diagnostic tests across visits, grouped by test type and ordered chronologically. Highlight changes between repeat tests. If no tests were done, say so briefly.",
  "diagnosticIntegration": "A summary table-style text integrating all body systems examined across the visit history: System | Findings | Interpretation. Note where findings changed between visits.",
  "assessment": "Working diagnoses across the case history, supported by evidence from labs, vitals, and clinical signs over time. Note resolved vs ongoing problems and current status (stable/critical/improving).",
  "managementPlan": "The current treatment and management orders, plus a brief history of prior treatments and the patient's response: medications (with dosages, routes, frequencies), supportive care, monitoring parameters, diet, and activity restrictions.",
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
    return `VISIT ${i + 1} — ${visitDate} (Chief Complaint: ${r.chiefComplaint || 'N/A'})
  Diagnostic Tests:
${tests || '    (no diagnostic tests recorded for this visit)'}
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
  "clinicalCorrelation": "Prose paragraph integrating the laboratory and imaging findings with the patient's clinical signs, physical examination, and history. Explain how the results support or refine the clinical picture.",
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
        .map(([k, v]: any) => `    - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
        .join('\n');
      const meds = (r.medications || [])
        .map((m: any) => `    - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
        .join('\n');
      return `PROCEDURE ${i + 1} — ${d}
  Surgery Type: ${r.surgeryRecord?.surgeryType || '(not specified)'}
  Surgeon Remarks: ${r.surgeryRecord?.vetRemarks || '(none)'}
  Indication / Chief Complaint: ${r.chiefComplaint || 'Not specified'}
  Pre-operative Vitals:
${vitals || '    (no vitals recorded)'}
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
  "preoperativeSummary": "For each procedure: the patient's condition and fitness for anesthesia prior to surgery, relevant history, pre-op vitals, and indication. Present chronologically by date.",
  "anesthesiaProtocol": "Anesthetic agents used per procedure (pre-medication, induction, maintenance), dosages, routes, and monitoring parameters. Note any changes in protocol between procedures.",
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
    .map(([k, v]: any) => `  - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
    .join('\n');
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
  "preoperativeSummary": "Patient condition and fitness for anesthesia prior to surgery. Include relevant history, physical status, pre-op vitals, and indication for the procedure.",
  "anesthesiaProtocol": "Anesthetic agents used (pre-medication, induction, maintenance), dosages, routes, and monitoring parameters. Include any considerations specific to this patient.",
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
    .map(([k, v]: any) => `  - ${k}: ${v.value}${v.notes ? ` (${v.notes})` : ''}`)
    .join('\n');
  const medLines = (record.medications || [])
    .map((m: any) => `  - ${m.name} ${m.dosage} via ${m.route}, ${m.frequency} for ${m.duration}${m.notes ? ` — ${m.notes}` : ''}`)
    .join('\n');
  const confinement = record.confinementAction === 'confined'
    ? `Confined for ${record.confinementDays || 0} day(s).`
    : 'Not confined.';

  return `You are a veterinary discharge summary writer. Generate a Discharge Summary in plain, warm, owner-friendly language for the most recent visit below${priorVisits.length ? ', taking the prior visits into account as case history' : ''}.
${priorBlock}

${patientBlock(pet)}

VETERINARIAN: ${vet?.firstName || ''} ${vet?.lastName || ''}
DISCHARGE DATE: ${visitDate}

CHIEF COMPLAINT: ${record.chiefComplaint || 'Not specified'}

VITALS AT DISCHARGE:
${vitalLines || '  (no vitals recorded)'}

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
Write a Discharge Summary for the pet owner. Use plain, caring language — no medical jargon unless explained. Address the owner directly. Avoid em-dashes (—). Do NOT include markdown headers. Output ONLY this JSON object.

{
  "diagnosisSummary": "Plain-language summary of what was found and diagnosed today. Explain the condition simply. What does it mean for the pet's daily life?",
  "medications": "For each medication prescribed: what it is called, what it does, how to give it (dose, route, timing with or without food), and for how long. Write as a practical guide for the owner.",
  "feedingInstructions": "Dietary instructions for the recovery period: what to feed, what to avoid, portion sizes, and feeding schedule. If no restrictions, say so clearly and reassuringly.",
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

  const vaccinationBlock = vaccinations && vaccinations.length > 0
    ? `VACCINATION HISTORY:\n${vaccinations.map((v) => {
        const date = v.dateAdministered ? new Date(v.dateAdministered).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        const nextDue = v.nextDueDate ? new Date(v.nextDueDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        const dose = v.boosterNumber > 0 ? `Booster #${v.boosterNumber}` : `Dose #${v.doseNumber}`;
        return `  - ${v.vaccineName} | ${dose} | Administered: ${date} | Next due: ${nextDue} | Status: ${v.status}`;
      }).join('\n')}`
    : 'VACCINATION HISTORY:\n  (none on file)';

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

function buildHumanizePrompt(sections: any, petName: string, petType: string): string {
  const sectionTexts = Object.entries(sections)
    .filter(([, v]) => typeof v === 'string' && (v as string).trim())
    .map(([k, v]) => `${k}:\n"${v}"`)
    .join('\n\n');

  return `Below is a formal veterinary report for a pet owner. Translate each section into plain, friendly language a non-medical pet owner can understand. Keep it honest but compassionate. Use "${petName}" or "your ${petType}" naturally throughout.

${sectionTexts || '(no sections available)'}

---
Rewrite each section in plain language for the pet owner. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY this JSON object:

{
  "whatWeFound": "A warm, plain-language summary of how ${petName} presented and what the vet observed. Explain any abnormal findings simply.",
  "testResultsExplained": "Explain the lab or test results in simple terms. What does each result mean for ${petName}'s health? Use a conversational tone.",
  "whatsHappeningInTheirBody": "In plain language, explain what is going on inside ${petName}'s body. Use an analogy if it helps.",
  "theDiagnosis": "State the diagnoses in plain language. What condition does ${petName} have and what does it mean for daily life?",
  "theTreatmentPlan": "List each medication or treatment and what it does for ${petName} in simple terms. Make it feel like a care guide.",
  "whatToExpect": "In a warm, honest tone, explain what the future looks like for ${petName}. What should the owner watch out for? End on a hopeful but realistic note."
}`;
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
}

/** Builds the type-specific prompt, calls the model, and returns a flat string-only sections map. */
export async function generateReportSections(params: GenerateReportParams): Promise<Record<string, string>> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI service not configured');
  }

  const { reportType, pet, vet, records, vetContextNotes, persistentNotes, vaccinations } = params;

  let prompt: string;
  switch (reportType) {
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
        ? buildConsolidatedAIPrompt(pet, records, vet, vetContextNotes, persistentNotes)
        : buildAIPrompt(pet, records[0] || {}, vet, vetContextNotes, persistentNotes);
  }

  const completion = await openai.chat.completions.create({
    model: REPORT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert veterinary medical report writer. Structured clinical data (MEDICATIONS PRESCRIBED entries with dosage, route, frequency, and duration; diagnostic test results; vaccination records) is the authoritative prescription record. PERSISTENT VET NOTES and ADDITIONAL VET CONTEXT are supplementary: use them for background and clinical reasoning, but if they conflict with the structured data (for example a different medication duration or dose), follow the structured data and do not restate the conflicting value from the notes. Output ONLY a flat JSON object where every value is a plain text string (a paragraph or structured prose). NEVER use nested objects, arrays, or sub-keys as values — each key maps to exactly one string. No markdown fences, no extra text outside the JSON.',
      },
      { role: 'user', content: prompt },
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

  return normalizeToStringMap(parsed);
}

export interface OwnerSummary {
  whatWeFound: string;
  testResultsExplained: string;
  whatsHappeningInTheirBody: string;
  theDiagnosis: string;
  theTreatmentPlan: string;
  whatToExpect: string;
}

/** Translates an already-generated sections map into a plain-language owner summary. */
export async function humanizeReportSections(sections: any, petName: string, petType: string): Promise<OwnerSummary> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI service not configured');
  }

  const prompt = buildHumanizePrompt(sections, petName, petType);

  const completion = await openai.chat.completions.create({
    model: REPORT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a compassionate veterinary health communicator. Your job is to translate formal veterinary diagnostic reports into plain, warm, easy-to-understand language for pet owners who have no medical background. Avoid jargon. Use simple words. Always reassure where appropriate without downplaying serious findings. Output valid JSON only — no markdown fences, no extra text.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';

  let parsed: Record<string, string>;
  try {
    parsed = extractJSON(raw) as Record<string, string>;
  } catch {
    throw new ReportGenerationError('AI returned an unexpected response. Please try again.', raw);
  }

  return {
    whatWeFound: parsed.whatWeFound ?? '',
    testResultsExplained: parsed.testResultsExplained ?? '',
    whatsHappeningInTheirBody: parsed.whatsHappeningInTheirBody ?? '',
    theDiagnosis: parsed.theDiagnosis ?? '',
    theTreatmentPlan: parsed.theTreatmentPlan ?? '',
    whatToExpect: parsed.whatToExpect ?? '',
  };
}
