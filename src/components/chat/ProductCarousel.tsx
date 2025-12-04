import React, { useRef, useState, useEffect } from 'react';
import ProductCard from './ProductCard';

interface ProductCarouselProps {
  products: any[];
  onActionClick?: (action: string, data?: any) => void;
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({ products, onActionClick }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Refs for each product item to measure heights
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [maxItemHeight, setMaxItemHeight] = useState<number | null>(null);

  const measureHeights = () => {
    const heights = itemRefs.current.map(el => el ? Math.ceil(el.getBoundingClientRect().height) : 0);
    const mh = heights.length ? Math.max(...heights) : 0;
    setMaxItemHeight(mh || null);
  };

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    const tolerance = 4; // small tolerance for rounding
    setCanScrollLeft(scrollLeft > tolerance);
    setCanScrollRight(scrollLeft < maxScrollLeft - tolerance);
  };

  const scrollBy = (delta: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    // after scrolling, update button states (allow smooth scroll to finish)
    setTimeout(updateScrollButtons, 250);
  };

  useEffect(() => {
    updateScrollButtons();
    // measure heights after a tick to ensure DOM is painted
    setTimeout(measureHeights, 50);
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    el.addEventListener('scroll', onScroll, { passive: true });

    // ResizeObserver to detect size changes (images loading, font changes, etc.)
    let ro: ResizeObserver | null = null;
    try {
      if ((window as any).ResizeObserver) {
        ro = new ResizeObserver(() => {
          measureHeights();
          updateScrollButtons();
        });
        itemRefs.current.forEach((it) => { if (it) ro!.observe(it); });
      }
    } catch (e) {
      ro = null;
    }

    const onResize = () => { updateScrollButtons(); measureHeights(); };
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (ro) {
        try { ro.disconnect(); } catch (_) { /* ignore */ }
      }
    };
  }, [products]);

  return (
    <div className="relative mt-3">
      <button
        onClick={() => scrollBy(-300)}
        disabled={!canScrollLeft}
        aria-disabled={!canScrollLeft}
        className={`absolute left-0 top-1/2 transform -translate-y-1/2 bg-primary text-white p-1.5 rounded-full shadow-md z-10 ${!canScrollLeft ? 'opacity-40 pointer-events-none' : ''}`}
        aria-label="Previous products"
      >
        ←
      </button>

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto no-scrollbar px-4 py-2 w-full box-border">
        {products.map((product: any, index: number) => (
          <div
            key={index}
            ref={(el) => { itemRefs.current[index] = el; }}
            className="flex-shrink-0 w-48 sm:w-56 md:w-64 box-border"
            style={maxItemHeight ? { minHeight: `${maxItemHeight}px` } : undefined}
          >
            <ProductCard product={product} onActionClick={onActionClick} />
          </div>
        ))}
      </div>

      <button
        onClick={() => scrollBy(300)}
        disabled={!canScrollRight}
        aria-disabled={!canScrollRight}
        className={`absolute right-0 top-1/2 transform -translate-y-1/2 bg-primary text-white p-1.5 rounded-full shadow-md z-10 ${!canScrollRight ? 'opacity-40 pointer-events-none' : ''}`}
        aria-label="Next products"
      >
        →
      </button>
    </div>
  );
};

export default ProductCarousel;
