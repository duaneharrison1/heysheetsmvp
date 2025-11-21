import { ReactNode, useState, useRef, useEffect } from 'react';

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  allowOverflow?: boolean;
}

export function HoverTooltip({ content, children, side = 'bottom', allowOverflow = false }: HoverTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && allowOverflow && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();

      // Position tooltip to the right of the trigger element
      // Ensure it stays within viewport bounds
      const tooltipLeft = rect.right + 8; // 8px spacing
      const tooltipTop = rect.top;

      setPosition({
        top: tooltipTop,
        left: tooltipLeft,
      });
    }
  }, [isVisible, allowOverflow]);

  const sideClasses = {
    top: 'bottom-full left-0 mb-2',
    bottom: 'top-full left-0 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`${allowOverflow ? 'fixed' : 'absolute'} z-[100] ${!allowOverflow ? sideClasses[side] : ''} pointer-events-none`}
          role="tooltip"
          style={allowOverflow ? {
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          } : {}}
        >
          <div className="bg-gray-800 text-gray-100 text-xs rounded-md border border-gray-700 px-3 py-2 shadow-lg w-80 max-w-[90vw] max-h-[80vh] overflow-auto">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
