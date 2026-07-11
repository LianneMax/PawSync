import { Request, Response } from 'express';
import OpenAI from 'openai';
import VetReport from '../models/VetReport';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import PetNotes from '../models/PetNotes';
import User from '../models/User';
import Vaccination from '../models/Vaccination';
import { createNotification } from '../services/notificationService';
import { sendVetReportShared } from '../services/emailService';
import type { ReportType } from '../models/VetReport';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const VALID_REPORT_TYPES: ReportType[] = [
  'general', 'soap', 'diagnostic', 'surgery', 'healthCertificate', 'dischargeSummary', 'referralLetter',
];

// Post-creation "update with new visits" behavior for these types is still to be decided,
// so sync-records stays disabled for them. Creation with multiple records IS supported —
// their prompt builders handle any number of visits.
const SYNC_DISABLED_REPORT_TYPES: ReportType[] = ['soap', 'surgery', 'dischargeSummary'];

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

function extractJSON(raw: string): Record<string, string> {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  cleaned = cleaned.replace(/"((?:[^"\\]|\\[\s\S])*)"/g, (_match, content: string) => {
    const fixed = content
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${fixed}"`;
  });
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new SyntaxError('No JSON object found in response');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveReportRecordIds(report: any): string[] {
  const ids: string[] = (report.medicalRecordIds || []).map((id: any) =>
    typeof id === 'object' && id?._id ? id._id.toString() : id.toString()
  );
  if (ids.length === 0 && report.medicalRecordId) {
    const legacy = report.medicalRecordId;
    ids.push(typeof legacy === 'object' && legacy?._id ? legacy._id.toString() : legacy.toString());
  }
  return ids;
}

async function findCompletedRecordIdsForPet(petId: any): Promise<string[]> {
  const records = await MedicalRecord.find({ petId, stage: 'completed' })
    .select('_id')
    .lean();
  return records.map((r: any) => r._id.toString());
}

async function countNewRecords(report: any): Promise<number> {
  const includedIds = resolveReportRecordIds(report);
  const since = report.recordsSyncedAt || report.createdAt;
  return MedicalRecord.countDocuments({
    petId: typeof report.petId === 'object' && report.petId?._id ? report.petId._id : report.petId,
    stage: 'completed',
    _id: { $nin: includedIds },
    createdAt: { $gt: since },
  });
}

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

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const createReport = async (req: Request, res: Response) => {
  try {
    const { petId, medicalRecordId, title, reportDate, vetContextNotes, scope, reportType } = req.body;
    const user = req.user!;

    if (!petId) {
      return res.status(400).json({ status: 'ERROR', message: 'petId is required' });
    }

    const validatedReportType: ReportType = VALID_REPORT_TYPES.includes(reportType) ? reportType : 'general';
    const reportScope: 'selected' | 'all' = scope === 'all' ? 'all' : 'selected';

    let recordIds: string[] = [];
    if (reportScope === 'all') {
      recordIds = await findCompletedRecordIdsForPet(petId);
      if (recordIds.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'This pet has no completed medical records yet.' });
      }
    } else {
      const requested: string[] = Array.isArray(req.body.medicalRecordIds)
        ? req.body.medicalRecordIds.map(String)
        : medicalRecordId
          ? [String(medicalRecordId)]
          : [];
      if (requested.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'Select at least one medical record for the report.' });
      }
      const unique = [...new Set(requested)];
      const found = await MedicalRecord.find({ _id: { $in: unique }, petId, stage: 'completed' })
        .select('_id')
        .lean();
      if (found.length !== unique.length) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'One or more selected records do not belong to this pet or are not completed.',
        });
      }
      recordIds = unique;
    }

    // Multiple reports per medical record are allowed (e.g. a SOAP note and a discharge
    // summary for the same visit), but an exact duplicate — same type covering the same
    // record set — is not. 'all'-scope reports auto-cover everything, so one per type per pet.
    if (reportScope === 'all') {
      const existing = await VetReport.findOne({ petId, reportType: validatedReportType, scope: 'all' })
        .select('_id')
        .lean();
      if (existing) {
        return res.status(409).json({
          status: 'ERROR',
          message: `A${validatedReportType === 'general' ? ' general' : ''} report covering all records already exists for this pet. Update that report instead of creating a duplicate.`,
          existingReportId: (existing as any)._id,
        });
      }
    } else {
      const candidates = await VetReport.find({ petId, reportType: validatedReportType })
        .select('medicalRecordId medicalRecordIds scope')
        .lean();
      const targetSet = [...recordIds].sort().join(',');
      const duplicate = candidates.find((c: any) => {
        if (c.scope === 'all') return false; // compared above only when creating 'all'
        const ids: string[] = (c.medicalRecordIds?.length
          ? c.medicalRecordIds
          : c.medicalRecordId ? [c.medicalRecordId] : []
        ).map(String);
        return ids.sort().join(',') === targetSet;
      });
      if (duplicate) {
        return res.status(409).json({
          status: 'ERROR',
          message: 'A report of this type already exists for exactly these medical records.',
          existingReportId: (duplicate as any)._id,
        });
      }
    }

    const isSingleRecordReport = reportScope === 'selected' && recordIds.length === 1;

    let clinicId = user.clinicId;
    let clinicBranchId = user.clinicBranchId;

    if (!clinicId || !clinicBranchId) {
      const mr = await MedicalRecord.findById(recordIds[0]).lean() as any;
      if (mr) {
        clinicId = clinicId || mr.clinicId;
        clinicBranchId = clinicBranchId || mr.clinicBranchId;
      }
    }

    if (!clinicId || !clinicBranchId) {
      const vetUser = await User.findById(user.userId).lean() as any;
      if (vetUser) {
        clinicId = clinicId || vetUser.clinicId;
        clinicBranchId = clinicBranchId || vetUser.clinicBranchId;
      }
    }

    if (!clinicId || !clinicBranchId) {
      return res.status(400).json({ status: 'ERROR', message: 'Unable to determine clinic for this report. Please contact support.' });
    }

    const report = await VetReport.create({
      petId,
      medicalRecordId: (isSingleRecordReport ? recordIds[0] : null) as any,
      medicalRecordIds: recordIds as any,
      scope: reportScope,
      recordsSyncedAt: new Date(),
      reportType: validatedReportType,
      vetId: user.userId,
      clinicId,
      clinicBranchId,
      title: title || '',
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      vetContextNotes: vetContextNotes || '',
      sections: {},
    });

    res.status(201).json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const listReports = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { petId, limit = '20', offset = '0', search, types } = req.query;

    const filter: Record<string, any> = {};
    if (user.userType === 'veterinarian') {
      filter.vetId = user.userId;
    } else {
      filter.clinicId = user.clinicId;
    }
    if (petId) filter.petId = petId;

    // Multi-select report type filter: ?types=soap,diagnostic
    if (typeof types === 'string' && types.trim()) {
      const requested = types.split(',').map((t) => t.trim()).filter((t) => VALID_REPORT_TYPES.includes(t as ReportType));
      if (requested.length > 0) filter.reportType = { $in: requested };
    }

    // Free-text search across report title, pet name, and owner name
    if (typeof search === 'string' && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      const matchingOwners = await User.find({ $or: [{ firstName: rx }, { lastName: rx }] }).select('_id').lean();
      const ownerIds = matchingOwners.map((o: any) => o._id);
      const matchingPets = await Pet.find({
        $or: [{ name: rx }, ...(ownerIds.length ? [{ ownerId: { $in: ownerIds } }] : [])],
      }).select('_id').lean();
      const petIds = matchingPets.map((p: any) => p._id);
      filter.$or = [{ title: rx }, ...(petIds.length ? [{ petId: { $in: petIds } }] : [])];
    }

    const total = await VetReport.countDocuments(filter);
    const reports = await VetReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .populate({
        path: 'petId',
        select: 'name species breed photo ownerId',
        populate: { path: 'ownerId', select: 'firstName lastName' },
      })
      .populate('vetId', 'firstName lastName')
      .lean();

    res.json({ status: 'OK', data: reports, total });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────

export const getReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findById(id)
      .populate('petId', 'name species breed sex dateOfBirth weight photo allergies sterilization microchipNumber')
      .populate('vetId', 'firstName lastName prcLicenseNumber')
      .populate('medicalRecordId')
      .populate('medicalRecordIds', 'chiefComplaint createdAt stage vitals diagnosticTests medications preventiveCare surgeryRecord overallObservation assessment immunityTesting')
      .lean();

    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    const petId = typeof (report as any).petId === 'object' ? (report as any).petId._id : (report as any).petId;
    const [newRecordCount, vaccinations] = await Promise.all([
      countNewRecords(report),
      Vaccination.find({ petId }).sort({ dateAdministered: 1 }).select('vaccineName dateAdministered nextDueDate doseNumber boosterNumber status manufacturer notes').lean(),
    ]);
    res.json({ status: 'OK', data: { ...report, newRecordCount, vaccinations } });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── PUBLIC / SHARED ─────────────────────────────────────────────────────────

export const getSharedReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findOne({ _id: id, sharedWithOwner: true })
      .populate('petId', 'name species breed sex dateOfBirth weight photo allergies sterilization microchipNumber')
      .populate('vetId', 'firstName lastName prcLicenseNumber')
      .populate('medicalRecordIds', 'chiefComplaint createdAt stage vitals diagnosticTests medications preventiveCare surgeryRecord overallObservation assessment immunityTesting')
      .lean();

    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found or not shared' });
    }

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export const updateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, reportDate, vetContextNotes, sections, status, vetSignature } = req.body;

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Finalization gates: a report must have content and a signature before it can be
    // finalized — once finalized it can no longer be deleted, so validate up front.
    if (status === 'finalized' && report.status !== 'finalized') {
      const mergedSections = sections
        ? { ...(report.sections as any), ...sections }
        : (report.sections as any);
      const hasContent = Object.values(mergedSections || {}).some(
        (v) => typeof v === 'string' && v.trim().length > 0
      );
      if (!hasContent) {
        return res.status(400).json({ status: 'ERROR', message: 'Cannot finalize a blank report. Generate or write the report content first.' });
      }
      const effectiveSignature = vetSignature !== undefined ? vetSignature : report.vetSignature;
      if (!effectiveSignature?.url) {
        return res.status(400).json({ status: 'ERROR', message: 'The report must be signed before it can be finalized.' });
      }
    }

    if (title !== undefined) report.title = title;
    if (reportDate !== undefined) report.reportDate = new Date(reportDate);
    if (vetContextNotes !== undefined) report.vetContextNotes = vetContextNotes;
    if (status !== undefined) report.status = status;
    if (vetSignature !== undefined) report.vetSignature = vetSignature;
    if (sections) {
      report.sections = { ...(report.sections as any), ...sections };
      report.markModified('sections');
    }

    await report.save();
    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── DELETE (drafts only) ─────────────────────────────────────────────────────

/**
 * DELETE /vet-reports/:id
 * Finalized reports are medico-legal documents and can never be deleted —
 * only drafts that were never shared with the owner can be removed.
 */
export const deleteReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }
    if (report.status !== 'draft') {
      return res.status(400).json({ status: 'ERROR', message: 'Finalized reports cannot be deleted.' });
    }
    if (report.sharedWithOwner) {
      return res.status(400).json({ status: 'ERROR', message: 'Unshare the report from the owner before deleting it.' });
    }

    await report.deleteOne();
    res.json({ status: 'OK', message: 'Report deleted' });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── SYNC RECORDS ─────────────────────────────────────────────────────────────

export const syncReportRecords = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Update-with-new-visits behavior for these types is still to be decided — disabled for now.
    if (SYNC_DISABLED_REPORT_TYPES.includes((report.reportType as ReportType) || 'general')) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Updating this report type with additional records is not supported yet. Create a new report for the new visit instead.',
      });
    }

    const currentIds = resolveReportRecordIds(report);
    let nextIds: string[];

    if (report.scope === 'all') {
      nextIds = await findCompletedRecordIdsForPet(report.petId);
    } else if (req.body.addNew === true) {
      const since = report.recordsSyncedAt || report.createdAt;
      const newRecords = await MedicalRecord.find({
        petId: report.petId,
        stage: 'completed',
        _id: { $nin: currentIds },
        createdAt: { $gt: since },
      })
        .select('_id')
        .lean();
      nextIds = [...currentIds, ...newRecords.map((r: any) => r._id.toString())];
    } else {
      const addRecordIds: string[] = Array.isArray(req.body.addRecordIds)
        ? req.body.addRecordIds.map(String)
        : [];
      if (addRecordIds.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'addRecordIds (or addNew: true) is required for selected-scope reports.' });
      }
      const unique = [...new Set(addRecordIds)].filter((rid) => !currentIds.includes(rid));
      if (unique.length > 0) {
        const found = await MedicalRecord.find({ _id: { $in: unique }, petId: report.petId, stage: 'completed' })
          .select('_id')
          .lean();
        if (found.length !== unique.length) {
          return res.status(400).json({
            status: 'ERROR',
            message: 'One or more records do not belong to this pet or are not completed.',
          });
        }
      }
      nextIds = [...currentIds, ...unique];
    }

    const added = nextIds.filter((rid) => !currentIds.includes(rid));

    report.medicalRecordIds = nextIds as any;
    report.recordsSyncedAt = new Date();
    if (added.length > 0) {
      if (report.status === 'finalized') report.status = 'draft';
      report.ownerSummary = null;
    }
    await report.save();

    res.json({ status: 'OK', data: report, addedCount: added.length });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── SHARE ────────────────────────────────────────────────────────────────────

export const shareReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { shared } = req.body;

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    // Only finalized reports may be shared with the owner
    if (shared && report.status !== 'finalized') {
      return res.status(400).json({ status: 'ERROR', message: 'Finalize the report before sharing it with the owner.' });
    }

    const wasAlreadyShared = report.sharedWithOwner;
    report.sharedWithOwner = !!shared;
    report.sharedAt = shared ? new Date() : undefined;
    await report.save();

    if (shared && !wasAlreadyShared) {
      try {
        const [pet, vet, clinic] = await Promise.all([
          Pet.findById(report.petId).lean() as any,
          User.findById(report.vetId).select('firstName lastName').lean() as any,
          report.clinicId
            ? (await import('../models/Clinic')).default.findById(report.clinicId).select('name').lean() as any
            : null,
        ]);

        const owner = pet?.ownerId
          ? await User.findById(pet.ownerId).select('email firstName _id').lean() as any
          : null;

        const reportUrl = `${FRONTEND_URL}/reports/${id}`;

        if (owner?.email) {
          sendVetReportShared({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName || 'Pet Owner',
            petName: pet?.name || 'your pet',
            vetName: vet ? `${vet.firstName} ${vet.lastName}` : 'the veterinarian',
            clinicName: clinic?.name || 'the clinic',
            reportDate: report.reportDate,
            reportUrl,
          });
        }

        if (owner?._id) {
          await createNotification(
            owner._id.toString(),
            'medical_record_shared',
            'Diagnostic Report Available',
            `Dr. ${vet ? `${vet.firstName} ${vet.lastName}` : 'your veterinarian'} has shared a diagnostic report for ${pet?.name || 'your pet'}.`,
            { vetReportId: id },
          );
        }
      } catch (notifyErr) {
        console.error('[VetReport] Share notification failed:', notifyErr);
      }
    }

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── LIST SHARED (owner) ──────────────────────────────────────────────────────

export const listSharedReportsForOwner = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;
    const reports = await VetReport.find({ petId, sharedWithOwner: true })
      .sort({ reportDate: -1 })
      .populate('vetId', 'firstName lastName')
      .lean();
    res.json({ status: 'OK', data: reports });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── AI GENERATE ─────────────────────────────────────────────────────────────

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ status: 'ERROR', message: 'OpenAI API key not configured' });
    }

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    const pet = await Pet.findById(report.petId).lean();
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const vet = await User.findById(report.vetId).lean() as any;

    const recordIds = resolveReportRecordIds(report);
    const [records, petNotesDoc] = await Promise.all([
      recordIds.length > 0
        ? MedicalRecord.find({ _id: { $in: recordIds } }).sort({ createdAt: 1 }).lean()
        : Promise.resolve([] as any[]),
      PetNotes.findOne({ petId: report.petId }).lean() as any,
    ]);

    const openai = getOpenAI();
    if (!openai) {
      return res.status(503).json({ status: 'ERROR', message: 'AI service not configured' });
    }

    const persistentNotes = petNotesDoc?.notes || '';
    const contextNotes = report.vetContextNotes;
    const rType = (report.reportType as ReportType) || 'general';

    let prompt: string;
    switch (rType) {
      case 'soap':
        prompt = buildSoapPrompt(pet, records, vet, contextNotes, persistentNotes);
        break;
      case 'diagnostic':
        prompt = buildDiagnosticPrompt(pet, records, vet, contextNotes, persistentNotes);
        break;
      case 'surgery':
        prompt = buildSurgeryPrompt(pet, records, vet, contextNotes, persistentNotes);
        break;
      case 'healthCertificate':
        prompt = buildHealthCertificatePrompt(pet, records, vet, contextNotes, persistentNotes);
        break;
      case 'dischargeSummary':
        prompt = buildDischargeSummaryPrompt(pet, records, vet, contextNotes, persistentNotes);
        break;
      case 'referralLetter': {
        const vaxForReferral = await Vaccination.find({ petId: report.petId }).sort({ dateAdministered: 1 }).select('vaccineName dateAdministered nextDueDate doseNumber boosterNumber status').lean();
        prompt = buildReferralLetterPrompt(pet, records, vet, contextNotes, persistentNotes, vaxForReferral);
        break;
      }
      default:
        prompt = records.length > 1
          ? buildConsolidatedAIPrompt(pet, records, vet, contextNotes, persistentNotes)
          : buildAIPrompt(pet, records[0] || {}, vet, contextNotes, persistentNotes);
    }

    const completion = await openai.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert veterinary medical report writer. Output ONLY a flat JSON object where every value is a plain text string (a paragraph or structured prose). NEVER use nested objects, arrays, or sub-keys as values — each key maps to exactly one string. No markdown fences, no extra text outside the JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    console.log('[generateReport] raw AI response:', raw.slice(0, 500));

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJSON(raw) as Record<string, unknown>;
    } catch (parseErr) {
      console.error('[generateReport] JSON parse failed:', parseErr, '\nraw:', raw);
      return res.status(502).json({
        status: 'ERROR',
        message: 'AI returned an unexpected response. Please try again.',
        raw,
      });
    }

    // Ensure every section value is a plain string — the model sometimes returns nested objects
    const sections: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') {
        sections[k] = v;
      } else if (v !== null && v !== undefined) {
        sections[k] = JSON.stringify(v, null, 2);
      } else {
        sections[k] = '';
      }
    }

    report.sections = sections;
    report.markModified('sections');
    report.isAIGenerated = true;
    report.ownerSummary = null;
    await report.save();

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── AI HUMANIZE (owner summary) ─────────────────────────────────────────────

export const humanizeReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ status: 'ERROR', message: 'OpenAI API key not configured' });
    }

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    if (report.status !== 'finalized') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'The report must be finalized before generating an owner summary.',
      });
    }

    const os = report.ownerSummary as any;
    if (os?.whatWeFound && os?.theDiagnosis && os?.theTreatmentPlan) {
      return res.json({ status: 'OK', data: report });
    }

    const pet = await Pet.findById(report.petId).lean() as any;
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const openai = getOpenAI();
    if (!openai) {
      return res.status(503).json({ status: 'ERROR', message: 'AI service not configured' });
    }

    const petType = pet.species === 'canine' ? 'dog' : 'cat';
    const prompt = buildHumanizePrompt(report.sections, pet.name, petType);

    const completion = await openai.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';

    let parsed: Record<string, string>;
    try {
      parsed = extractJSON(raw);
    } catch {
      return res.status(502).json({
        status: 'ERROR',
        message: 'AI returned an unexpected response. Please try again.',
        raw,
      });
    }

    report.ownerSummary = {
      whatWeFound: parsed.whatWeFound ?? '',
      testResultsExplained: parsed.testResultsExplained ?? '',
      whatsHappeningInTheirBody: parsed.whatsHappeningInTheirBody ?? '',
      theDiagnosis: parsed.theDiagnosis ?? '',
      theTreatmentPlan: parsed.theTreatmentPlan ?? '',
      whatToExpect: parsed.whatToExpect ?? '',
    };
    await report.save();

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};
