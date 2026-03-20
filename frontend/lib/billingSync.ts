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
  injectionPricingType?: 'singleDose' | 'mlPerKg'
  associatedServiceId?: string | null
  doseConcentration?: number | null
  dosePerKg?: number | null
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
const APPT_TYPE_LABEL: Record<string, string> = {
  'consultation':             'Consultation',
  'general-checkup':          'General Checkup',
  'primary-treatment':        'Primary Treatment',
  'outpatient-treatment':     'Outpatient Treatment',
  'inpatient-care':           'Inpatient Care',
  'point-of-care-diagnostic': 'Point of Care Diagnostic',
  'laser-therapy':            'Laser Therapy',
  'dental-scaling':           'Dental Scaling',
  'cbc':                      'CBC Test',
  'blood-chemistry-16':       'Blood Chemistry (16)',
  'pcr-test':                 'PCR Test',
  'x-ray':                    'X-Ray',
  'ultrasound':               'Ultrasound',
  'abdominal-surgery':        'Abdominal Surgery',
  'orthopedic-surgery':       'Orthopedic Surgery',
  'Sterilization':            'Sterilization',
  'General Consultation':     'General Consultation',
}

const SKIP_APPT_TYPES = new Set([
  'vaccination', 'rabies-vaccination', 'puppy-litter-vaccination', 'booster',
  'deworming', 'flea-tick-prevention', 'Preventive Care',
  'basic-grooming', 'full-grooming', 'Grooming',
])

export async function syncBillingFromRecord({
  billingId,
  petId,
  medications,
  diagnosticTests,
  preventiveCare,
  recordCreatedAt,
  recordVaccinations,
  token,
  titerEnabled,
  deliveryServiceName,
  appointmentTypes,
  petSpecies,
  petWeightKg,
  preventiveExclusions,
}: {
  billingId: string
  petId: string
  medications: Omit<Medication, '_id'>[]
  diagnosticTests: Omit<DiagnosticTest, '_id'>[]
  preventiveCare: Omit<PreventiveCare, '_id'>[]
  recordCreatedAt: string
  recordVaccinations?: any[]
  token: string
  titerEnabled?: boolean
  deliveryServiceName?: string
  appointmentTypes?: string[]
  petSpecies?: string
  petWeightKg?: number
  preventiveExclusions?: string[]
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
      injectionPricingType: p.injectionPricingType,
      associatedServiceId: p.associatedServiceId ? String(p.associatedServiceId) : null,
      doseConcentration: p.doseConcentration ?? null,
      dosePerKg: p.dosePerKg ?? null,
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
  // Single-dose injections are billed as qty 1; mlPerKg injections use dosage volume; others use med.quantity
  const medCatalog = allCatalog.filter((c) => c.category === 'Medication')
  for (const med of medications) {
    if (!med.name) continue
    const match =
      medCatalog.find(
        (c) =>
          normalizeName(c.name) === normalizeName(med.name) &&
          (!c.administrationRoute || c.administrationRoute === med.route),
      ) || matchByName(med.name, medCatalog)
    const isSingleDoseInjection =
      match &&
      match.administrationRoute === 'injection' &&
      match.injectionPricingType === 'singleDose'
    const isMlPerKgInjection =
      match &&
      match.administrationRoute === 'injection' &&
      match.injectionPricingType === 'mlPerKg'

    let quantity: number = (med as any).quantity ?? 1
    if (isSingleDoseInjection) {
      quantity = 1
    } else if (isMlPerKgInjection && (med as any).dosage) {
      const mlMatch = String((med as any).dosage).match(/([\d.]+)\s*ml/i)
      quantity = mlMatch ? parseFloat(mlMatch[1]) : 1
    }

    billingItems.push({
      ...(match ? { productServiceId: match.id } : {}),
      name: match ? match.name : med.name,
      type: 'Product',
      unitPrice: match ? match.price : 0,
      quantity,
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

  // Preventive Care — service itself + associated medications and injections
  const careCatalog = allCatalog.filter((c) => c.category === 'Preventive Care')
  const exclusionSet = new Set<string>(preventiveExclusions ?? [])
  for (const care of preventiveCare) {
    if (!care.product) continue
    const match = matchByName(care.product, careCatalog)
    billingItems.push({
      ...(match ? { productServiceId: match.id } : {}),
      name: match ? match.name : care.product,
      type: 'Service',
      unitPrice: match ? match.price : 0,
    })

    if (!match) continue
    const careServiceId = match.id

    // Associated preventive medications (route=preventive, linked via associatedServiceId)
    const assocMeds = productServices.filter(
      (p: any) =>
        String(p.administrationRoute || '').toLowerCase() === 'preventive' &&
        String(p.associatedServiceId || '') === careServiceId,
    )
    console.log(`[BillingSync] Preventive care "${care.product}" (id=${careServiceId}): found ${assocMeds.length} assoc med(s), exclusions:`, [...exclusionSet])
    for (const assocMed of assocMeds) {
      if (exclusionSet.has(assocMed.id)) continue
      billingItems.push({
        productServiceId: assocMed.id,
        name: assocMed.name,
        type: 'Product',
        unitPrice: assocMed.price,
        quantity: 1,
      })
    }

    // Associated injections (route=injection, linked via associatedServiceId)
    const assocInjs = productServices.filter(
      (p: any) =>
        String(p.administrationRoute || '').toLowerCase() === 'injection' &&
        String(p.associatedServiceId || '') === careServiceId,
    )
    console.log(`[BillingSync] Preventive care "${care.product}" (id=${careServiceId}): found ${assocInjs.length} assoc injection(s)`)
    for (const assocInj of assocInjs) {
      if (exclusionSet.has(assocInj.id)) continue
      let injQty = 1
      if (assocInj.injectionPricingType === 'mlPerKg' && petWeightKg && petWeightKg > 0) {
        const doseConcentration: number = (assocInj as any).doseConcentration ?? 0
        const dosePerKg: number = (assocInj as any).dosePerKg ?? 0
        if (doseConcentration > 0 && dosePerKg > 0) {
          injQty = parseFloat(((dosePerKg * petWeightKg) / doseConcentration).toFixed(2))
        } else if (dosePerKg > 0) {
          injQty = parseFloat((dosePerKg * petWeightKg).toFixed(2))
        }
        if (injQty <= 0) injQty = 1
      }
      billingItems.push({
        productServiceId: assocInj.id,
        name: assocInj.name,
        type: 'Product',
        unitPrice: assocInj.price,
        quantity: injQty,
      })
    }
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

  // Titer Testing — add the species-appropriate titer service from the catalog
  if (titerEnabled) {
    const hasTiterItem = billingItems.some((i: any) => (i.name || '').toLowerCase().includes('titer'))
    if (!hasTiterItem) {
      const speciesHint = (petSpecies || '').toLowerCase().startsWith('f') ? 'feline' : 'canine'
      const titerMatch =
        allCatalog.find(
          (c) =>
            normalizeName(c.name).includes('titer') &&
            normalizeName(c.name).includes(speciesHint),
        ) || allCatalog.find((c) => normalizeName(c.name).includes('titer'))
      billingItems.push({
        ...(titerMatch ? { productServiceId: titerMatch.id } : {}),
        name: titerMatch ? titerMatch.name : 'Titer Testing',
        type: 'Service',
        unitPrice: titerMatch ? titerMatch.price : 0,
      })
    }
  }

  // Pregnancy Delivery — add the chosen delivery method's price
  if (deliveryServiceName) {
    const deliveryCatalog = allCatalog.filter((c) => c.category === 'Pregnancy Delivery')
    const deliveryMatch = matchByName(deliveryServiceName, deliveryCatalog)
    billingItems.push({
      ...(deliveryMatch ? { productServiceId: deliveryMatch.id } : {}),
      name: deliveryMatch ? deliveryMatch.name : deliveryServiceName,
      type: 'Service',
      unitPrice: deliveryMatch ? deliveryMatch.price : 0,
    })
  }

  // Appointment types — consultation type and other services tied to the appointment
  if (appointmentTypes?.length) {
    const usedIds = new Set(billingItems.map((i: any) => i.productServiceId).filter(Boolean))
    for (const apptType of appointmentTypes) {
      if (SKIP_APPT_TYPES.has(apptType)) continue
      const label = APPT_TYPE_LABEL[apptType] ||
        apptType.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const match = matchByName(label, productServices)
      if (match && usedIds.has(match.id)) continue
      billingItems.push({
        ...(match ? { productServiceId: match.id } : {}),
        name: match ? match.name : label,
        type: 'Service',
        unitPrice: match ? match.price : 0,
      })
      if (match) usedIds.add(match.id)
    }
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
