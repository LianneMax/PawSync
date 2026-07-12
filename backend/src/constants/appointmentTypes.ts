// Sensitive appointment types: all surgery types + pregnancy deliveries.
// Appointment.types values come from two different sources that don't share a
// fixed vocabulary: the owner-facing booking form
// (frontend/components/AppointmentServiceSelector.tsx, fixed slugs like
// 'sterilization') and the clinic-admin manual booking flow, which pulls from
// each clinic's own ProductService catalog — a free-text service name the
// clinic admin typed in (e.g. "Sterilization", "Spay Surgery", "C-Section
// Delivery"), only loosely normalized by normalizeAppointmentType(). There is
// no reliable shared slug across both paths, so classification is
// case-insensitive keyword matching rather than an exact-value list.
const SENSITIVE_KEYWORDS = [
  'surg',        // surgery, surgical, abdominal-surgery, orthopedic-surgery
  'sterili',     // sterilization
  'neuter',
  'spay',
  'castrat',
  'pregnan',     // pregnancy-delivery, "Pregnancy Delivery"
  'deliver',     // delivery, whelping/delivery assistance
  'whelp',
  'c-section',
  'cesarean',
  'caesarean',
];

export function isSensitiveAppointment(types: string[] = []): boolean {
  return types.some((t) => {
    const norm = String(t).toLowerCase();
    return SENSITIVE_KEYWORDS.some((kw) => norm.includes(kw));
  });
}
