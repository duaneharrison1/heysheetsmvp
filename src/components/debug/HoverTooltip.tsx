import { ReactNode, useState } from 'react';

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  allowOverflow?: boolean;
}

export function HoverTooltip({ content, children, side = 'bottom', allowOverflow = false }: HoverTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const sideClasses = {
    top: 'bottom-full left-0 mb-2',
    bottom: 'top-full left-0 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`${allowOverflow ? 'fixed' : 'absolute'} z-[100] ${sideClasses[side]} pointer-events-none`}
          role="tooltip"
          style={allowOverflow ? {
            position: 'fixed',
            left: 'auto',
            right: '1rem',
          } : {}}
        >
          <div className="bg-gray-800 text-gray-100 text-xs rounded-md border border-gray-700 px-3 py-2 shadow-lg w-80 max-w-[90vw]">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
