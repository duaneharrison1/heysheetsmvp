import * as React from 'react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, ShoppingCart } from 'lucide-react'

export const ProductCard: React.FC<{
  product: any
  onActionClick?: (action: string, data?: any) => void
  maxWidth?: string
}> = ({ product, onActionClick, maxWidth }) => {
  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full sm:max-w-sm'} border border-border shadow-sm hover:shadow-md transition-shadow`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <CardHeader className="pb-2 p-3 sm:p-4">
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/60 rounded-lg mb-2 flex items-center justify-center h-16 sm:h-20">
          <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
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
      <CardContent className="pt-0 p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2 leading-tight">{product.description}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            size="sm" 
            className="flex-1 min-w-0" 
            onClick={() => onActionClick?.('add_to_cart', product)} 
            disabled={parseInt(product.stock) === 0}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Add to Cart</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="px-3 sm:px-4 min-w-0" 
            onClick={() => onActionClick?.('view_details', product)}
          >
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProductCard
