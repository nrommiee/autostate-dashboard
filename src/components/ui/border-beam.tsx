'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  borderWidth?: number
}

function BorderBeam({
  className,
  size = 100,
  delay = 0,
  duration = 8,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  borderWidth = 2
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden',
        className
      )}
    >
      {/* Border container */}
      <div 
        className='absolute inset-0 rounded-[inherit]'
        style={{
          padding: borderWidth,
          background: 'transparent',
        }}
      >
        {/* Animated gradient beam */}
        <svg
          className='absolute inset-0 h-full w-full rounded-[inherit]'
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id='beam-gradient' x1='0%' y1='0%' x2='100%' y2='0%'>
              <stop offset='0%' stopColor='transparent' />
              <stop offset='50%' stopColor={colorTo} />
              <stop offset='100%' stopColor={colorFrom} />
            </linearGradient>
          </defs>
          <motion.rect
            x='0'
            y='0'
            width='100%'
            height='100%'
            rx='20'
            ry='20'
            fill='none'
            stroke='url(#beam-gradient)'
            strokeWidth={borderWidth}
            strokeDasharray={`${size} 1000`}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -1100 }}
            transition={{
              duration,
              repeat: Infinity,
              ease: 'linear',
              delay,
            }}
          />
        </svg>
      </div>
    </div>
  )
}

export { BorderBeam, type BorderBeamProps }
