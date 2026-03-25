import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Product } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function resolveProductImageUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return path;
  if (!supabaseUrl) return path;
  return `${supabaseUrl}/storage/v1/object/public/product_assets/${path}`;
}

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const displayName = product.name ?? product.product_name ?? "Untitled";
  const price =
    product.base_price ??
    product.price_50ml ??
    product.price_30ml ??
    product.price_100ml ??
    product.price ??
    0;
  const size = product.default_size ?? "50ml";
  const code = product.code ?? product.sku ?? product.id;
  const imageUrl = resolveProductImageUrl(product.primary_image_path);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link
        to={`/product/${code}`}
        className="group block overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/40 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
      >
        <div className="relative aspect-[3/4] overflow-hidden storefront-media-bg">
          {imageUrl ? (
            <motion.img
              src={imageUrl}
              alt={displayName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              initial={{ scale: 1 }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background/40 to-accent/15">
              <p className="luxury-note mb-1">PRODUCT</p>
              <p className="text-xs text-muted-foreground">No image</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-between p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              View details
            </span>
            <ChevronRight size={16} className="text-primary" />
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {displayName}
          </h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              R{price.toFixed(2)}
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {size}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {product.is_bestseller && (
              <span className="rounded-full bg-primary/15 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wider text-primary">
                Bestseller
              </span>
            )}
            {product.is_new && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                New
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
