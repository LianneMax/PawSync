import { Request, Response } from 'express';
import OpenAI from 'openai';
import VetReport from '../models/VetReport';
import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import User from '../models/User';
import { createNotification } from '../services/notificationService';
import { sendVetReportShared } from '../services/emailService';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
  // Strip markdown code fences if present
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Escape bare control characters (newlines, tabs, carriage returns) that appear
  // inside JSON string literals — the AI sometimes outputs them unescaped
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

function calcAge(dob: Date): string {
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''}`;
}

function buildHumanizePrompt(sections: any, petName: string, petType: string): string {
  return `Below is a formal veterinary diagnostic report for a pet owner. Translate each section into plain, friendly language a non-medical pet owner can understand. Keep it honest but compassionate. Use "${petName}" or "your ${petType}" naturally throughout.

Clinical Summary:
"${sections.clinicalSummary || '(not available)'}"

Laboratory Interpretation:
"${sections.laboratoryInterpretation || '(not available)'}"

Diagnostic Integration:
"${sections.diagnosticIntegration || '(not available)'}"

Assessment:
"${sections.assessment || '(not available)'}"

Management Plan:
"${sections.managementPlan || '(not available)'}"

Prognosis:
"${sections.prognosis || '(not available)'}"

---
Rewrite each section in plain language for the pet owner. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY this JSON object:

{
  "whatWeFound": "A warm, plain-language summary of how ${petName} presented and what the vet observed. Explain any abnormal findings simply.",
  "testResultsExplained": "Explain the lab results in simple terms. What does each result mean for ${petName}'s health? Use a conversational tone.",
  "whatsHappeningInTheirBody": "In plain language, explain what is going on inside ${petName}'s body. Use an analogy if it helps.",
  "theDiagnosis": "State the diagnoses in plain language. What condition does ${petName} have and what does it mean for daily life?",
  "theTreatmentPlan": "List each medication and what it does for ${petName} in simple terms. Make it feel like a care guide.",
  "whatToExpect": "In a warm, honest tone, explain what the future looks like for ${petName}. What should the owner watch out for? End on a hopeful but realistic note."
}`;
}

function buildAIPrompt(
  pet: any,
  record: any,
  vet: any,
  vetContextNotes: string
): string {
  const age = pet.dateOfBirth ? calcAge(pet.dateOfBirth) : 'unknown';

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

PATIENT INFORMATION:
- Name: ${pet.name}
- Species/Breed: ${pet.species === 'canine' ? 'Canine' : 'Feline'} / ${pet.breed}
- Sex: ${pet.sex}
- Age: ${age}
- Weight: ${pet.weight} kg
- Allergies: ${(pet.allergies || []).join(', ') || 'None on file'}
- Sterilization: ${pet.sterilization}

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

ADDITIONAL VET CONTEXT (provided by the attending vet):
${vetContextNotes || '(none provided)'}

---
Generate the report in the following JSON format. Each value should be a well-written paragraph or structured text suitable for a professional medical report. Use clinical language appropriate for a formal veterinary document. Do NOT include markdown headers — the frontend will add those. Avoid em-dashes (—); use commas, semicolons, or regular hyphens instead. Output ONLY the JSON object.

{
  "clinicalSummary": "A narrative paragraph covering the patient's presenting signs, physical exam findings, vital parameter interpretation, body condition, and any notable abnormalities.",
  "laboratoryInterpretation": "Detailed interpretation of all diagnostic tests. If there are blood work results, include a structured interpretation (parameter, result, reference, interpretation). Include hematology if available. Group by test type. If no tests were done, say so briefly.",
  "diagnosticIntegration": "A summary table-style text integrating all body systems examined: System | Findings | Interpretation. Cover Cardiac, Respiratory, Hepatic, Renal, Metabolic, Oral/Inflammatory as applicable based on available data.",
  "assessment": "Working diagnoses listed and supported by evidence from labs, vitals, and clinical signs. Include current status (stable/critical/improving).",
  "managementPlan": "All treatment and management orders: confinement, IV fluids, medications (with dosages, routes, frequencies from the prescriptions), supportive care, monitoring parameters, diet, and activity restrictions.",
  "prognosis": "Overall prognosis with supporting rationale based on findings. Include outlook with compliance to treatment plan."
}`;
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const createReport = async (req: Request, res: Response) => {
  try {
    const { petId, medicalRecordId, title, reportDate, vetContextNotes } = req.body;
    const user = req.user!;

    if (!petId) {
      return res.status(400).json({ status: 'ERROR', message: 'petId is required' });
    }

    // Prevent duplicate reports for the same medical record
    if (medicalRecordId) {
      const existing = await VetReport.findOne({ medicalRecordId }).lean();
      if (existing) {
        return res.status(409).json({
          status: 'ERROR',
          message: 'A report already exists for this medical record.',
          existingReportId: (existing as any)._id,
        });
      }
    }

    // Resolve clinicId / clinicBranchId: prefer JWT, then medical record, then vet's User record
    let clinicId = user.clinicId;
    let clinicBranchId = user.clinicBranchId;

    if (!clinicId || !clinicBranchId) {
      if (medicalRecordId) {
        const mr = await MedicalRecord.findById(medicalRecordId).lean() as any;
        if (mr) {
          clinicId = clinicId || mr.clinicId;
          clinicBranchId = clinicBranchId || mr.clinicBranchId;
        }
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
      medicalRecordId: medicalRecordId || null,
      vetId: user.userId,
      clinicId,
      clinicBranchId,
      title: title || '',
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      vetContextNotes: vetContextNotes || '',
      sections: {
        clinicalSummary: '',
        laboratoryInterpretation: '',
        diagnosticIntegration: '',
        assessment: '',
        managementPlan: '',
        prognosis: '',
      },
    });

    res.status(201).json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

export const listReports = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { petId, limit = '20', offset = '0' } = req.query;

    const filter: Record<string, any> = {};
    if (user.userType === 'veterinarian') {
      filter.vetId = user.userId;
    } else {
      // clinic-admin / clinic-admin
      filter.clinicId = user.clinicId;
    }
    if (petId) filter.petId = petId;

    const total = await VetReport.countDocuments(filter);
    const reports = await VetReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .populate('petId', 'name species breed photo')
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
      .populate('petId', 'name species breed sex dateOfBirth weight photo allergies sterilization')
      .populate('vetId', 'firstName lastName prcLicenseNumber')
      .populate('medicalRecordId')
      .lean();

    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    res.json({ status: 'OK', data: report });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

// ─── PUBLIC / SHARED ─────────────────────────────────────────────────────────

export const getSharedReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await VetReport.findOne({ _id: id, sharedWithOwner: true })
      .populate('petId', 'name species breed sex dateOfBirth weight photo')
      .populate('vetId', 'firstName lastName prcLicenseNumber')
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
    const { title, reportDate, vetContextNotes, sections, status } = req.body;

    const report = await VetReport.findById(id);
    if (!report) {
      return res.status(404).json({ status: 'ERROR', message: 'Report not found' });
    }

    if (title !== undefined) report.title = title;
    if (reportDate !== undefined) report.reportDate = new Date(reportDate);
    if (vetContextNotes !== undefined) report.vetContextNotes = vetContextNotes;
    if (status !== undefined) report.status = status;
    if (sections) {
      report.sections = { ...report.sections, ...sections };
    }

    await report.save();
    res.json({ status: 'OK', data: report });
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

    const wasAlreadyShared = report.sharedWithOwner;
    report.sharedWithOwner = !!shared;
    report.sharedAt = shared ? new Date() : undefined;
    await report.save();

    // Send email + in-app notification only when newly sharing (not on unshare)
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
        // Non-fatal
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

    // Load medical record if linked
    let record: any = {};
    if (report.medicalRecordId) {
      record = await MedicalRecord.findById(report.medicalRecordId).lean() || {};
    }

    const openai = getOpenAI();
    if (!openai) {
      return res.status(503).json({ status: 'ERROR', message: 'AI service not configured' });
    }

    const prompt = buildAIPrompt(pet, record, vet, report.vetContextNotes);

    const completion = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert veterinary medical report writer. Always output valid JSON only — no markdown fences, no extra text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    console.log('[generateReport] raw AI response:', raw.slice(0, 500));

    let sections: Record<string, string>;
    try {
      sections = extractJSON(raw);
    } catch (parseErr) {
      console.error('[generateReport] JSON parse failed:', parseErr, '\nraw:', raw);
      return res.status(502).json({
        status: 'ERROR',
        message: 'AI returned an unexpected response. Please try again.',
        raw,
      });
    }

    report.sections = {
      clinicalSummary: sections.clinicalSummary ?? '',
      laboratoryInterpretation: sections.laboratoryInterpretation ?? '',
      diagnosticIntegration: sections.diagnosticIntegration ?? '',
      assessment: sections.assessment ?? '',
      managementPlan: sections.managementPlan ?? '',
      prognosis: sections.prognosis ?? '',
    };
    report.isAIGenerated = true;
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
      model: 'llama-3.3-70b-versatile',
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
