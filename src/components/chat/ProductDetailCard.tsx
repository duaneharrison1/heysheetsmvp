import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { AspectRatio } from "../ui/aspect-ratio";
import { H2 } from "../ui/heading";

interface ProductDetailCardProps {
  title: string;
  price: string;
  images: string[];
  description: string;
  specifications?: React.ReactNode;
  reviews?: React.ReactNode;
}

const ProductDetailCard: React.FC<ProductDetailCardProps> = ({
  title,
  price,
  images,
  description,
  specifications,
  reviews,
}) => {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6 md:gap-10 items-start">
          <div className="flex-1 min-w-0 flex justify-center items-center mb-4 md:mb-0 basis-64 max-w-[400px]">
            <div className="w-full">
              {images.length > 0 && (
                <AspectRatio ratio={1} className="w-full">
                  <img
                    src={images[0]}
                    alt="Product image"
                    className="w-full h-full object-cover rounded-lg border min-h-[180px] max-h-[320px]"
                  />
                </AspectRatio>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-4 basis-64">
            <div>
              <H2 className="mb-1">{price}</H2>
            </div>
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="mb-2 flex flex-wrap">
                <TabsTrigger value="description">Description</TabsTrigger>
                {specifications && <TabsTrigger value="specs">Specifications</TabsTrigger>}
                {reviews && <TabsTrigger value="reviews">Reviews</TabsTrigger>}
              </TabsList>
              <TabsContent value="description">
                <CardDescription className="break-words">{description}</CardDescription>
              </TabsContent>
              {specifications && (
                <TabsContent value="specs">{specifications}</TabsContent>
              )}
              {reviews && <TabsContent value="reviews">{reviews}</TabsContent>}
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductDetailCard;
