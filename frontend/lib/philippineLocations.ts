const philippines = require('philippines') as {
  regions: Array<{ key: string; name: string; long: string }>
  provinces: Array<{ key: string; name: string; region: string }>
  cities: Array<{ name: string; province: string }>
}

const normalizeKey = (value: string) => value.trim().toLowerCase()

const provinceCodeByKeyOrName = new Map<string, string>()
for (const province of philippines.provinces) {
  provinceCodeByKeyOrName.set(normalizeKey(province.name), province.key)
  provinceCodeByKeyOrName.set(normalizeKey(province.key), province.key)
}

const provinceCodesByRegion = new Map<string, string[]>()
for (const region of philippines.regions) {
  const regionProvinceCodes = philippines.provinces
    .filter((province) => province.region === region.key)
    .map((province) => province.key)
  provinceCodesByRegion.set(normalizeKey(region.key), regionProvinceCodes)
  provinceCodesByRegion.set(normalizeKey(region.name), regionProvinceCodes)
  provinceCodesByRegion.set(normalizeKey(region.long), regionProvinceCodes)
}

const provinceNames = Array.from(new Set(philippines.provinces.map((province) => province.name))).sort((a, b) =>
  a.localeCompare(b)
)

export const getPhilippineProvinces = (): string[] => provinceNames

export const getCitiesByProvince = (province: string): string[] => {
  const normalizedProvince = normalizeKey(province)
  const exactProvinceCode = provinceCodeByKeyOrName.get(normalizedProvince)
  const provinceCodes = exactProvinceCode
    ? [exactProvinceCode]
    : (provinceCodesByRegion.get(normalizedProvince) || [])

  if (provinceCodes.length === 0) return []

  const provinceCodeSet = new Set(provinceCodes)

  return Array.from(
    new Set(
      philippines.cities
        .filter((city) => provinceCodeSet.has(city.province))
        .map((city) => city.name)
    )
  ).sort((a, b) => a.localeCompare(b))
}
