export type NFCTaggablePet = {
  nfcTagId?: string | null
  nfc_tag_id?: string | null
  tag_uid?: string | null
  nfc_id?: string | null
} | null | undefined

export function hasNFCTag(pet: NFCTaggablePet): boolean {
  if (!pet) return false

  const rawTag = pet.nfc_tag_id ?? pet.nfcTagId ?? pet.tag_uid ?? pet.nfc_id
  const normalizedTag = typeof rawTag === 'string' ? rawTag.trim() : ''

  return Boolean(normalizedTag && normalizedTag !== '-')
}
