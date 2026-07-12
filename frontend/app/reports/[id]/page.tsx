import {
  PawPrint,
  Search,
  Activity,
  Heart,
  FileText,
  CheckCircle2,
  TrendingUp,
  Stethoscope,
  FlaskConical,
  ClipboardList,
  Pill,
  Scissors,
  AlertTriangle,
  CalendarDays,
  Shield,
  Mail,
  ChevronDown,
} from 'lucide-react'
import { ReportActions } from './ReportActions'
import OwnerTreatmentTimeline from '@/components/OwnerTreatmentTimeline'
import { formatReportDate, getSectionKeys, getSectionLabels, REPORT_TYPE_DOCUMENT_TITLES, getSharedReport } from '@/lib/vetReports'
import type { VetReport, OwnerSummary, LinkedRecord, VaccinationRecord } from '@/lib/vetReports'

async function fetchSharedReport(id: string): Promise<VetReport | null> {
  try {
    return await getSharedReport(id)
  } catch {
    return null
  }
}

function calcAge(dob: string): string {
  const diff = Date.now() - new Date(dob).getTime()
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''} & ${months} month${months !== 1 ? 's' : ''}`
}

const fmtRDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'

const OWNER_SUMMARY_CONFIG = [
  { key: 'whatWeFound' as keyof OwnerSummary, label: 'What We Found', Icon: Search, bg: 'bg-blue-50', border: 'border-blue-200', ic: 'text-blue-600', tc: 'text-blue-800' },
  { key: 'testResultsExplained' as keyof OwnerSummary, label: 'Test Results Explained', Icon: Activity, bg: 'bg-purple-50', border: 'border-purple-200', ic: 'text-purple-600', tc: 'text-purple-800' },
  { key: 'theDiagnosis' as keyof OwnerSummary, label: 'The Diagnosis', Icon: FileText, bg: 'bg-rose-50', border: 'border-rose-200', ic: 'text-rose-600', tc: 'text-rose-800' },
  { key: 'whatsHappeningInTheirBody' as keyof OwnerSummary, label: "What's Happening in Their Body", Icon: Heart, bg: 'bg-amber-50', border: 'border-amber-200', ic: 'text-amber-600', tc: 'text-amber-800' },
  { key: 'theTreatmentPlan' as keyof OwnerSummary, label: 'The Treatment Plan', Icon: CheckCircle2, bg: 'bg-green-50', border: 'border-green-200', ic: 'text-green-600', tc: 'text-green-800' },
  { key: 'whatToExpect' as keyof OwnerSummary, label: 'What to Expect', Icon: TrendingUp, bg: 'bg-indigo-50', border: 'border-indigo-200', ic: 'text-indigo-600', tc: 'text-indigo-800' },
]

const SECTION_ICONS: Record<string, React.ReactNode> = {
  // general
  clinicalSummary:          <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  laboratoryInterpretation: <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  diagnosticIntegration:    <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  assessment:               <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  managementPlan:           <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  prognosis:                <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
  // soap
  subjective:               <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  objective:                <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  plan:                     <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  // diagnostic
  testsSummary:             <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  resultsInterpretation:    <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  clinicalCorrelation:      <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  recommendations:          <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  // surgery
  preoperativeSummary:      <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  anesthesiaProtocol:       <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  surgicalProcedure:        <Scissors className="w-4 h-4 text-[#5A7C7A]" />,
  intraoperativeMonitoring: <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  postoperativeCare:        <Heart className="w-4 h-4 text-[#5A7C7A]" />,
  complications:            <AlertTriangle className="w-4 h-4 text-[#5A7C7A]" />,
  // healthCertificate
  patientHealthStatus:      <PawPrint className="w-4 h-4 text-[#5A7C7A]" />,
  vaccinationHistory:       <Shield className="w-4 h-4 text-[#5A7C7A]" />,
  parasiteControl:          <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  travelClearance:          <CheckCircle2 className="w-4 h-4 text-[#5A7C7A]" />,
  // dischargeSummary
  diagnosisSummary:         <FileText className="w-4 h-4 text-[#5A7C7A]" />,
  medications:              <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  feedingInstructions:      <Heart className="w-4 h-4 text-[#5A7C7A]" />,
  activityRestrictions:     <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
  followUpCare:             <CalendarDays className="w-4 h-4 text-[#5A7C7A]" />,
  warningSignsToWatch:      <AlertTriangle className="w-4 h-4 text-[#5A7C7A]" />,
  // referralLetter
  referralReason:           <FileText className="w-4 h-4 text-[#5A7C7A]" />,
  clinicalHistory:          <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  currentFindings:          <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  treatmentsToDate:         <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  referralRequest:          <Mail className="w-4 h-4 text-[#5A7C7A]" />,
}

const VITAL_LABELS: Record<string, { label: string; unit: string }> = {
  weight:             { label: 'Weight', unit: 'kg' },
  temperature:        { label: 'Temperature', unit: '°C' },
  pulseRate:          { label: 'Pulse Rate', unit: 'bpm' },
  spo2:               { label: 'SpO2', unit: '%' },
  bodyConditionScore: { label: 'BCS', unit: '/5' },
  dentalScore:        { label: 'Dental Score', unit: '/3' },
  crt:                { label: 'CRT', unit: 'sec' },
}

const SECTION_DATA_MAP: Record<string, Array<'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery' | 'immunityTesting' | 'vaccinations'>> = {
  clinicalSummary:          ['vitals'],
  laboratoryInterpretation: ['diagnostics', 'immunityTesting'],
  diagnosticIntegration:    ['vitals', 'diagnostics', 'immunityTesting'],
  managementPlan:           ['medications', 'preventiveCare'],
  objective:                ['vitals', 'diagnostics', 'immunityTesting'],
  plan:                     ['medications'],
  testsSummary:             ['diagnostics', 'immunityTesting'],
  resultsInterpretation:    ['diagnostics', 'immunityTesting'],
  clinicalCorrelation:      ['vitals'],
  preoperativeSummary:      ['vitals'],
  anesthesiaProtocol:       ['medications'],
  surgicalProcedure:        ['surgery'],
  postoperativeCare:        ['medications', 'preventiveCare'],
  // Health certificate intentionally has NO vitals table
  parasiteControl:          ['preventiveCare'],
  vaccinationHistory:       ['vaccinations'],
  diagnosisSummary:         ['vitals'],
  medications:              ['medications'],
  currentFindings:          ['vitals', 'diagnostics', 'immunityTesting'],
  treatmentsToDate:         ['medications', 'preventiveCare'],
  clinicalHistory:          ['vitals', 'diagnostics', 'medications', 'preventiveCare', 'surgery', 'immunityTesting', 'vaccinations'],
}

function renderClinicalTables(
  dataTypes: Array<'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery' | 'immunityTesting' | 'vaccinations'>,
  records: LinkedRecord[],
  reportVaccinations: VaccinationRecord[]
): React.ReactNode {
  const hasVitals = dataTypes.includes('vitals') && records.some(r =>
    r.vitals && Object.values(r.vitals).some(v => v?.value !== '' && v?.value !== null && v?.value !== undefined)
  )
  const hasDiagnostics = dataTypes.includes('diagnostics') && records.some(r => (r.diagnosticTests?.length ?? 0) > 0)
  const hasMedications = dataTypes.includes('medications') && records.some(r => (r.medications?.length ?? 0) > 0)
  const hasPreventive = dataTypes.includes('preventiveCare') && records.some(r => (r.preventiveCare?.length ?? 0) > 0)
  const hasSurgery = dataTypes.includes('surgery') && records.some(r => !!r.surgeryRecord?.surgeryType)
  const hasImmunityTesting = dataTypes.includes('immunityTesting') && records.some(r =>
    (r.immunityTesting?.enabled && (r.immunityTesting.rows?.length ?? 0) > 0) ||
    (r.immunityTesting?.antigenEnabled && (r.immunityTesting.antigenRows?.length ?? 0) > 0)
  )
  const hasVaccinations = dataTypes.includes('vaccinations') && reportVaccinations.length > 0

  if (!hasVitals && !hasDiagnostics && !hasMedications && !hasPreventive && !hasSurgery && !hasImmunityTesting && !hasVaccinations) return null

  const vitalsRecs = hasVitals ? records.filter(r =>
    r.vitals && Object.values(r.vitals).some(v => v?.value !== '' && v?.value !== null && v?.value !== undefined)
  ) : []
  const diagRecs = hasDiagnostics ? records.filter(r => (r.diagnosticTests?.length ?? 0) > 0) : []
  const medRecs = hasMedications ? records.filter(r => (r.medications?.length ?? 0) > 0) : []
  const prevRecs = hasPreventive ? records.filter(r => (r.preventiveCare?.length ?? 0) > 0) : []
  const surgRecs = hasSurgery ? records.filter(r => !!r.surgeryRecord?.surgeryType) : []

  return (
    <div className="space-y-4">
      {hasVitals && (
        <div>
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Vitals</p>
          {vitalsRecs.length > 1 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#f0f7f7]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Parameter</th>
                    {vitalsRecs.map(r => (
                      <th key={r._id} className="px-3 py-2 text-left font-semibold text-[#476B6B]">{fmtRDate(r.createdAt)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(VITAL_LABELS).map(([vkey, { label, unit }]) => {
                    const anyHas = vitalsRecs.some(r => { const v = r.vitals?.[vkey]; return v?.value !== '' && v?.value !== null && v?.value !== undefined })
                    if (!anyHas) return null
                    return (
                      <tr key={vkey} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-[#4F4F4F]">{label} ({unit})</td>
                        {vitalsRecs.map(r => {
                          const v = r.vitals?.[vkey]
                          const ok = v?.value !== '' && v?.value !== null && v?.value !== undefined
                          return <td key={r._id} className="px-3 py-2 text-gray-600">{ok ? `${v!.value} ${unit}` : 'N/A'}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Object.entries(VITAL_LABELS).map(([vkey, { label, unit }]) => {
                const v = vitalsRecs[0]?.vitals?.[vkey]
                if (!v?.value && v?.value !== 0) return null
                return (
                  <div key={vkey} className="bg-[#F8F6F2] rounded-lg p-2">
                    <p className="text-[10px] text-gray-500 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-[#4F4F4F]">{v.value} {unit}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {hasDiagnostics && (
        <div>
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Diagnostic Test Results</p>
          {diagRecs.map(r => (
            <div key={r._id} className="mb-3 last:mb-0">
              {diagRecs.length > 1 && (
                <p className="text-xs text-gray-400 mb-1.5">{fmtRDate(r.createdAt)}{r.chiefComplaint ? ` · ${r.chiefComplaint}` : ''}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-[#f0f7f7]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Test</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Result</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Normal Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.diagnosticTests!.map((t, ti) => (
                      <tr key={ti} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-[#4F4F4F]">{t.name}</td>
                        <td className="px-3 py-2 text-gray-600">{t.result || 'N/A'}</td>
                        <td className="px-3 py-2 text-gray-400">{t.normalRange || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMedications && (
        <div>
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Medications</p>
          {medRecs.map(r => (
            <div key={r._id} className="mb-3 last:mb-0">
              {medRecs.length > 1 && (
                <p className="text-xs text-gray-400 mb-1.5">{fmtRDate(r.createdAt)}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-[#f0f7f7]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Medication</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Dosage · Route</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Frequency</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.medications!.map((m, mi) => (
                      <tr key={mi} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-[#4F4F4F]">{m.name}</td>
                        <td className="px-3 py-2 text-gray-600">{m.dosage} · {m.route}</td>
                        <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                        <td className="px-3 py-2 text-gray-400">{m.duration || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasPreventive && (
        <div>
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Preventive Care</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-[#f0f7f7]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Service</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Product</th>
                  {prevRecs.length > 1 && <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Visit</th>}
                </tr>
              </thead>
              <tbody>
                {prevRecs.flatMap(r =>
                  r.preventiveCare!.map((p, pi) => (
                    <tr key={`${r._id}-${pi}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-[#4F4F4F] capitalize">{p.careType}</td>
                      <td className="px-3 py-2 text-gray-600">{p.product}</td>
                      {prevRecs.length > 1 && <td className="px-3 py-2 text-gray-400">{fmtRDate(r.createdAt)}</td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasSurgery && (
        <div>
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Surgery Record</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-[#f0f7f7]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Procedure</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {surgRecs.map(r => (
                  <tr key={r._id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-[#4F4F4F]">{r.surgeryRecord!.surgeryType}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtRDate(r.createdAt)}</td>
                    <td className="px-3 py-2 text-gray-400">{r.surgeryRecord!.vetRemarks || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasImmunityTesting && records
        .filter(r =>
          (r.immunityTesting?.enabled && (r.immunityTesting.rows?.length ?? 0) > 0) ||
          (r.immunityTesting?.antigenEnabled && (r.immunityTesting.antigenRows?.length ?? 0) > 0)
        )
        .map(r => (
          <div key={r._id} className="space-y-3">
            {r.immunityTesting?.enabled && (r.immunityTesting.rows?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-1">
                  Immunity / Titer Testing
                  {r.immunityTesting.kitName && <span className="font-normal normal-case text-gray-400"> · {r.immunityTesting.kitName}</span>}
                  {r.immunityTesting.testDate && <span className="font-normal normal-case text-gray-400"> ({fmtRDate(r.immunityTesting.testDate)})</span>}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-[#f0f7f7]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Disease</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Score</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.immunityTesting.rows!.map((row, ri) => (
                        <tr key={ri} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-[#4F4F4F]">{row.disease}</td>
                          <td className="px-3 py-2 text-gray-600">{row.score ?? 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.status || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-400">{row.action || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {r.immunityTesting?.antigenEnabled && (r.immunityTesting.antigenRows?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-1">
                  Antigen Testing
                  {r.immunityTesting.antigenDate && <span className="font-normal normal-case text-gray-400"> ({fmtRDate(r.immunityTesting.antigenDate)})</span>}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-[#f0f7f7]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Disease</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.immunityTesting.antigenRows!.map((row, ri) => (
                        <tr key={ri} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-[#4F4F4F]">{row.disease}</td>
                          <td className="px-3 py-2 text-gray-600">{row.result || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))
      }

      {hasVaccinations && (
        <div>
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Vaccination History</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-[#f0f7f7]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Vaccine</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Dose</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Date Given</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Next Due</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportVaccinations.map(v => (
                  <tr key={v._id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-[#4F4F4F]">{v.vaccineName}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {v.boosterNumber > 0 ? `Booster #${v.boosterNumber}` : `Dose #${v.doseNumber}`}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{fmtRDate(v.dateAdministered)}</td>
                    <td className="px-3 py-2 text-gray-400">{fmtRDate(v.nextDueDate)}</td>
                    <td className="px-3 py-2">
                      <span className={`capitalize text-xs font-medium ${
                        v.status === 'active' ? 'text-emerald-600' :
                        v.status === 'overdue' ? 'text-red-500' :
                        v.status === 'expired' ? 'text-orange-500' :
                        'text-gray-400'
                      }`}>{v.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PageHeader({ reportId }: { reportId: string }) {
  return (
    <div className="relative bg-white px-8 py-5 border-b border-gray-100">
      <p className="absolute top-3 right-4 text-gray-300 text-[10px] font-mono">{reportId.slice(-8).toUpperCase()}</p>
      <div className="flex flex-col items-center text-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logos/baivet-logo.png" alt="BaiVet" className="h-14 w-auto object-contain" />
        <p className="text-gray-500 text-xs">134A Schirra Street, Moonwalk Village, Phase 1, Parañaque</p>
        <p className="text-gray-400 text-xs">028347477 · 0917-8220273</p>
      </div>
    </div>
  )
}

export default async function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await fetchSharedReport(id)

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 gap-3">
        <PawPrint className="w-10 h-10 opacity-30" />
        <p className="text-sm">This report is not available or has not been shared.</p>
      </div>
    )
  }

  const pet = report.petId
  const vet = report.vetId
  const ownerSummary = report.ownerSummary
  const sectionKeys = getSectionKeys(report.reportType)
  const sectionLabels = getSectionLabels(report.reportType)

  // Each data table renders once per document — the first section that claims a
  // data type keeps it, later sections skip it (mirrors the vet editor preview)
  const exclusiveSectionData: Record<string, Array<'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery' | 'immunityTesting' | 'vaccinations'>> = (() => {
    const seen = new Set<string>()
    const result: Record<string, Array<'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery' | 'immunityTesting' | 'vaccinations'>> = {}
    for (const key of sectionKeys) {
      const cols = SECTION_DATA_MAP[key] ?? []
      const exclusive = cols.filter((t) => !seen.has(t))
      exclusive.forEach((t) => seen.add(t))
      result[key] = exclusive
    }
    return result
  })()

  const allDataRecords = ((report.medicalRecordIds ?? []).filter(
    (r): r is LinkedRecord => typeof r === 'object' && r !== null
  )).sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())

  const reportVaccinations: VaccinationRecord[] = report.vaccinations ?? []

  const fmtImgDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  // Attached photos are type-specific: diagnostic images appear only on Diagnostic
  // reports, surgery images only on Surgery reports.
  const diagnosticImages = report.reportType !== 'diagnostic' ? [] : allDataRecords.flatMap((r) =>
    (r.diagnosticTests ?? []).flatMap((t) =>
      (t.images ?? []).map((img) => ({
        url: img.url,
        description: img.description,
        label: t.name || t.testType,
        date: r.createdAt,
      }))
    )
  )
  const surgeryImages = report.reportType !== 'surgery' ? [] : allDataRecords.flatMap((r) =>
    (r.surgeryRecord?.images ?? []).map((img) => ({
      url: img.url,
      description: img.description,
      label: r.surgeryRecord?.surgeryType || 'Surgery',
      date: r.createdAt,
    }))
  )

  const visitDates = allDataRecords
    .map((r) => (r.createdAt ? new Date(r.createdAt).getTime() : NaN))
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b)
  const coverage =
    visitDates.length > 1
      ? `This report covers ${visitDates.length} visits, ${formatReportDate(new Date(visitDates[0]).toISOString())} – ${formatReportDate(new Date(visitDates[visitDates.length - 1]).toISOString())}.`
      : null

  const hasOwnerSummary = ownerSummary && Object.values(ownerSummary).some(
    (v) => typeof v === 'string' && (v as string).trim()
  )
  const totalPages = hasOwnerSummary ? 2 : 1

  const pdfFilename = `medical-report-${(pet?.name || 'pet').replace(/[^a-zA-Z0-9-]+/g, '-')}-${new Date(report.reportDate).toISOString().split('T')[0]}.pdf`

  return (
    <div className="report-print-root min-h-screen bg-gray-100 py-10 px-4">
      <div id="shared-report-document" className="max-w-204 mx-auto space-y-8">

        {/* Print / Download actions */}
        <div className="report-no-print flex justify-end">
          <ReportActions targetId="shared-report-document" filename={pdfFilename} />
        </div>

        {/* ── PAGE 1: Owner Summary (shown first to owner) ── */}
        {hasOwnerSummary && ownerSummary && (
          <div>
            <p className="report-no-print text-xs text-gray-400 text-center mb-2">
              Page 1 of {totalPages} · Owner Summary
            </p>
            <div
              className="report-print-page bg-white border border-gray-200 shadow-md overflow-hidden rounded-xl"
              style={{ minHeight: '1056px' }}
            >
              <PageHeader reportId={report._id} />
              <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
                <h2 className="text-sm font-semibold tracking-wider uppercase">
                  Owner Summary for {pet.name}&apos;s Family
                </h2>
              </div>
              <div className="px-8 py-6 space-y-4">
                <p className="text-xs text-gray-500">
                  A plain-language guide to this report, written for you.
                </p>
                {OWNER_SUMMARY_CONFIG.map(({ key, label, Icon, bg, border, ic, tc }) => {
                  const content = ownerSummary[key] as string | undefined
                  const treatmentItems = key === 'theTreatmentPlan' ? (ownerSummary.treatmentPlan ?? []) : []
                  if (!content?.trim() && treatmentItems.length === 0) return null
                  return (
                    <div key={key} className={`rounded-xl border p-4 ${bg} ${border}`}>
                      <div className={`flex items-center gap-2 mb-2 ${tc}`}>
                        <Icon className={`w-4 h-4 ${ic}`} />
                        <span className="font-semibold text-sm">{label}</span>
                      </div>
                      {content?.trim() && <p className="text-sm text-gray-700 leading-relaxed">{content}</p>}
                      {treatmentItems.length > 0 && (
                        <div className={content?.trim() ? 'mt-3' : ''}>
                          <OwnerTreatmentTimeline items={treatmentItems} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 2 (or 1 if no owner summary): Veterinary Diagnostic Report ── */}
        <div className={hasOwnerSummary ? 'report-print-newpage' : undefined}>
          <p className="report-no-print text-xs text-gray-400 text-center mb-2">
            Page {hasOwnerSummary ? 2 : 1} of {totalPages} · {REPORT_TYPE_DOCUMENT_TITLES[report.reportType] ?? 'Veterinary Report'}
          </p>
          <div
            className="report-print-page bg-white border border-gray-200 shadow-md overflow-hidden rounded-xl"
            style={{ minHeight: '1056px' }}
          >
            <PageHeader reportId={report._id} />
            <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
              <h2 className="text-sm font-semibold tracking-wider uppercase">{REPORT_TYPE_DOCUMENT_TITLES[report.reportType] ?? 'Veterinary Report'}</h2>
            </div>
            <div className="px-8 py-6 space-y-6">

              {/* Patient info */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                  <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Patient Information</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F8F6F2] rounded-xl p-4 text-sm">
                  <div><p className="text-xs text-gray-500">Name</p><p className="font-medium text-[#4F4F4F]">{pet.name}</p></div>
                  <div><p className="text-xs text-gray-500">Species</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.species === 'canine' ? 'Canine' : 'Feline'}</p></div>
                  <div><p className="text-xs text-gray-500">Breed</p><p className="font-medium text-[#4F4F4F]">{pet.breed}</p></div>
                  <div><p className="text-xs text-gray-500">Sex</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sex ?? 'N/A'}</p></div>
                  <div><p className="text-xs text-gray-500">Age</p><p className="font-medium text-[#4F4F4F]">{pet.dateOfBirth ? calcAge(pet.dateOfBirth) : 'N/A'}</p></div>
                  <div><p className="text-xs text-gray-500">Weight</p><p className="font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : 'N/A'}</p></div>
                  <div><p className="text-xs text-gray-500">Sterilization</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sterilization ?? 'N/A'}</p></div>
                  <div><p className="text-xs text-gray-500">Microchip</p><p className="font-medium text-[#4F4F4F] font-mono">{pet.microchipNumber || 'N/A'}</p></div>
                  {pet.allergies && pet.allergies.length > 0 && (
                    <div><p className="text-xs text-gray-500">Allergies</p><p className="font-medium text-[#4F4F4F]">{pet.allergies.join(', ')}</p></div>
                  )}
                </div>
              </div>

              {/* Attending vet */}
              <div className="flex items-center gap-2 bg-[#f0f7f7] rounded-xl px-4 py-3 text-sm">
                <Stethoscope className="w-4 h-4 text-[#5A7C7A] shrink-0" />
                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium mr-1">Attending Veterinarian:</span>
                <span className="font-medium text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</span>
                {vet.prcLicenseNumber && (
                  <span className="text-gray-400 text-xs ml-1">· P.R.C. Lic No. {vet.prcLicenseNumber}</span>
                )}
              </div>

              {/* Coverage (consolidated reports) */}
              {coverage && (
                <p className="text-xs text-gray-500 bg-[#F8F6F2] rounded-xl px-4 py-2.5">{coverage}</p>
              )}

              <hr className="border-gray-200" />

              {/* Clinical sections with data tables */}
              {sectionKeys.map((key, i) => {
                const content = typeof report.sections[key] === 'string' ? report.sections[key] : ''
                const dataCols = exclusiveSectionData[key]
                const tables = dataCols?.length ? renderClinicalTables(dataCols, allDataRecords, reportVaccinations) : null
                if (!content.trim() && !tables) return null
                return (
                  <div key={key}>
                    {i > 0 && <hr className="border-gray-100 mb-6" />}
                    <div className="flex items-center gap-2 mb-3">
                      {SECTION_ICONS[key] ?? <FileText className="w-4 h-4 text-[#5A7C7A]" />}
                      <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">{sectionLabels[key]}</h3>
                    </div>
                    {content.trim() && (
                      <div className="bg-[#F8F6F2] rounded-xl p-4 mb-4">
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{content}</p>
                      </div>
                    )}
                    {tables}
                  </div>
                )
              })}

              {/* Attached images from diagnostics & surgery */}
              {(diagnosticImages.length > 0 || surgeryImages.length > 0) && (
                <div>
                  <hr className="border-gray-100 mb-6" />
                  <div className="flex items-center gap-2 mb-3">
                    <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Attached Images</h3>
                  </div>
                  {diagnosticImages.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Diagnostic Images</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {diagnosticImages.map((img, i) => (
                          <figure key={`diag-${i}`} className="bg-[#F8F6F2] rounded-xl overflow-hidden border border-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.description || img.label} className="w-full h-36 object-cover" />
                            <figcaption className="px-2.5 py-1.5 text-[10px] text-gray-500">
                              <span className="font-semibold text-gray-600">{img.label}</span>
                              {fmtImgDate(img.date) && <> · {fmtImgDate(img.date)}</>}
                              {img.description && <span className="block text-gray-400">{img.description}</span>}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}
                  {surgeryImages.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Surgery Images</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {surgeryImages.map((img, i) => (
                          <figure key={`surg-${i}`} className="bg-[#F8F6F2] rounded-xl overflow-hidden border border-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.description || img.label} className="w-full h-36 object-cover" />
                            <figcaption className="px-2.5 py-1.5 text-[10px] text-gray-500">
                              <span className="font-semibold text-gray-600">{img.label}</span>
                              {fmtImgDate(img.date) && <> · {fmtImgDate(img.date)}</>}
                              {img.description && <span className="block text-gray-400">{img.description}</span>}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Vet signature */}
              <hr className="border-gray-200" />
              <div className="flex items-end justify-between pt-2">
                <div className="text-sm">
                  {report.vetSignature?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={report.vetSignature.url} alt="Veterinarian signature" className="h-12 mb-2 object-contain" />
                  ) : (
                    <div className="mb-8 h-10" />
                  )}
                  <p className="font-bold text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</p>
                  <p className="text-gray-500 text-xs">Licensed Veterinarian</p>
                  {vet.prcLicenseNumber && (
                    <p className="text-gray-400 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>
                  )}
                  {report.vetSignature?.signedAt && (
                    <p className="text-gray-400 text-xs mt-0.5">Signed on {formatReportDate(report.vetSignature.signedAt)}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>Report Date: {formatReportDate(report.reportDate)}</p>
                  <p className="font-mono">{report._id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              {/* Addenda — corrections added after the report was finalized/shared. The
                  original content above is never edited in place; see AddendumSection.
                  Native <details> so it collapses without client JS on this server page. */}
              {report.addenda && report.addenda.length > 0 && (
                <details className="report-addenda-details" open>
                  <summary className="cursor-pointer list-none">
                    <hr className="border-gray-100 mb-6" />
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-[#5A7C7A]" />
                      <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">
                        Addenda ({report.addenda.length})
                      </h3>
                      <ChevronDown className="details-chevron w-4 h-4 text-gray-400 ml-auto" />
                    </div>
                  </summary>
                  <div className="space-y-3">
                    {report.addenda.map((a) => {
                      const author = typeof a.addedBy === 'object' ? a.addedBy : null
                      return (
                        <div key={a._id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                          <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{a.text}</p>
                          <p className="text-xs text-amber-700 mt-2">
                            Added {formatReportDate(a.addedAt)}{author ? ` by Dr. ${author.firstName} ${author.lastName}` : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-4">
                {report.isAIGenerated && (
                  <>This report was drafted with AI assistance and has been reviewed, edited, and approved in full by Dr. {vet.firstName} {vet.lastName}. </>
                )}
                Diagnostic interpretations reflect a range of potential findings based on the results obtained, individual patient characteristics, and clinical history, and should be considered as part of a comprehensive assessment.
                {report.isAIGenerated && ' Pet owners are welcome to seek a second opinion from another licensed veterinarian.'}
              </p>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
