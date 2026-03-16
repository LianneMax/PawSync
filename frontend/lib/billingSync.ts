import { authenticatedFetch } from './auth'
import type { Medication, DiagnosticTest, PreventiveCare } from './medicalRecords'

function normalizeName(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

interface CatalogEntry {
  id: string
  name: string
  type: 'Service' | 'Product' | 'Vaccine'
  category: string
  price: number
  administrationRoute?: string
  catalogKind: 'product-service' | 'vaccine'
}

function matchByName(name: string, catalog: CatalogEntry[]): CatalogEntry | undefined {
  const n = normalizeName(name)
  return (
    catalog.find((c) => normalizeName(c.name) === n) ||
    catalog.find((c) => normalizeName(c.name).includes(n) || n.includes(normalizeName(c.name)))
  )
}

/**
 * Automatically syncs a billing record's items from the current state of a medical record.
 * Called silently after saving a medical record — no UI interaction needed.
 */
export async function syncBillingFromRecord({
  billingId,
  petId,
  medications,
  diagnosticTests,
  preventiveCare,
  recordCreatedAt,
  token,
}: {
  billingId: string
  petId: string
  medications: Omit<Medication, '_id'>[]
  diagnosticTests: Omit<DiagnosticTest, '_id'>[]
  preventiveCare: Omit<PreventiveCare, '_id'>[]
  recordCreatedAt: string
  token: string
}): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

  // Fetch billing status, catalog, and pet vaccinations in parallel
  const [billingRes, psRes, vtRes, vacRes] = await Promise.all([
    authenticatedFetch(`/billings/${billingId}`, { method: 'GET' }, token).catch(() => null),
    authenticatedFetch('/product-services', { method: 'GET' }, token),
    fetch(`${apiBase}/vaccine-types`).then((r) => r.json()),
    authenticatedFetch(`/vaccinations/pet/${petId}`, { method: 'GET' }, token).catch(() => null),
  ])

  // Never modify a paid bill
  const billingStatus = billingRes?.data?.billing?.status
  if (billingStatus === 'paid') return

  const productServices: CatalogEntry[] = (psRes?.data?.items ?? [])
    .filter((p: any) => p.isActive)
    .map((p: any) => ({
      id: p._id,
      name: p.name,
      type: p.type as 'Service' | 'Product',
      category: p.category,
      price: p.price,
      administrationRoute: p.administrationRoute,
      catalogKind: 'product-service' as const,
    }))

  const vaccineTypes: CatalogEntry[] = (vtRes?.data?.vaccineTypes ?? [])
    .filter((v: any) => v.isActive)
    .map((v: any) => ({
      id: v._id,
      name: v.name,
      type: 'Vaccine' as const,
      category: 'Vaccines',
      price: v.pricePerDose,
      catalogKind: 'vaccine' as const,
    }))

  const allCatalog = [...productServices, ...vaccineTypes]

  // Filter vaccinations to same calendar day as the record
  const recordDate = new Date(recordCreatedAt)
  const petVaccinations: any[] = (vacRes?.data?.vaccinations ?? []).filter((v: any) => {
    if (!v.dateAdministered) return false
    const vDate = new Date(v.dateAdministered)
    return (
      vDate.getFullYear() === recordDate.getFullYear() &&
      vDate.getMonth() === recordDate.getMonth() &&
      vDate.getDate() === recordDate.getDate()
    )
  })

  const billingItems: any[] = []

  // Medications
  const medCatalog = allCatalog.filter((c) => c.category === 'Medication')
  for (const med of medications) {
    if (!med.name) continue
    const match =
      medCatalog.find(
        (c) =>
          normalizeName(c.name) === normalizeName(med.name) &&
          (!c.administrationRoute || c.administrationRoute === med.route),
      ) || matchByName(med.name, medCatalog)
    billingItems.push({
      ...(match ? { productServiceId: match.id } : {}),
      name: match ? match.name : med.name,
      type: 'Product',
      unitPrice: match ? match.price : 0,
    })
  }

  // Diagnostic Tests
  const diagCatalog = allCatalog.filter((c) => c.category === 'Diagnostic Tests')
  for (const test of diagnosticTests) {
    if (!test.name) continue
    const match = matchByName(test.name, diagCatalog)
    billingItems.push({
      ...(match ? { productServiceId: match.id } : {}),
      name: match ? match.name : test.name,
      type: 'Service',
      unitPrice: match ? match.price : 0,
    })
  }

  // Preventive Care
  const careCatalog = allCatalog.filter((c) => c.category === 'Preventive Care')
  for (const care of preventiveCare) {
    if (!care.product) continue
    const match = matchByName(care.product, careCatalog)
    billingItems.push({
      ...(match ? { productServiceId: match.id } : {}),
      name: match ? match.name : care.product,
      type: 'Service',
      unitPrice: match ? match.price : 0,
    })
  }

  // Vaccines administered on the same visit day
  for (const vax of petVaccinations) {
    const match = vaccineTypes.find(
      (v) => normalizeName(v.name) === normalizeName(vax.vaccineName),
    )
    billingItems.push({
      ...(match ? { vaccineTypeId: match.id } : {}),
      name: match ? match.name : vax.vaccineName,
      type: 'Service',
      unitPrice: match ? match.price : 0,
    })
  }

  if (billingItems.length === 0) return

  await authenticatedFetch(
    `/billings/${billingId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ items: billingItems }),
    },
    token,
  )
}
