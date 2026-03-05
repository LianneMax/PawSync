'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const makeIcon = (color: 'red' | 'blue') =>
  L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })

const redIcon = makeIcon('red')
const blueIcon = makeIcon('blue')

export interface ScanLocation {
  lat: number
  lng: number
  scannedAt: string
}

interface ScanLocationsMapProps {
  locations: ScanLocation[]
  petName: string
}

export default function ScanLocationsMap({ locations, petName }: ScanLocationsMapProps) {
  if (!locations.length) return null

  // Sort oldest → newest so the last element is the most recent
  const sorted = [...locations].sort(
    (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
  )
  const latest = sorted[sorted.length - 1]
  const center: [number, number] = [latest.lat, latest.lng]

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '220px', width: '100%', borderRadius: '12px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sorted.map((loc, i) => {
        const isLatest = i === sorted.length - 1
        return (
          <Marker
            key={i}
            position={[loc.lat, loc.lng]}
            icon={isLatest ? redIcon : blueIcon}
          >
            <Popup>
              {isLatest ? (
                <><strong>Most Recent Sighting</strong><br /></>
              ) : (
                <><strong>Earlier Sighting</strong><br /></>
              )}
              <span className="text-xs text-gray-500">
                {new Date(loc.scannedAt).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
