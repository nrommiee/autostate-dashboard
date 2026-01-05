import { cn } from '@/lib/utils'

const AutoStateLogo = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-6 h-6 text-white"
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {/* Équerre / Triangle ruler icon */}
          <path d="M3 21h18" />
          <path d="M3 21V3l18 18" />
          <path d="M7 17h4" />
          <path d="M11 13v4" />
        </svg>
      </div>
      <span className='text-xl font-semibold text-gray-900'>AutoState</span>
    </div>
  )
}

export default AutoStateLogo
