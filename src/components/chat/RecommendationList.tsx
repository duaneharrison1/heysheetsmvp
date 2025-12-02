import * as React from 'react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calendar, Info, Star, ShoppingBag, Sparkles } from 'lucide-react'

interface RecommendationItem {
  _type?: 'service' | 'product'
  _name?: string
  _score?: number
  _reasoning?: string
  // Service fields
  serviceName?: string
  // Product fields
  name?: string
  // Common fields
  category?: string
  price?: number | string
  duration?: number
  description?: string
  image?: string
  imageURL?: string
  tags?: string
}

interface RecommendationCardProps {
  item: RecommendationItem
  rank: number
  onActionClick?: (action: string, data?: any) => void
  maxWidth?: string
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ item, rank, onActionClick, maxWidth }) => {
  const isService = item._type === 'service'
  const displayName = item._name || item.serviceName || item.name || 'Unknown'
  const imageUrl = item.image || item.imageURL
  const score = item._score || 0
  const reasoning = item._reasoning || 'Matches your preferences'

  // Determine score badge color
  const getScoreBadgeVariant = () => {
    if (score >= 85) return 'default' // Primary color for excellent matches
    if (score >= 70) return 'secondary'
    return 'outline'
  }

  return (
    <Card
      className={`w-full mx-auto ${maxWidth ? '' : 'max-w-full'} border border-border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col relative overflow-hidden`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {/* Rank badge */}
      <div className="absolute top-2 left-2 z-10">
        <Badge variant="default" className="bg-primary text-primary-foreground font-bold px-2 py-0.5">
          #{rank}
        </Badge>
      </div>

      <CardHeader className="pb-3 p-3 sm:p-6 pt-10 sm:pt-12">
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/60 rounded-lg mb-2 flex items-center justify-center h-16 sm:h-20 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : isService ? (
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
          ) : (
            <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-semibold text-foreground flex-1 leading-tight line-clamp-2">
            {displayName}
          </CardTitle>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {isService && item.duration && (
              <Badge variant="secondary">{item.duration} min</Badge>
            )}
            <Badge variant={getScoreBadgeVariant()} className="text-xs">
              <Star className="h-3 w-3 mr-1" />
              {Math.round(score)}% match
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-muted-foreground">
          <Badge variant="outline" className="w-fit text-xs">
            {isService ? 'Service' : 'Product'}
          </Badge>
          {item.category && (
            <>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="text-xs sm:text-sm">{item.category}</span>
            </>
          )}
          {item.price && (
            <>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="text-lg sm:text-xl font-bold text-primary">
                ${typeof item.price === 'number' ? item.price : item.price}
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 p-3 sm:p-6 flex-1 flex flex-col">
        {/* Why recommended */}
        <div className="mb-3 p-2 bg-muted/50 rounded-md">
          <div className="flex items-start gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground italic">{reasoning}</p>
          </div>
        </div>

        {item.description && (
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="flex flex-col gap-2 mt-auto">
          {isService ? (
            <>
              <Button
                size="sm"
                className="w-full flex justify-center items-center"
                onClick={() => onActionClick?.('book_service', item)}
              >
                <span className="flex items-center justify-center gap-2 w-full">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate text-center">Book Now</span>
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full px-3 sm:px-4 flex justify-center items-center"
                onClick={() => onActionClick?.('view_details', item)}
              >
                <span className="flex items-center justify-center gap-2 w-full">
                  <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate text-center">Details</span>
                </span>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="w-full flex justify-center items-center"
                onClick={() => onActionClick?.('add_to_cart', item)}
              >
                <span className="flex items-center justify-center gap-2 w-full">
                  <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate text-center">Add to Cart</span>
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full px-3 sm:px-4 flex justify-center items-center"
                onClick={() => onActionClick?.('view_details', item)}
              >
                <span className="flex items-center justify-center gap-2 w-full">
                  <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate text-center">Details</span>
                </span>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface PreferencesUsed {
  goal?: string
  experience_level?: string
  budget?: string
  time_preference?: string
  category?: string
}

export const RecommendationList: React.FC<{
  recommendations: RecommendationItem[]
  preferences?: PreferencesUsed
  onActionClick?: (action: string, data?: any) => void
}> = ({ recommendations, preferences, onActionClick }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="mt-3 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          No recommendations found matching your criteria. Try adjusting your preferences.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3">
      {/* Preferences summary */}
      {preferences && Object.keys(preferences).some(k => preferences[k as keyof PreferencesUsed]) && (
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Based on your preferences:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {preferences.goal && (
              <Badge variant="outline" className="text-xs">
                Goal: {preferences.goal.length > 30 ? preferences.goal.substring(0, 30) + '...' : preferences.goal}
              </Badge>
            )}
            {preferences.experience_level && preferences.experience_level !== 'any' && (
              <Badge variant="outline" className="text-xs capitalize">
                {preferences.experience_level} level
              </Badge>
            )}
            {preferences.budget && preferences.budget !== 'any' && (
              <Badge variant="outline" className="text-xs capitalize">
                {preferences.budget} budget
              </Badge>
            )}
            {preferences.time_preference && preferences.time_preference !== 'any' && (
              <Badge variant="outline" className="text-xs capitalize">
                {preferences.time_preference}
              </Badge>
            )}
            {preferences.category && (
              <Badge variant="outline" className="text-xs">
                {preferences.category}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Recommendations grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((item, idx) => (
          <div key={idx} className="w-full h-full">
            <RecommendationCard
              item={item}
              rank={idx + 1}
              onActionClick={onActionClick}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default RecommendationList
