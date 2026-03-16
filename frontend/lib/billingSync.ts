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
  recordVaccinations,
  token,
}: {
  billingId: string
  petId: string
  medications: Omit<Medication, '_id'>[]
  diagnosticTests: Omit<DiagnosticTest, '_id'>[]
  preventiveCare: Omit<PreventiveCare, '_id'>[]
  recordCreatedAt: string
  recordVaccinations?: any[]
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

  // Collect vaccinations: embedded in record first, then same-day pet records
  const recordDateStr = recordCreatedAt.split('T')[0]
  let petVaccinations: any[] = Array.isArray(recordVaccinations) ? [...recordVaccinations] : []
  const sameDayVax = (vacRes?.data?.vaccinations ?? []).filter((v: any) => {
    if (!v.dateAdministered) return false
    return new Date(v.dateAdministered).toISOString().split('T')[0] === recordDateStr
  })
  const seenIds = new Set(petVaccinations.map((v: any) => v._id).filter(Boolean))
  for (const v of sameDayVax) {
    if (!seenIds.has(v._id)) petVaccinations.push(v)
  }
  // Deduplicate by vaccineTypeId
  const seenVtIds = new Set<string>()
  petVaccinations = petVaccinations.filter((v: any) => {
    const vtId = typeof v.vaccineTypeId === 'object' ? v.vaccineTypeId?._id : v.vaccineTypeId
    const key = vtId || v.vaccineName
    if (seenVtIds.has(key)) return false
    seenVtIds.add(key)
    return true
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

  // Vaccines administered on this visit
  for (const vax of petVaccinations) {
    const vaccTypeId = typeof vax.vaccineTypeId === 'object'
      ? (vax.vaccineTypeId as any)?._id
      : vax.vaccineTypeId
    // ID match first (guarantees current pricePerDose from product-man); fall back to name
    const match = (vaccTypeId ? vaccineTypes.find((v) => v.id === vaccTypeId) : undefined) ||
      vaccineTypes.find((v) => normalizeName(v.name) === normalizeName(vax.vaccineName))
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

/**
 * Re-prices an existing billing's items from the current catalog without needing
 * the full medical record. Safe to call from any billing view — skips paid bills.
 * Returns the refreshed billing object, or null if skipped/failed.
 */
export async function refreshBillingPrices(
  billingId: string,
  token: string,
): Promise<any | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

  const [billingRes, psRes, vtRes] = await Promise.all([
    authenticatedFetch(`/billings/${billingId}`, { method: 'GET' }, token).catch(() => null),
    authenticatedFetch('/product-services', { method: 'GET' }, token).catch(() => null),
    fetch(`${apiBase}/vaccine-types`).then((r) => r.json()).catch(() => null),
  ])

  const billing = billingRes?.data?.billing
  if (!billing || billing.status === 'paid') return billing ?? null

  // Build price lookup maps by catalog ID
  const psMap = new Map<string, number>(
    (psRes?.data?.items ?? [])
      .filter((p: any) => p.isActive)
      .map((p: any) => [p._id as string, p.price as number]),
  )
  const vtMap = new Map<string, number>(
    (vtRes?.data?.vaccineTypes ?? [])
      .filter((v: any) => v.isActive)
      .map((v: any) => [v._id as string, v.pricePerDose as number]),
  )

  const existingItems: any[] = billing.items ?? []
  let hasChanges = false
  const updatedItems = existingItems.map((item: any) => {
    const currentPrice =
      (item.productServiceId && psMap.has(item.productServiceId)
        ? psMap.get(item.productServiceId)
        : item.vaccineTypeId && vtMap.has(item.vaccineTypeId)
          ? vtMap.get(item.vaccineTypeId)
          : undefined)
    if (currentPrice !== undefined && currentPrice !== item.unitPrice) {
      hasChanges = true
      return { ...item, unitPrice: currentPrice }
    }
    return item
  })

  if (!hasChanges) return billing

  const patchRes = await authenticatedFetch(
    `/billings/${billingId}`,
    { method: 'PATCH', body: JSON.stringify({ items: updatedItems }) },
    token,
  ).catch(() => null)

  return patchRes?.data?.billing ?? { ...billing, items: updatedItems }
}
