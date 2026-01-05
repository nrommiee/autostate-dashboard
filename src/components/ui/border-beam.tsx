'use client'

import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  style?: CSSProperties
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
}

function BorderBeam({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = '#0d9488',
  colorTo = '#14b8a6',
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5
}: BorderBeamProps) {
  return (
    <div
      className='pointer-events-none absolute inset-0 rounded-[inherit]'
      style={{
        border: `${borderWidth}px solid transparent`,
        WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude'
      }}
    >
      <motion.div
        className={cn(
          'absolute aspect-square rounded-full',
          className
        )}
        style={{
          width: size,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`]
        }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration,
          delay: -delay
        }}
      />
    </div>
  )
}

export { BorderBeam, type BorderBeamProps }
