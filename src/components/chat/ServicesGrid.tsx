import * as React from 'react'
import ServiceCard from './ServiceCard'
import { Button } from '@/components/ui/button'

export const ServicesGrid: React.FC<{
  services: any[]
  onActionClick?: (action: string, data?: any) => void
}> = ({ services, onActionClick }) => {
  const [showAll, setShowAll] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState<number>(() => 4)

  const computeVisibleCount = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024
    let cols = 1
    if (w >= 1024) cols = 3 // lg -> 3 columns on large screens
    else if (w >= 768) cols = 2 // md -> 2 columns on medium
    else if (w >= 640) cols = 2 // sm -> 2 columns on small
    else cols = 1 // base -> 1 column on mobile
    return cols * 2 // two rows
  }

  React.useEffect(() => {
    setVisibleCount(computeVisibleCount())
    const onResize = () => setVisibleCount(computeVisibleCount())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const total = services?.length || 0
  const showing = showAll ? total : Math.min(total, visibleCount)

  if (!services || services.length === 0) {
    return (
      <div className="mt-3 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">No services available at the moment.</p>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.slice(0, showing).map((service: any, idx: number) => (
          <div key={idx} className="w-full h-full">
            <ServiceCard service={service} onActionClick={onActionClick} />
          </div>
        ))}
      </div>

      {!showAll && total > visibleCount && (
        <div className="mt-3 flex justify-center">
          <Button onClick={() => setShowAll(true)} variant="outline">
            Show {total - visibleCount} more services
          </Button>
        </div>
      )}
    </div>
  )
}

export default ServicesGrid
