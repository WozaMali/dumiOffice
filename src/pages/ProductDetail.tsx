import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { productsApi } from "@/lib/api/products";
import { collectionsApi } from "@/lib/api/collections";
import FrontPopupModal from "@/components/FrontPopupModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import StorefrontAuthDialog from "@/components/StorefrontAuthDialog";
import { useState } from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function resolveProductImageUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return path;
  if (!supabaseUrl) return path;
  return `${supabaseUrl}/storage/v1/object/public/product_assets/${path}`;
}

const ProductDetail = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", code],
    queryFn: () => productsApi.getByCode(code!),
    enabled: !!code,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: collectionsApi.list,
  });

  const collection = product?.collection_code
    ? collections.find((c) => c.code === product.collection_code)
    : null;
  const lineLabel = collection?.name ?? product?.collection_code?.toUpperCase() ?? "";

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No product code in URL.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Product not found.</p>
        <Link to="/shop/mens" className="text-sm text-primary hover:underline">
          ← Back to Men&apos;s Line
        </Link>
      </div>
    );
  }

  const displayName = product.name ?? product.product_name ?? "Untitled";
  const sizeOptions = [
    product.price_30ml != null && {
      key: "30ml",
      label: "30ml",
      price: product.price_30ml!,
    },
    product.price_50ml != null && {
      key: "50ml",
      label: "50ml",
      price: product.price_50ml!,
    },
    product.price_100ml != null && {
      key: "100ml",
      label: "100ml",
      price: product.price_100ml!,
    },
  ].filter(Boolean) as { key: string; label: string; price: number }[];

  const hasSizeOptions = sizeOptions.length > 0;
  const [selectedSizeKey] = [hasSizeOptions ? sizeOptions[0].key : "default"];
  const selectedSize = hasSizeOptions
    ? sizeOptions.find((s) => s.key === selectedSizeKey) ?? sizeOptions[0]
    : null;

  const price = hasSizeOptions
    ? selectedSize!.price
    : product.base_price ?? product.price ?? 0;
  const size = hasSizeOptions
    ? selectedSize!.label
    : product.default_size ?? "50ml";
  const imageUrl = resolveProductImageUrl(product.primary_image_path);

  const handleCheckoutIntent = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigate("/walk-in");
      return;
    }
    setAuthDialogOpen(true);
  };

  return (
    <div className="min-h-screen">
      <FrontPopupModal code="home-entry" />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-sm md:px-6">
          <Link
            to="/shop/mens"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            <span>Back to Men&apos;s Line</span>
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-10 lg:grid-cols-2"
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-[1.5rem] storefront-media-bg">
            {imageUrl ? (
              <motion.img
                src={imageUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                initial={{ scale: 1.02 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background/40 to-accent/15">
                <p className="luxury-note mb-1">PRODUCT IMAGE</p>
                <p className="text-xs text-muted-foreground">No image set</p>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
              {lineLabel || "COLLECTION"}
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-foreground md:text-5xl">
              {displayName}
            </h1>
            <p className="mt-4 text-2xl font-medium text-foreground">
              R{price.toFixed(2)} · {size}
            </p>
            {hasSizeOptions && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {sizeOptions.map((option) => (
                  <div
                    key={option.key}
                    className="storefront-surface-chip px-4 py-2"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      {option.label}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      R{option.price.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {product.short_description && (
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {product.short_description}
              </p>
            )}
            {product.long_description && (
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {product.long_description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {product.is_bestseller && (
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                  Bestseller
                </span>
              )}
              {product.is_new && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-400">
                  New
                </span>
              )}
            </div>
            <div className="mt-6">
              <Button onClick={handleCheckoutIntent}>
                Checkout securely
              </Button>
            </div>
            {product.reassurance_copy && (
              <div className="storefront-reassurance-panel mt-8 w-full max-w-sm text-[13px] leading-7 text-muted-foreground">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
                  Luxury reassurance
                </p>
                {product.reassurance_copy.split(/\n{2,}/).map((para, idx) => (
                  <p key={idx} className={idx > 0 ? "mt-3" : undefined}>
                    {para.trim()}
                  </p>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </main>
      <StorefrontAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onSuccess={() => navigate("/walk-in")}
        redirectPath="/walk-in"
      />
    </div>
  );
};

export default ProductDetail;
