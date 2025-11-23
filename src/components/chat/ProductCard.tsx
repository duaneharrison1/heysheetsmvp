import * as React from 'react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, ShoppingCart, Info } from 'lucide-react'

export const ProductCard: React.FC<{
  product: any
  onActionClick?: (action: string, data?: any) => void
  maxWidth?: string
}> = ({ product, onActionClick, maxWidth }) => {
  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full sm:max-w-sm'} border border-border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-2 p-3 sm:p-4">
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/60 rounded-lg mb-2 flex items-center justify-center h-16 sm:h-20 overflow-hidden">
          {product?.image ? (
            <img
              src={product.image}
              alt={product.name || 'product image'}
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : (
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
          )}
        </div>
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground truncate leading-tight">
          {product.name}
        </CardTitle>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm sm:text-base font-bold text-primary">${product.price}</span>
          <Badge variant={parseInt(product.stock) > 0 ? 'default' : 'destructive'}>
            {parseInt(product.stock) > 0 ? `${product.stock}` : 'Out'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-3 sm:p-4 flex-1 flex flex-col">
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-3 leading-tight">{product.description}</p>
        <div className="flex flex-col gap-2 mt-auto">
          <Button
            size="sm"
            className="w-full flex justify-center items-center"
            onClick={() => onActionClick?.('add_to_cart', product)}
            disabled={parseInt(product.stock) === 0}
          >
            <span className="flex items-center justify-center gap-2 w-full">
              <ShoppingCart className="h-3 w-3" />
              <span className="hidden sm:inline truncate text-center">Add to Cart</span>
              <span className="sm:hidden truncate text-center">Add</span>
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full px-3 sm:px-4 flex justify-center items-center"
            onClick={() => onActionClick?.('view_details', product)}
          >
            <span className="flex items-center justify-center gap-2 w-full">
              <Info className="h-3 w-3" />
              <span className="truncate text-center">Details</span>
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProductCard
