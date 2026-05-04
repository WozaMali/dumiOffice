import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { productsApi } from "@/lib/api/products";
import ProductCard from "@/components/ProductCard";
import FrontPopupModal from "@/components/FrontPopupModal";

const ShopMens = () => {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "mens"],
    queryFn: () => productsApi.getByCollectionCode("mens"),
  });

  return (
    <div className="min-h-screen">
      <FrontPopupModal code="home-entry" />
      {/* Storefront header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-sm md:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            <span>Back to Office</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/account"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Account
            </Link>
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/DUMI ESSENCE logo.png"
                alt="Dumi Essence"
                className="h-8 w-auto"
              />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
            Shop the House
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-foreground md:text-5xl">
            Men&apos;s Line
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Structured signatures with warmth, woods, and presence. Curated for
            the modern gentleman.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-[1.5rem] storefront-skeleton"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-[1.5rem] p-12 text-center storefront-media-bg">
            <p className="text-muted-foreground">
              No products in Men&apos;s Line yet. Add products with{" "}
              <code className="rounded-md border border-border/50 storefront-surface-chip px-1.5 py-0.5 text-xs">
                collection_code = &quot;mens&quot;
              </code>{" "}
              in the Content Studio.
            </p>
            <Link
              to="/content"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Go to Content Studio →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ShopMens;
