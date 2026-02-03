'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface PawPrint {
  id: number
  x: number
  y: number
  rotation: number
  isLeft: boolean
}

const PawIcon = ({ isLeft, rotation }: { isLeft: boolean; rotation: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-10 h-10 text-[#5A7C7A]"
    style={{
      transform: `rotate(${rotation}deg) ${isLeft ? 'scaleX(-1)' : ''}`,
    }}
  >
    {/* Main pad */}
    <ellipse cx="12" cy="14" rx="5" ry="4.5" />
    {/* Toe pads */}
    <ellipse cx="7.5" cy="8" rx="2" ry="2.5" />
    <ellipse cx="12" cy="6" rx="2" ry="2.5" />
    <ellipse cx="16.5" cy="8" rx="2" ry="2.5" />
  </svg>
)

export default function PawPrints() {
  const [prints, setPrints] = useState<PawPrint[]>([])
  const printIdRef = useRef(0)
  const trailRef = useRef({
    x: 0,
    y: 0,
    direction: 0,
    isLeft: true,
    stepCount: 0
  })

  // Start a new trail from a random edge
  const startNewTrail = () => {
    const edge = Math.floor(Math.random() * 4)
    let x: number, y: number, direction: number

    switch (edge) {
      case 0: // left edge
        x = 5
        y = 20 + Math.random() * 60
        direction = -20 + Math.random() * 40 // going right
        break
      case 1: // right edge
        x = 95
        y = 20 + Math.random() * 60
        direction = 160 + Math.random() * 40 // going left
        break
      case 2: // top edge
        x = 20 + Math.random() * 60
        y = 5
        direction = 70 + Math.random() * 40 // going down
        break
      default: // bottom edge
        x = 20 + Math.random() * 60
        y = 95
        direction = 250 + Math.random() * 40 // going up
        break
    }

    trailRef.current = {
      x,
      y,
      direction,
      isLeft: true,
      stepCount: 0
    }
  }

  useEffect(() => {
    // Start first trail immediately
    startNewTrail()

    const addPrint = () => {
      const trail = trailRef.current

      // Add new print at current position
      // Rotation: paw SVG has toes pointing UP by default
      // direction 0 = moving right, 90 = moving down, 180 = moving left, 270 = moving up
      // To make toes point in direction of travel: rotate by (direction - 90)
      // direction 0 (right) -> rotate -90 (toes point right)
      // direction 90 (down) -> rotate 0 (toes point down)
      // direction 180 (left) -> rotate 90 (toes point left)
      // direction 270 (up) -> rotate 180 (toes point up)
      const newPrint: PawPrint = {
        id: printIdRef.current++,
        x: trail.x,
        y: trail.y,
        rotation: trail.direction - 90,
        isLeft: trail.isLeft
      }

      setPrints(prev => [...prev.slice(-8), newPrint]) // Keep last 8 prints

      // Calculate next position
      const radians = (trail.direction * Math.PI) / 180
      const stepSize = 12 // More spaced apart
      const wobble = (trail.isLeft ? 1 : -1) * 3
      const perpRadians = ((trail.direction + 90) * Math.PI) / 180

      trail.x += Math.cos(radians) * stepSize + Math.cos(perpRadians) * wobble
      trail.y += Math.sin(radians) * stepSize + Math.sin(perpRadians) * wobble
      trail.isLeft = !trail.isLeft
      trail.stepCount++

      // Start new trail if out of bounds or walked enough
      if (trail.x < -5 || trail.x > 105 || trail.y < -5 || trail.y > 105 || trail.stepCount > 8) {
        startNewTrail()
      }
    }

    // Add prints at intervals (slower for more spacing)
    const interval = setInterval(addPrint, 900)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[5]">
      <AnimatePresence>
        {prints.map((print) => (
          <motion.div
            key={print.id}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 0.18, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{
              duration: 0.4,
              ease: "easeOut"
            }}
            style={{
              position: 'absolute',
              left: `${print.x}%`,
              top: `${print.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <PawIcon isLeft={print.isLeft} rotation={print.rotation} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
