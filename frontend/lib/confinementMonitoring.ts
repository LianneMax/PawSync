import { authenticatedFetch } from './auth'

export type MonitoringEntryType = 'daily' | 'spot'
export type ClinicalFlag = 'normal' | 'abnormal' | 'critical'
export type FollowUpAction = 'watch' | 'recheck' | 'escalate' | 'medication_adjustment' | 'diagnostics'

export interface MonitoringEntry {
  _id: string
  confinementRecordId: string
  petId: string
  medicalRecordId?: string | null
  recordedAt: string
  entryType: MonitoringEntryType
  recorderId?: { _id?: string; firstName?: string; lastName?: string; userType?: string } | string
  recorderRole: 'veterinarian' | 'clinic-admin'
  temperature: { value: number; unit: string }
  heartRate: { value: number; unit: string }
  respiratoryRate?: { value: number; unit: string } | null
  weight: { value: number; unit: string }
  bodyConditionScore?: { value: number; unit: string } | null
  dentalScore?: { value: number; unit: string } | null
  hydrationStatus?: string
  appetite?: string
  painScore?: number | null
  capillaryRefillTime?: { value: number; unit: string } | null
  spo2?: { value: number; unit: string } | null
  bloodGlucose?: { value: number; unit: string } | null
  bloodPressureSystolic?: { value: number; unit: string } | null
  bloodPressureDiastolic?: { value: number; unit: string } | null
  clinicalNotes: string
  clinicalFlag: ClinicalFlag
  followUpAction: FollowUpAction
  followUpInHours?: number | null
  requiresImmediateReview: boolean
  alertResolved: boolean
  alertResolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface MonitoringResponse {
  status: 'SUCCESS' | 'ERROR'
  message?: string
  data?: {
    entries: MonitoringEntry[]
    total: number
    status: 'admitted' | 'discharged'
  }
}

export async function listConfinementMonitoringEntries(confinementRecordId: string, token: string): Promise<MonitoringResponse> {
  return authenticatedFetch(`/confinement/${confinementRecordId}/monitoring`, { method: 'GET' }, token)
}

export async function createConfinementMonitoringEntry(
  confinementRecordId: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ status: 'SUCCESS' | 'ERROR'; message?: string; data?: { entry: MonitoringEntry } }> {
  return authenticatedFetch(
    `/confinement/${confinementRecordId}/monitoring`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function updateConfinementMonitoringEntry(
  confinementRecordId: string,
  entryId: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ status: 'SUCCESS' | 'ERROR'; message?: string; data?: { entry: MonitoringEntry } }> {
  return authenticatedFetch(
    `/confinement/${confinementRecordId}/monitoring/${entryId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function resolveConfinementMonitoringAlert(
  confinementRecordId: string,
  entryId: string,
  token: string,
  editReason = 'Alert reviewed and resolved by veterinarian',
): Promise<{ status: 'SUCCESS' | 'ERROR'; message?: string; data?: { entry: MonitoringEntry } }> {
  return authenticatedFetch(
    `/confinement/${confinementRecordId}/monitoring/${entryId}/resolve-alert`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editReason }),
    },
    token,
  )
}
