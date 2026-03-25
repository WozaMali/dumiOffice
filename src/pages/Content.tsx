import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Image, Sparkles, Clock, Edit, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { collectionsApi } from "@/lib/api/collections";
import { productsApi } from "@/lib/api/products";
import { homeHeroApi } from "@/lib/api/homeHero";
import { homeBestsellersApi } from "@/lib/api/homeBestsellers";
import { productContentApi } from "@/lib/api/productContent";
import { frontPopupApi } from "@/lib/api/frontPopup";
import { supabase } from "@/lib/supabase";
import type {
  Collection,
  HomeBestseller,
  HomeHeroSlide,
  Product,
  ProductImage,
  ProductNote,
  FrontPopup,
} from "@/types/database";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  Active: "status-pill-success",
  Live: "status-pill-success",
  Scheduled: "status-pill-gold",
  Draft: "status-pill-muted",
};

const Content = () => {
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const collectionImageInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImageInputRef = useRef<HTMLInputElement | null>(null);
  const productImageInputRef = useRef<HTMLInputElement | null>(null);

  const { data: heroSlides = [] } = useQuery<HomeHeroSlide[]>({
    queryKey: ["homeHeroSlides"],
    queryFn: homeHeroApi.list,
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: collectionsApi.list,
  });

  const { data: collectionProducts = [] } = useQuery({
    queryKey: ["collectionProducts"],
    queryFn: collectionsApi.listCollectionProducts,
  });

  const { data: frontPopup } = useQuery<FrontPopup | null>({
    queryKey: ["frontPopup", "home-entry"],
    queryFn: () => frontPopupApi.getByCode("home-entry"),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const { data: contentProducts = [] } = useQuery<Product[]>({
    queryKey: ["contentProducts"],
    queryFn: productContentApi.list,
  });

  const groupedContentProducts = (() => {
    const groups: {
      mens: Product[];
      womens: Product[];
      unisex: Product[];
      diffusers: Product[];
      carDiffusers: Product[];
      other: Product[];
    } = {
      mens: [],
      womens: [],
      unisex: [],
      diffusers: [],
      carDiffusers: [],
      other: [],
    };

    contentProducts.forEach((p) => {
      // Product category drives the "line" grouping for non-perfume items.
      if (p.product_category === "Diffuser") {
        groups.diffusers.push(p);
        return;
      }
      if (p.product_category === "Car Perfume") {
        groups.carDiffusers.push(p);
        return;
      }

      const raw =
        (p.collection_code ??
          (p.category as string | undefined) ??
          (p.product_category as string | undefined) ??
          "") || "";
      const col = raw.toLowerCase();
      const norm = col.replace(/[^a-z]/g, "");

      if (norm.startsWith("men")) {
        groups.mens.push(p);
      } else if (norm.startsWith("women")) {
        groups.womens.push(p);
      } else if (norm.includes("unisex")) {
        groups.unisex.push(p);
      } else {
        groups.other.push(p);
      }
    });

    return groups;
  })();

  const { data: homeBestsellers = [] } = useQuery<HomeBestseller[]>({
    queryKey: ["homeBestsellers"],
    queryFn: homeBestsellersApi.list,
  });

  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editingHero, setEditingHero] = useState<HomeHeroSlide | null>(null);
  const [isHeroDialogOpen, setIsHeroDialogOpen] = useState(false);
  const [managingProductsFor, setManagingProductsFor] = useState<Collection | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    hero_image_url: "",
  });
  const [heroForm, setHeroForm] = useState({
    code: "",
    kicker: "",
    headline: "",
    subheadline: "",
    body: "",
    primaryCtaLabel: "",
    primaryCtaHref: "",
    backgroundImageUrl: "",
    galleryImageUrls: [] as string[],
  });
  const [editingBestseller, setEditingBestseller] =
    useState<HomeBestseller | null>(null);
  const [bestsellerForm, setBestsellerForm] = useState<{
    productId: string;
    badgeLabel: string;
    sortOrder: string;
    isActive: boolean;
  }>({
    productId: "",
    badgeLabel: "Bestseller",
    sortOrder: "0",
    isActive: true,
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productPreviewImageUrl, setProductPreviewImageUrl] = useState<string | null>(null);
  const [productTab, setProductTab] = useState<
    "basic" | "imagery" | "notes" | "pricing" | "promo"
  >("basic");
  const [productForm, setProductForm] = useState<{
    code: string;
    sku: string;
    name: string;
    collectionCode: string;
    category: string;
    shortDescription: string;
    longDescription: string;
     reassuranceCopy: string;
     has30ml: boolean;
     price30ml: string;
     has50ml: boolean;
     price50ml: string;
     has100ml: boolean;
     price100ml: string;
    basePrice: string;
    defaultSize: string;
    isBestseller: boolean;
    isFeatured: boolean;
    isNew: boolean;
    primaryImagePath: string;
  }>({
    code: "",
    sku: "",
    name: "",
    collectionCode: "",
    category: "",
    shortDescription: "",
    longDescription: "",
    reassuranceCopy: "",
    has30ml: false,
    price30ml: "",
    has50ml: true,
    price50ml: "",
    has100ml: false,
    price100ml: "",
    basePrice: "",
    defaultSize: "50ml",
    isBestseller: false,
    isFeatured: false,
    isNew: false,
    primaryImagePath: "",
  });
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [productNotes, setProductNotes] = useState<ProductNote[]>([]);

  const [popupForm, setPopupForm] = useState<{
    headline: string;
    body: string;
    imageUrl: string;
    ctaLabel: string;
    ctaHref: string;
    dismissDays: string;
    isActive: boolean;
  }>({
    headline: "",
    body: "",
    imageUrl: "",
    ctaLabel: "",
    ctaHref: "",
    dismissDays: "7",
    isActive: true,
  });

  useEffect(() => {
    if (frontPopup) {
      setPopupForm({
        headline: frontPopup.headline ?? "",
        body: frontPopup.body ?? "",
        imageUrl: frontPopup.image_url ?? "",
        ctaLabel: frontPopup.cta_label ?? "",
        ctaHref: frontPopup.cta_href ?? "",
        dismissDays: String(frontPopup.dismiss_days ?? 7),
        isActive: frontPopup.is_active,
      });
    }
  }, [frontPopup]);

  const editCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setForm({
      name: collection.name,
      tagline: collection.tagline ?? "",
      description: collection.description ?? "",
      hero_image_url: collection.hero_image_url ?? "",
    });
  };

  const editHero = (slide: HomeHeroSlide) => {
    setEditingHero(slide);
    setHeroForm({
      code: slide.code,
      kicker: slide.kicker ?? "",
      headline: slide.headline,
      subheadline: slide.subheadline ?? "",
      body: slide.body ?? "",
      primaryCtaLabel: slide.primary_cta_label ?? "",
      primaryCtaHref: slide.primary_cta_href ?? "",
      backgroundImageUrl: slide.background_image_url ?? "",
      galleryImageUrls: slide.gallery_image_urls ?? [],
    });
  };

  const upsertMutation = useMutation({
    mutationFn: async (payload: { code: string; slug?: string }) => {
      let heroUrl = form.hero_image_url.trim() || undefined;
      if (heroUrl && !heroUrl.startsWith("http")) {
        const base = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
        if (base) {
          const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
          heroUrl = heroUrl.startsWith("/")
            ? `${base}/storage/v1/object/public/product_assets/${encodePath(heroUrl.slice(1))}`
            : `${base}/storage/v1/object/public/hero-assets/${encodePath(heroUrl)}`;
        }
      }
      return collectionsApi.upsertByCode({
        code: payload.code,
        slug: payload.slug,
        name: form.name.trim(),
        tagline: form.tagline.trim() || undefined,
        description: form.description.trim() || undefined,
        hero_image_url: heroUrl,
      });
    },
    onSuccess: () => {
      toast.success("Collection updated for storefront.");
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setEditingCollection(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update collection.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Name is required.");
      return;
    }
    upsertMutation.mutate({ code: (editingCollection as any).code ?? editingCollection.slug, slug: editingCollection.slug });
  };

  const heroUpsertMutation = useMutation({
    mutationFn: async () => {
      const trimmedHeadline = heroForm.headline.trim();
      if (!trimmedHeadline) {
        throw new Error("Headline is required.");
      }
      const code = heroForm.code.trim() || editingHero?.code;
      if (!code) {
        throw new Error("Internal code is required.");
      }
      return homeHeroApi.upsertByCode({
        code,
        kicker: heroForm.kicker.trim() || undefined,
        headline: trimmedHeadline,
        subheadline: heroForm.subheadline.trim() || undefined,
        body: heroForm.body.trim() || undefined,
        primary_cta_label: heroForm.primaryCtaLabel.trim() || undefined,
        primary_cta_href: heroForm.primaryCtaHref.trim() || undefined,
        background_image_url: heroForm.backgroundImageUrl.trim() || undefined,
        gallery_image_urls:
          heroForm.galleryImageUrls && heroForm.galleryImageUrls.length
            ? heroForm.galleryImageUrls
            : undefined,
        is_active: true,
      });
    },
    onSuccess: () => {
      toast.success("Hero slide saved.");
      queryClient.invalidateQueries({ queryKey: ["homeHeroSlides"] });
      setEditingHero(null);
      setIsHeroDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save hero slide.");
    },
  });

  const heroDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return homeHeroApi.delete(id);
    },
    onSuccess: () => {
      toast.success("Hero slide deleted.");
      queryClient.invalidateQueries({ queryKey: ["homeHeroSlides"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete hero slide.");
    },
  });

  const pdfUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return homeHeroApi.uploadPdf(file);
    },
    onSuccess: (path) => {
      setHeroForm((f) => ({
        ...f,
        primaryCtaHref: path,
      }));
      toast.success("PDF uploaded for hero slide.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload PDF.");
    },
  });

  const imageUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return homeHeroApi.uploadImage(file);
    },
    onSuccess: (path) => {
      setHeroForm((f) => ({
        ...f,
        backgroundImageUrl: path,
      }));
      toast.success("Hero image uploaded.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload hero image.");
    },
  });

  const galleryUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploads = await Promise.all(
        files.map((file) => homeHeroApi.uploadImage(file)),
      );
      return uploads;
    },
    onSuccess: (paths) => {
      setHeroForm((f) => ({
        ...f,
        galleryImageUrls: [...(f.galleryImageUrls ?? []), ...paths],
      }));
      toast.success("Gallery images uploaded.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload gallery images.");
    },
  });

  const bestsellerMutation = useMutation({
    mutationFn: async () => {
      if (!bestsellerForm.productId) {
        throw new Error("Select a product for the bestseller slot.");
      }
      const sort = Number(bestsellerForm.sortOrder || "0") || 0;
      return homeBestsellersApi.upsert({
        id: editingBestseller?.id,
        product_id: bestsellerForm.productId,
        badge_label: bestsellerForm.badgeLabel.trim() || undefined,
        sort_order: sort,
        is_active: bestsellerForm.isActive,
      });
    },
    onSuccess: () => {
      toast.success("Home bestseller saved.");
      queryClient.invalidateQueries({ queryKey: ["homeBestsellers"] });
      setEditingBestseller(null);
      setBestsellerForm({
        productId: "",
        badgeLabel: "Bestseller",
        sortOrder: "0",
        isActive: true,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save bestseller.");
    },
  });

  const bestsellerDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return homeBestsellersApi.delete(id);
    },
    onSuccess: () => {
      toast.success("Bestseller deleted.");
      queryClient.invalidateQueries({ queryKey: ["homeBestsellers"] });
      setEditingBestseller(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete bestseller.");
    },
  });

  const collectionImageUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return homeHeroApi.uploadImage(file);
    },
    onSuccess: (path) => {
      const base = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
      const fullUrl = base
        ? `${base}/storage/v1/object/public/hero-assets/${path}`
        : path;
      setForm((f) => ({
        ...f,
        hero_image_url: fullUrl,
      }));
      toast.success("Collection image uploaded.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload collection image.");
    },
  });

  const popupMutation = useMutation({
    mutationFn: async () => {
      const days = Number(popupForm.dismissDays || "7") || 7;
      return frontPopupApi.upsertByCode({
        code: "home-entry",
        is_active: popupForm.isActive,
        headline: popupForm.headline.trim() || undefined,
        body: popupForm.body.trim() || undefined,
        image_url: popupForm.imageUrl.trim() || undefined,
        cta_label: popupForm.ctaLabel.trim() || undefined,
        cta_href: popupForm.ctaHref.trim() || undefined,
        dismiss_days: days,
      });
    },
    onSuccess: () => {
      toast.success("Front-facing popup updated.");
      queryClient.invalidateQueries({ queryKey: ["frontPopup", "home-entry"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save popup.");
    },
  });

  const productDeleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      return productContentApi.deleteProduct(productId);
    },
    onSuccess: () => {
      toast.success("Product deleted.");
      queryClient.invalidateQueries({ queryKey: ["contentProducts"] });
      queryClient.invalidateQueries({ queryKey: ["homeBestsellers"] });
      if (editingProduct?.id) {
        setEditingProduct(null);
        setProductTab("basic");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete product.");
    },
  });

  const popupImageUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return frontPopupApi.uploadImage(file);
    },
    onSuccess: (path) => {
      const base = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
      const fullUrl = base ? `${base}/storage/v1/object/public/hero-assets/${path}` : path;
      setPopupForm((f) => ({ ...f, imageUrl: fullUrl }));
      toast.success("Popup image uploaded.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload popup image.");
    },
  });

  const productImageUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const bucket = "product_assets";
      const path = `products/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file);
      if (error || !data) {
        throw error || new Error("Failed to upload product image");
      }
      return data.path;
    },
    onSuccess: (path) => {
      setProductForm((f) => ({
        ...f,
        primaryImagePath: path,
      }));
      toast.success("Product image uploaded.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload product image.");
    },
  });

  const galleryImageUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!editingProduct) {
        throw new Error("No product selected.");
      }
      const bucket = "product_assets";
      const path = `products/gallery/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file);
      if (error || !data) {
        throw error || new Error("Failed to upload gallery image");
      }
      const sortOrder =
        productImages.length > 0
          ? Math.max(...productImages.map((p) => p.sort_order)) + 1
          : 0;
      const img = await productContentApi.addImage({
        product_id: editingProduct.id,
        kind: "gallery",
        path: data.path,
        sort_order: sortOrder,
      });
      return img;
    },
    onSuccess: (img) => {
      setProductImages((arr) => [...arr, img]);
      toast.success("Gallery image added.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to upload gallery image.");
    },
  });

  const getCollectionByCode = (code: string): Collection | undefined =>
    collections.find((c) => (c as any).code === code);

  const activeHero = useMemo(() => {
    if (!heroSlides.length) return null;
    const candidates = heroSlides
      .filter((h) => h.is_active)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.created_at.localeCompare(b.created_at);
      });
    if (candidates.length) return candidates[0];
    return heroSlides[0];
  }, [heroSlides]);
  const supabaseUrl =
    (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;

  const encodeStoragePath = (path: string) =>
    path.split("/").map(encodeURIComponent).join("/");

  const resolveHeroImageUrl = (path?: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return path;
    if (!supabaseUrl) return path;
    return `${supabaseUrl}/storage/v1/object/public/hero-assets/${encodeStoragePath(path)}`;
  };

  const resolveCollectionImageUrl = (path?: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (!supabaseUrl) return path;
    if (path.startsWith("/")) {
      return `${supabaseUrl}/storage/v1/object/public/product_assets/${encodeStoragePath(path.slice(1))}`;
    }
    return `${supabaseUrl}/storage/v1/object/public/hero-assets/${encodeStoragePath(path)}`;
  };

  const pictureCards = useMemo(() => {
    if (!collectionProducts.length || !collections.length) return [];
    return collectionProducts.slice(0, 8).map((cp: any) => {
      const col = cp.collections as Collection;
      const prod = cp.products as any;
      return {
        title: prod?.product_name ?? "Untitled product",
        type: col?.name ?? "Collection",
        status: col?.is_active ? "Live" : "Draft",
      };
    });
  }, [collectionProducts, collections]);

  const productsForManaging = useMemo(() => {
    if (!managingProductsFor) return [];
    return collectionProducts.filter(
      (cp: any) => cp.collection_id === managingProductsFor.id,
    );
  }, [collectionProducts, managingProductsFor]);

  return (
    <DashboardLayout>
      <PageHero
        eyebrow={activeHero?.kicker || "Story Studio"}
        title={
          activeHero?.headline ||
          "Editorial assets for a luxury fragrance narrative."
        }
        description={
          activeHero?.body ||
          activeHero?.subheadline ||
          "Curate hero scenes, visual cards, and story moments that let the house feel refined across every digital touchpoint."
        }
        actions={
          activeHero ? (
            <>
              {activeHero.primary_cta_label &&
                activeHero.primary_cta_href && (
                  <Button asChild>
                    <a
                      href={activeHero.primary_cta_href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {activeHero.primary_cta_label}
                    </a>
                  </Button>
                )}
              {activeHero.secondary_cta_label &&
                activeHero.secondary_cta_href && (
                  <Button asChild variant="outline">
                    <a
                      href={activeHero.secondary_cta_href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {activeHero.secondary_cta_label}
                    </a>
                  </Button>
                )}
            </>
          ) : (
            <Button
              onClick={() => {
                setEditingHero(null);
                setHeroForm({
                  code: "",
                  kicker: "",
                  headline: "",
                  subheadline: "",
                  body: "",
                  primaryCtaLabel: "",
                  primaryCtaHref: "",
                  backgroundImageUrl: "",
                  galleryImageUrls: [],
                });
                setIsHeroDialogOpen(true);
              }}
            >
              + Add hero slide
            </Button>
          )
        }
        aside={
          <div className="space-y-3">
            <p className="luxury-note">Editorial signal</p>
            <p className="text-lg leading-7 text-foreground">
              Active hero moments and visual tiles are aligned around current launches, limited editions, and seasonal previews.
            </p>
          </div>
        }
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="editorial-panel mb-8">
        <div className="section-header">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h2 className="section-title">Hero moments</h2>
              <p className="section-copy">
                Manage the wording and assets used for the home hero slides.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingHero(null);
              setHeroForm({
                code: "",
                kicker: "",
                headline: "",
                subheadline: "",
                body: "",
                primaryCtaLabel: "",
                primaryCtaHref: "",
                backgroundImageUrl: "",
                galleryImageUrls: [],
              });
              setIsHeroDialogOpen(true);
            }}
          >
            + Add hero slide
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {heroSlides.map((slide, i) => {
            const cardImage = resolveHeroImageUrl(
              slide.background_image_url ||
                (slide.gallery_image_urls &&
                  slide.gallery_image_urls[0]),
            );
            return (
            <motion.div
            key={slide.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/35 transition-colors hover:border-primary/30 cursor-pointer"
              onClick={() => {
                editHero(slide);
                setIsHeroDialogOpen(true);
              }}
            >
              <div className="relative aspect-video overflow-hidden bg-muted">
                {cardImage ? (
                  <>
                    <motion.img
                      src={cardImage}
                      alt={slide.headline}
                      className="h-full w-full object-cover"
                      initial={{ scale: 1 }}
                      animate={{ scale: 1.03 }}
                      transition={{
                        duration: 14,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {slide.headline}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-background/30 to-accent/25">
                    <Image className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                {!slide.is_active && (
                  <div className="absolute right-3 top-3 z-20">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this inactive hero card? This cannot be undone.")) return;
                        heroDeleteMutation.mutate(slide.id);
                      }}
                      disabled={heroDeleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-4">
                {slide.kicker && (
                  <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {slide.kicker}
                  </p>
                )}
                {slide.subheadline && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {slide.subheadline}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={
                      slide.is_active ? statusColors.Active : statusColors.Draft
                    }
                  >
                    {slide.is_active ? "Active" : "Draft"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />{" "}
                    {new Date(slide.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </motion.div>
          )})}
        </div>
      </motion.div>

      {/* Front-facing popup control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="editorial-panel mt-8"
      >
        <div className="section-header">
          <div>
            <h2 className="section-title">Front-facing popup</h2>
            <p className="section-copy">
              Controls the marketing popup shown on the storefront (e.g. welcome
              offer, launch announcement). Managed by the Office app.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr] gap-6">
          {/* Preview */}
          <div className="rounded-[1.5rem] border border-border/60 bg-background/40 p-4">
            <p className="luxury-note mb-2">Preview</p>
            <div className="relative rounded-2xl border border-border/60 bg-background/80 p-4 max-w-md">
              {popupForm.imageUrl && (
                <div className="mb-3 aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted">
                  <img
                    src={popupForm.imageUrl}
                    alt="Popup visual"
                    className="h-full w-full object-cover object-center"
                  />
                </div>
              )}
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Storefront popup
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                {popupForm.headline || "Headline goes here"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {popupForm.body || "Body copy for the popup will appear here."}
              </p>
              {popupForm.ctaLabel && (
                <button className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground">
                  {popupForm.ctaLabel}
                </button>
              )}
            </div>
          </div>

          {/* Form */}
          <form
            className="space-y-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              popupMutation.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Configure the popup copy, image and behaviour.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                  checked={popupForm.isActive}
                  onChange={(e) =>
                    setPopupForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                <span>Active on storefront</span>
              </label>
            </div>

            <div className="space-y-2">
              <Label>Headline</Label>
              <Input
                value={popupForm.headline}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, headline: e.target.value }))
                }
                placeholder="e.g. Welcome to Dumi Essence"
              />
            </div>

            <div className="space-y-2">
              <Label>Body copy</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                value={popupForm.body}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, body: e.target.value }))
                }
                placeholder="Short description, e.g. launch, offer, or message."
              />
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                value={popupForm.imageUrl}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
                placeholder="Full URL to popup image"
              />
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={popupImageUploadMutation.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    popupImageUploadMutation.mutate(file);
                    e.currentTarget.value = "";
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  {popupImageUploadMutation.isPending
                    ? "Uploading image…"
                    : "Upload from your computer to auto-fill the URL."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>CTA label</Label>
                <Input
                  value={popupForm.ctaLabel}
                  onChange={(e) =>
                    setPopupForm((f) => ({ ...f, ctaLabel: e.target.value }))
                  }
                  placeholder="e.g. Shop now"
                />
              </div>
              <div className="space-y-2">
                <Label>CTA link</Label>
                <Input
                  value={popupForm.ctaHref}
                  onChange={(e) =>
                    setPopupForm((f) => ({ ...f, ctaHref: e.target.value }))
                  }
                  placeholder="/shop/mens or https://…"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hide after dismissing (days)</Label>
              <Input
                type="number"
                min={0}
                value={popupForm.dismissDays}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, dismissDays: e.target.value }))
                }
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={popupMutation.isPending}
              >
                {popupMutation.isPending ? "Saving…" : "Save popup"}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
      {/* Home page bestsellers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="editorial-panel mt-8 mb-10"
      >
        <div className="section-header">
          <div className="flex items-center gap-3">
            <Image size={20} className="text-primary" />
            <div>
              <h2 className="section-title">Home bestsellers</h2>
              <p className="section-copy">
                Control which products are featured as bestsellers on the
                storefront home page.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingBestseller(null);
              setBestsellerForm({
                productId: "",
                badgeLabel: "Bestseller",
                sortOrder:
                  homeBestsellers.length > 0
                    ? String(
                        Math.max(
                          ...homeBestsellers.map((b) => b.sort_order ?? 0),
                        ) + 1,
                      )
                    : "0",
                isActive: true,
              });
            }}
          >
            + Add bestseller
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {homeBestsellers.map((b) => {
            const product = products.find((p) => p.id === b.product_id);
            return (
              <div
                key={b.id}
                className="flex flex-col justify-between rounded-[1.5rem] border border-border/60 bg-background/40 p-4"
              >
                <div className="space-y-2">
                  <p className="luxury-note">
                    {b.badge_label || "Bestseller"}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {product?.product_name ?? "Unknown product"}
                  </p>
                  {product?.product_category && (
                    <p className="text-xs text-muted-foreground">
                      {product.product_category}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span
                    className={
                      b.is_active ? statusColors.Active : statusColors.Draft
                    }
                  >
                    {b.is_active ? "Active" : "Hidden"}
                  </span>
                  <span>Order: {b.sort_order}</span>
                  <div className="flex items-center gap-2">
                    {!b.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        disabled={bestsellerDeleteMutation.isPending}
                        onClick={() => {
                          if (!confirm("Delete this inactive bestseller card? This cannot be undone.")) return;
                          bestsellerDeleteMutation.mutate(b.id);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setEditingBestseller(b);
                        setBestsellerForm({
                          productId: b.product_id,
                          badgeLabel: b.badge_label ?? "Bestseller",
                          sortOrder: String(b.sort_order ?? 0),
                          isActive: b.is_active,
                        });
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {homeBestsellers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No home bestsellers configured yet. Add one to feature key
              products on the home page.
            </p>
          )}
        </div>
      </motion.div>

      {/* Product content studio */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="editorial-panel mt-10"
      >
        <div className="section-header">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h2 className="section-title">Fragrance products</h2>
              <p className="section-copy">
                Edit the copy, imagery, notes, and promotion flags for individual
                storefront products. Cards below mirror the feel of the live product page.
              </p>
            </div>
          </div>
        </div>
        {[
          { id: "mens", label: "Mens line", key: "mens" as const },
          { id: "womens", label: "Womens line", key: "womens" as const },
          { id: "unisex", label: "Unisex line", key: "unisex" as const },
          { id: "diffusers", label: "Diffuser line", key: "diffusers" as const },
          {
            id: "carDiffusers",
            label: "Car Diffuser line",
            key: "carDiffusers" as const,
          },
          { id: "other", label: "Other products", key: "other" as const },
        ].map((section) => {
          const products =
            groupedContentProducts[section.key].length > 0 || section.key !== "other"
              ? groupedContentProducts[section.key]
              : [];
          if (products.length === 0) return null;
          return (
            <div key={section.id} className="mt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  {section.label}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {products.length} product{products.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/70">
                {products.map((p, index) => {
                  const lineLabel = p.collection_code
                    ? p.collection_code.toUpperCase()
                    : (p.product_category as string) ?? "";
                  const price =
                    p.base_price != null
                      ? p.base_price
                      : p.price != null
                        ? p.price
                        : null;
                  const imageUrl =
                    p.primary_image_path && supabaseUrl
                      ? `${supabaseUrl}/storage/v1/object/public/product_assets/${p.primary_image_path}`
                      : undefined;
                  const status = p.is_active ? "Active" : "Draft";

                  return (
                    <motion.div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.04 }}
                      className="group flex h-full min-w-[260px] max-w-[260px] flex-col overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/40 text-left transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      onClick={() => {
                        setEditingProduct(p);
                        setProductPreviewImageUrl(
                          p.primary_image_path && (import.meta as any).env?.VITE_SUPABASE_URL
                            ? `${(import.meta as any).env.VITE_SUPABASE_URL}/storage/v1/object/public/product_assets/${p.primary_image_path}`
                            : null,
                        );
                        setProductTab("basic");
                        setProductForm({
                          code: ((p as any).code as string) ?? "",
                          sku: p.sku ?? "",
                          name: p.name ?? p.product_name,
                          collectionCode: p.collection_code ?? "",
                          category:
                            (p.category as string) ??
                            (p.product_category as string) ??
                            "",
                          shortDescription: p.short_description ?? "",
                          longDescription: p.long_description ?? "",
                          reassuranceCopy: (p as any).reassurance_copy ?? "",
                          has30ml: (p as any).price_30ml != null,
                          price30ml:
                            (p as any).price_30ml != null
                              ? String((p as any).price_30ml)
                              : "",
                          has50ml: (p as any).price_50ml != null,
                          price50ml:
                            (p as any).price_50ml != null
                              ? String((p as any).price_50ml)
                              : "",
                          has100ml: (p as any).price_100ml != null,
                          price100ml:
                            (p as any).price_100ml != null
                              ? String((p as any).price_100ml)
                              : "",
                          basePrice: String(p.base_price ?? p.price ?? "" ?? ""),
                          defaultSize: p.default_size ?? "50ml",
                          isBestseller: !!p.is_bestseller,
                          isFeatured: !!p.is_featured,
                          isNew: !!p.is_new,
                          primaryImagePath: p.primary_image_path ?? "",
                        });
                        // Lazy-load imagery and notes when opening; ignore errors silently
                        productContentApi
                          .listImages(p.id)
                          .then((imgs) => setProductImages(imgs))
                          .catch(() => setProductImages([]));
                        productContentApi
                          .listNotes(p.id)
                          .then((notes) => setProductNotes(notes))
                          .catch(() => setProductNotes([]));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          (e.currentTarget as HTMLDivElement).click();
                        }
                      }}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                        {!p.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute right-3 top-3 z-30 h-7 px-2 text-[11px]"
                            disabled={productDeleteMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                !confirm(
                                  "Delete this inactive product card? This cannot be undone.",
                                )
                              )
                                return;
                              productDeleteMutation.mutate(p.id);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                        {imageUrl ? (
                          <>
                            <motion.img
                              src={imageUrl}
                              alt={p.name ?? p.product_name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                              initial={{ scale: 1 }}
                            />
                            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                              {lineLabel && (
                                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                                  {lineLabel}
                                </p>
                              )}
                              <p className="mt-1 text-sm font-medium text-foreground line-clamp-2">
                                {p.name ?? p.product_name}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background/40 to-accent/15">
                            <p className="luxury-note mb-1">FRAGRANCE</p>
                            <p className="text-xs text-muted-foreground">
                              No main image yet
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">
                              {(p as any).code ?? p.id}
                            </span>
                            <span className={statusColors[status]}>
                              {status}
                            </span>
                          </div>
                          {price != null && (
                            <p className="text-sm font-medium text-foreground">
                              R{price.toFixed(2)} · {p.default_size ?? "50ml"}
                            </p>
                          )}
                          {p.short_description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {p.short_description}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px]">
                          <div className="flex flex-wrap gap-1">
                            {p.is_bestseller && (
                              <span className="rounded-full bg-primary/10 px-2 py-[1px] text-primary">
                                Bestseller
                              </span>
                            )}
                            {p.is_featured && (
                              <span className="rounded-full bg-amber-500/10 px-2 py-[1px] text-amber-400">
                                Featured
                              </span>
                            )}
                            {p.is_new && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-[1px] text-emerald-400">
                                New
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            Click to edit
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="editorial-panel mt-12"
      >
        <div className="section-header">
          <div className="flex items-center gap-3">
            <Image size={20} className="text-primary" />
            <div>
              <h2 className="section-title">Editorial cards</h2>
              <p className="section-copy">Supporting visual stories for launches, editions, and seasonal brand beats.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pictureCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.08 }}
              className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => {
                const col = collections.find((c) => c.name === card.type);
                if (col) setManagingProductsFor(col);
              }}
            >
              <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary/15 via-background/30 to-accent/25">
                <Image size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{card.title}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{card.type}</span>
                <span className={statusColors[card.status]}>{card.status}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Collections controlling storefront \"Shop the House\" tiles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="editorial-panel mt-8"
      >
        <div className="section-header">
          <div>
            <h2 className="section-title">Storefront collections</h2>
            <p className="section-copy">
              These collections feed the \"Shop the House\" cards in the customer storefront. Update copy and image paths here and the shop will
              reflect it automatically.
            </p>
          </div>
        </div>
          {collectionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading collections…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {["mens", "womens", "unisex", "diffusers"].map((code) => {
              const c = getCollectionByCode(code);
              const linkedProducts = c
                ? (collectionProducts as any[]).filter(
                    (cp) => cp.collection_id === c.id,
                  )
                : [];
              const previewImage = c?.hero_image_url;
              return (
                <div
                  key={code}
                    className="rounded-[1.5rem] border border-border/60 bg-background/40 p-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative mb-4 overflow-hidden rounded-2xl border border-border/60 bg-muted aspect-[4/3]">
                      {previewImage ? (
                        <>
                          <motion.img
                            src={resolveCollectionImageUrl(previewImage)}
                            alt={c?.name ?? code.toUpperCase()}
                            className="h-full w-full object-cover"
                            initial={{ scale: 1 }}
                            animate={{ scale: 1.03 }}
                            transition={{
                              duration: 14,
                              repeat: Infinity,
                              repeatType: "reverse",
                              ease: "easeInOut",
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                            <p className="luxury-note mb-1">
                              {code.toUpperCase()}
                            </p>
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {c?.name ??
                                (code === "mens"
                                  ? "Men's Line"
                                  : code === "womens"
                                    ? "Women's Line"
                                    : "Unisex Line")}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background/40 to-accent/15">
                          <p className="luxury-note mb-1">{code.toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">
                            No image set yet
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {c?.tagline ??
                        (code === "mens"
                          ? "Structured signatures with warmth, woods, and presence."
                          : code === "womens"
                            ? "Polished florals and luminous amber compositions."
                            : code === "diffusers"
                              ? "Room-fresh sophistication, amplified."
                              : "Modern, versatile luxury for everyday wear.")}
                    </p>
                    {linkedProducts.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Shop cards
                        </p>
                        <div className="mt-1 space-y-1">
                          {linkedProducts.slice(0, 3).map((cp: any) => (
                            <div
                              key={cp.id}
                              className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px]"
                            >
                              <span className="truncate">
                                {(cp.products as Product)?.product_name ??
                                  "Untitled product"}
                              </span>
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                #{cp.position ?? 0}
                              </span>
                            </div>
                          ))}
                          {linkedProducts.length > 3 && (
                            <p className="text-[10px] text-muted-foreground">
                              + {linkedProducts.length - 3} more linked products
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      {c?.hero_image_url ? c.hero_image_url : "No image path set"}
                    </span>
                    <div className="flex items-center gap-2">
                      {code === "mens" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          asChild
                        >
                          <Link to="/shop/mens" target="_blank" rel="noreferrer">
                            <ExternalLink size={12} className="mr-1" />
                            View storefront
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          editCollection(
                          c ?? ({
                            id: "",
                            code,
                            slug: code,
                            name:
                              code === "mens"
                                ? "Men's Line"
                                : code === "womens"
                                  ? "Women's Line"
                                  : "Unisex Line",
                            tagline: undefined,
                            description: undefined,
                            hero_image_url: undefined,
                            created_at: "",
                            updated_at: "",
                          } as Collection),
                        )
                      }
                    >
                      <Edit size={12} className="mr-1" />
                      Edit
                    </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <Dialog open={!!editingCollection} onOpenChange={(open) => !open && setEditingCollection(null)}>
        {editingCollection && (
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Edit collection:{" "}
                {(editingCollection as any).code?.toUpperCase() ??
                  editingCollection.slug}
              </DialogTitle>
              <DialogDescription>
                Updates here will change the wording and image used for the
                matching "Shop the House" card in the storefront.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="mt-2 space-y-4 text-sm"
            >
              <div className="space-y-2">
                <Label>Internal code</Label>
                <Input
                  value={
                    (editingCollection as any).code ?? editingCollection.slug
                  }
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Men's Line"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  value={form.tagline}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tagline: e.target.value }))
                  }
                  placeholder="Short, evocative line under the title."
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Longer description used in some layouts."
                />
              </div>
              <div className="space-y-2">
                <Label>Collection image</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => collectionImageInputRef.current?.click()}
                    disabled={collectionImageUploadMutation.isPending}
                  >
                    {collectionImageUploadMutation.isPending
                      ? "Uploading…"
                      : "Upload image"}
                  </Button>
                  {form.hero_image_url ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {form.hero_image_url}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      No image selected yet
                    </span>
                  )}
                </div>
                <input
                  ref={collectionImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    collectionImageUploadMutation.mutate(file);
                    e.target.value = "";
                  }}
                />
                <Input
                  value={form.hero_image_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hero_image_url: e.target.value }))
                  }
                  placeholder="Optional: override with a full image URL"
                />
                {form.hero_image_url && (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
                    <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Image preview
                    </p>
                    <div className="relative h-36 w-full bg-muted/50 max-h-[180px]">
                      <img
                        src={resolveHeroImageUrl(form.hero_image_url)}
                        alt="Collection card"
                        className="h-full w-full object-cover object-center"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          const next = (e.target as HTMLImageElement).nextElementSibling;
                          if (next) (next as HTMLElement).style.display = "flex";
                        }}
                      />
                      <div
                        className="absolute inset-0 hidden items-center justify-center p-4 text-center text-xs text-muted-foreground"
                        style={{ display: "none" }}
                      >
                        Image could not be loaded. Check path or URL and bucket access.
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCollection(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? "Saving…" : "Save collection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Manage home bestsellers */}
      <Dialog
        open={!!editingBestseller || !!bestsellerForm.productId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingBestseller(null);
            setBestsellerForm({
              productId: "",
              badgeLabel: "Bestseller",
              sortOrder: "0",
              isActive: true,
            });
          }
        }}
      >
        {(editingBestseller || !!bestsellerForm.productId) && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBestseller ? "Edit home bestseller" : "Add home bestseller"}
              </DialogTitle>
              <DialogDescription>
                Choose which product appears in the home page bestseller strip.
              </DialogDescription>
            </DialogHeader>
            <form
              className="mt-2 space-y-4 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                bestsellerMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Product</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  value={bestsellerForm.productId}
                  onChange={(e) =>
                    setBestsellerForm((f) => ({
                      ...f,
                      productId: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Badge label</Label>
                <Input
                  value={bestsellerForm.badgeLabel}
                  onChange={(e) =>
                    setBestsellerForm((f) => ({
                      ...f,
                      badgeLabel: e.target.value,
                    }))
                  }
                  placeholder="e.g. Bestseller, House favourite"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={bestsellerForm.sortOrder}
                  onChange={(e) =>
                    setBestsellerForm((f) => ({
                      ...f,
                      sortOrder: e.target.value,
                    }))
                  }
                  min={0}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="bestseller-active"
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                    checked={bestsellerForm.isActive}
                    onChange={(e) =>
                      setBestsellerForm((f) => ({
                        ...f,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <Label htmlFor="bestseller-active" className="text-xs">
                    Active on home page
                  </Label>
                </div>
                {editingBestseller && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-destructive"
                    onClick={() => {
                      homeBestsellersApi
                        .delete(editingBestseller.id)
                        .then(() => {
                          queryClient.invalidateQueries({
                            queryKey: ["homeBestsellers"],
                          });
                          toast.success("Bestseller removed.");
                          setEditingBestseller(null);
                          setBestsellerForm({
                            productId: "",
                            badgeLabel: "Bestseller",
                            sortOrder: "0",
                            isActive: true,
                          });
                        })
                        .catch((err: any) =>
                          toast.error(
                            err?.message || "Failed to remove bestseller",
                          ),
                        );
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingBestseller(null);
                    setBestsellerForm({
                      productId: "",
                      badgeLabel: "Bestseller",
                      sortOrder: "0",
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={bestsellerMutation.isPending}
                >
                  {bestsellerMutation.isPending ? "Saving…" : "Save bestseller"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Product editor dialog */}
      <Dialog
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
            setProductImages([]);
            setProductNotes([]);
          }
        }}
      >
        {editingProduct && (
          <DialogContent className="w-[min(1100px,95vw)] max-w-none p-0">
            <div className="flex h-[80vh] flex-col">
              <div className="border-b border-border/60 px-6 pt-4 pb-3">
                <DialogHeader>
                  <DialogTitle>Edit product: {productForm.name}</DialogTitle>
                  <DialogDescription>
                    Manage the copy, imagery, notes, and promotion flags for this
                    storefront product.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex flex-1 flex-col gap-6 px-6 pb-6 pt-4 md:flex-row">
                {/* Left: preview */}
                <div className="space-y-3 md:w-7/12">
                  <Label className="text-xs text-muted-foreground">
                    Live preview
                  </Label>
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background/40 to-accent/20 h-full min-h-[260px]">
                    <div className="relative flex h-full">
                      <div className="relative w-2/5 border-r border-border/60 bg-muted">
                        {productPreviewImageUrl || productForm.primaryImagePath ? (
                          <motion.img
                            src={
                              productPreviewImageUrl ||
                              `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product_assets/${productForm.primaryImagePath}`
                            }
                            alt={productForm.name}
                            className="h-full w-full object-cover"
                            initial={{ scale: 1 }}
                            animate={{ scale: 1.03 }}
                            transition={{
                              duration: 14,
                              repeat: Infinity,
                              repeatType: "reverse",
                              ease: "easeInOut",
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background/40 to-accent/15">
                            <p className="luxury-note mb-1">PRODUCT IMAGE</p>
                            <p className="text-xs text-muted-foreground">
                              No main image yet
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            {productForm.collectionCode.toUpperCase() ||
                              "COLLECTION"}
                          </p>
                          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                            {productForm.name || "Product name"}
                          </h2>
                          {productForm.shortDescription && (
                            <p className="text-xs text-muted-foreground md:text-sm">
                              {productForm.shortDescription}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 flex items-end justify-between text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-2">
                            {productForm.isBestseller && (
                              <span className="rounded-full bg-primary/10 px-2 py-[2px] text-primary">
                                Bestseller
                              </span>
                            )}
                            {productForm.isFeatured && (
                              <span className="rounded-full bg-amber-500/10 px-2 py-[2px] text-amber-300">
                                Featured
                              </span>
                            )}
                            {productForm.isNew && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-[2px] text-emerald-300">
                                New
                              </span>
                            )}
                          </div>
                          {productForm.basePrice && (
                            <p className="text-sm font-medium text-foreground">
                              R{Number(productForm.basePrice).toFixed(2)} ·{" "}
                              {productForm.defaultSize || "50ml"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: tabs + form */}
                <div className="mt-2 flex flex-1 flex-col md:mt-0 md:w-5/12">
                  <div className="mb-3 flex gap-2 text-xs">
                    {[
                      { id: "basic", label: "Basic info" },
                      { id: "imagery", label: "Imagery" },
                      { id: "notes", label: "Notes" },
                      { id: "pricing", label: "Pricing" },
                      { id: "promo", label: "Promotion" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setProductTab(tab.id as typeof productTab)
                        }
                        className={`rounded-full px-3 py-1 ${
                          productTab === tab.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-background/60 text-muted-foreground border border-border/60"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <form
                    className="flex-1 space-y-4 overflow-y-auto pr-1 text-sm"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!editingProduct) return;
                      const basePriceNum =
                        Number(productForm.basePrice || "0") || 0;
                      try {
                        await productContentApi.update(editingProduct.id, {
                          code: productForm.code || undefined,
                          sku: productForm.sku || undefined,
                          name: productForm.name,
                          product_name: productForm.name,
                          collection_code:
                            productForm.collectionCode || undefined,
                          category: productForm.category || undefined,
                          short_description:
                            productForm.shortDescription || undefined,
                          long_description:
                            productForm.longDescription || undefined,
                          reassurance_copy:
                            (productForm.reassuranceCopy || undefined) as any,
                          price_30ml:
                            productForm.has30ml && productForm.price30ml
                              ? Number(productForm.price30ml)
                              : undefined,
                          price_50ml:
                            productForm.has50ml && productForm.price50ml
                              ? Number(productForm.price50ml)
                              : undefined,
                          price_100ml:
                            productForm.has100ml && productForm.price100ml
                              ? Number(productForm.price100ml)
                              : undefined,
                          base_price: basePriceNum || undefined,
                          price: basePriceNum || undefined,
                          default_size: productForm.defaultSize || undefined,
                          primary_image_path:
                            productForm.primaryImagePath || undefined,
                          is_bestseller: productForm.isBestseller,
                          is_featured: productForm.isFeatured,
                          is_new: productForm.isNew,
                        } as any);

                        // Keep home bestsellers in sync with the "Mark as bestseller" flag.
                        const existingBestseller = homeBestsellers.find(
                          (b) => b.product_id === editingProduct.id,
                        );

                        if (productForm.isBestseller) {
                          const maxSort =
                            homeBestsellers.length > 0
                              ? Math.max(
                                  ...homeBestsellers.map(
                                    (b) => b.sort_order ?? 0,
                                  ),
                                )
                              : 0;
                          await homeBestsellersApi.upsert({
                            id: existingBestseller?.id,
                            product_id: editingProduct.id,
                            badge_label:
                              existingBestseller?.badge_label || "Bestseller",
                            sort_order: existingBestseller
                              ? existingBestseller.sort_order ?? 0
                              : maxSort + 1,
                            is_active: true,
                          });
                        } else if (existingBestseller) {
                          await homeBestsellersApi.delete(existingBestseller.id);
                        }

                        toast.success("Product content saved.");
                        queryClient.invalidateQueries({
                          queryKey: ["contentProducts"],
                        });
                        queryClient.invalidateQueries({
                          queryKey: ["homeBestsellers"],
                        });
                      } catch (err: any) {
                        toast.error(
                          err?.message || "Failed to save product content",
                        );
                      }
                    }}
                  >
                    {productTab === "basic" && (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Code</Label>
                            <Input
                              value={productForm.code}
                              onChange={(e) =>
                                setProductForm((f) => ({
                                  ...f,
                                  code: e.target.value,
                                }))
                              }
                              placeholder="e.g. umoya-bergamot"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>SKU</Label>
                            <Input
                              value={productForm.sku}
                              onChange={(e) =>
                                setProductForm((f) => ({
                                  ...f,
                                  sku: e.target.value,
                                }))
                              }
                              placeholder="e.g. UMOYA-50ML"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={productForm.name}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Display name used in storefront"
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Collection code</Label>
                            <Input
                              value={productForm.collectionCode}
                              onChange={(e) =>
                                setProductForm((f) => ({
                                  ...f,
                                  collectionCode: e.target.value,
                                }))
                              }
                              placeholder="e.g. mens"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Input
                              value={productForm.category}
                              onChange={(e) =>
                                setProductForm((f) => ({
                                  ...f,
                                  category: e.target.value,
                                }))
                              }
                              placeholder="men / women / unisex / diffuser / car-perfumes"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Short description</Label>
                          <Input
                            value={productForm.shortDescription}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                shortDescription: e.target.value,
                              }))
                            }
                            placeholder="Short copy shown on product card"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Long description</Label>
                          <textarea
                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                            value={productForm.longDescription}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                longDescription: e.target.value,
                              }))
                            }
                            placeholder="Detail copy shown on product page"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Luxury reassurance copy</Label>
                          <textarea
                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                            value={productForm.reassuranceCopy}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                reassuranceCopy: e.target.value,
                              }))
                            }
                            placeholder="Block of reassuring copy shown in a card on the product page"
                          />
                        </div>
                      </>
                    )}

                    {productTab === "pricing" && (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Base price (ZAR)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={productForm.basePrice}
                              onChange={(e) =>
                                setProductForm((f) => ({
                                  ...f,
                                  basePrice: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Default size</Label>
                            <Input
                              value={productForm.defaultSize}
                              onChange={(e) =>
                                setProductForm((f) => ({
                                  ...f,
                                  defaultSize: e.target.value,
                                }))
                              }
                              placeholder="e.g. 50ml"
                            />
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <Label>Available sizes & prices</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Tick the sizes you sell and enter the price for each. These show as size cards on the product page.
                          </p>
                          <div className="space-y-2 text-[11px]">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={productForm.has30ml}
                                  onChange={(e) =>
                                    setProductForm((f) => ({
                                      ...f,
                                      has30ml: e.target.checked,
                                    }))
                                  }
                                  className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                                />
                                <span>30ml</span>
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 w-32 text-xs"
                                placeholder="Price"
                                value={productForm.price30ml}
                                onChange={(e) =>
                                  setProductForm((f) => ({
                                    ...f,
                                    price30ml: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={productForm.has50ml}
                                  onChange={(e) =>
                                    setProductForm((f) => ({
                                      ...f,
                                      has50ml: e.target.checked,
                                    }))
                                  }
                                  className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                                />
                                <span>50ml</span>
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 w-32 text-xs"
                                placeholder="Price"
                                value={productForm.price50ml}
                                onChange={(e) =>
                                  setProductForm((f) => ({
                                    ...f,
                                    price50ml: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={productForm.has100ml}
                                  onChange={(e) =>
                                    setProductForm((f) => ({
                                      ...f,
                                      has100ml: e.target.checked,
                                    }))
                                  }
                                  className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                                />
                                <span>100ml</span>
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 w-32 text-xs"
                                placeholder="Price"
                                value={productForm.price100ml}
                                onChange={(e) =>
                                  setProductForm((f) => ({
                                    ...f,
                                    price100ml: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {productTab === "imagery" && (
                      <>
                        <div className="space-y-2">
                          <Label>Main bottle image</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => productImageInputRef.current?.click()}
                              disabled={productImageUploadMutation.isPending}
                            >
                              {productImageUploadMutation.isPending
                                ? "Uploading…"
                                : "Upload image"}
                            </Button>
                            {productForm.primaryImagePath ? (
                              <span className="truncate text-[11px] text-muted-foreground">
                                {productForm.primaryImagePath}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                No image selected yet
                              </span>
                            )}
                          </div>
                          <input
                            ref={productImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setProductPreviewImageUrl(URL.createObjectURL(file));
                              productImageUploadMutation.mutate(file);
                              e.target.value = "";
                            }}
                          />
                          <Input
                            value={productForm.primaryImagePath}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                primaryImagePath: e.target.value,
                              }))
                            }
                            placeholder="Filename in product_assets bucket"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Gallery images</Label>
                          <p className="text-[11px] text-muted-foreground">
                            (Optional) Alternate or detail images used on the
                            product page.
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => galleryImageInputRef.current?.click()}
                              disabled={galleryImageUploadMutation.isPending}
                            >
                              {galleryImageUploadMutation.isPending
                                ? "Uploading…"
                                : "Add image"}
                            </Button>
                          </div>
                          <input
                            ref={galleryImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              if (!files.length) return;
                              // Upload first selected image as gallery image
                              galleryImageUploadMutation.mutate(files[0]);
                              e.target.value = "";
                            }}
                          />
                          <div className="mt-1 flex flex-wrap gap-2">
                            {productImages.map((img) => (
                              <div
                                key={img.id}
                                className="relative h-16 w-20 overflow-hidden rounded-md border border-border/60 bg-muted"
                              >
                                <img
                                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product_assets/${img.path}`}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  className="absolute right-0 top-0 rounded-bl-md bg-black/70 px-1 text-[10px] text-white"
                                  onClick={() => {
                                    productContentApi
                                      .deleteImage(img.id)
                                      .then(() => {
                                        setProductImages((arr) =>
                                          arr.filter((p) => p.id !== img.id),
                                        );
                                        toast.success("Gallery image removed.");
                                      })
                                      .catch((err: any) =>
                                        toast.error(
                                          err?.message ||
                                            "Failed to remove image",
                                        ),
                                      );
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            {productImages.length === 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                No gallery images yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {productTab === "notes" && (
                      <div className="grid gap-4 md:grid-cols-3">
                        {(["top", "middle", "base"] as const).map((level) => {
                          const label =
                            level === "top"
                              ? "Top notes"
                              : level === "middle"
                                ? "Heart notes"
                                : "Base notes";
                          const notes = productNotes.filter(
                            (n) => n.level === level,
                          );
                          return (
                            <div key={level} className="space-y-2">
                              <Label>{label}</Label>
                              <div className="space-y-2">
                                {notes.map((n) => (
                                  <div
                                    key={n.id}
                                    className="flex items-center gap-2"
                                  >
                                    <Input
                                      className="h-7 text-xs"
                                      value={n.note}
                                      onChange={(e) =>
                                        setProductNotes((arr) =>
                                          arr.map((p) =>
                                            p.id === n.id
                                              ? {
                                                  ...p,
                                                  note: e.target.value,
                                                }
                                              : p,
                                          ),
                                        )
                                      }
                                      onBlur={(e) => {
                                        productContentApi
                                          .upsertNote({
                                            id: n.id,
                                            product_id: n.product_id,
                                            level: n.level,
                                            note: e.target.value,
                                            position: n.position,
                                          })
                                          .catch((err: any) =>
                                            toast.error(
                                              err?.message ||
                                                "Failed to save note",
                                            ),
                                          );
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-destructive"
                                      onClick={() => {
                                        productContentApi
                                          .deleteNote(n.id)
                                          .then(() => {
                                            setProductNotes((arr) =>
                                              arr.filter((p) => p.id !== n.id),
                                            );
                                          })
                                          .catch((err: any) =>
                                            toast.error(
                                              err?.message ||
                                                "Failed to remove note",
                                            ),
                                          );
                                      }}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => {
                                    const position =
                                      notes.length > 0
                                        ? Math.max(
                                            ...notes.map((n) => n.position),
                                          ) + 1
                                        : 0;
                                    productContentApi
                                      .upsertNote({
                                        product_id: editingProduct.id,
                                        level,
                                        note: "",
                                        position,
                                      })
                                      .then((created) => {
                                        setProductNotes((arr) => [
                                          ...arr,
                                          created,
                                        ]);
                                      })
                                      .catch((err: any) =>
                                        toast.error(
                                          err?.message ||
                                            "Failed to add note",
                                        ),
                                      );
                                  }}
                                >
                                  + Add note
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {productTab === "promo" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <input
                            id="flag-bestseller"
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                            checked={productForm.isBestseller}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                isBestseller: e.target.checked,
                              }))
                            }
                          />
                          <Label htmlFor="flag-bestseller" className="text-xs">
                            Mark as bestseller
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="flag-featured"
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                            checked={productForm.isFeatured}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                isFeatured: e.target.checked,
                              }))
                            }
                          />
                          <Label htmlFor="flag-featured" className="text-xs">
                            Show in featured sections
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="flag-new"
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-border bg-background accent-current"
                            checked={productForm.isNew}
                            onChange={(e) =>
                              setProductForm((f) => ({
                                ...f,
                                isNew: e.target.checked,
                              }))
                            }
                          />
                          <Label htmlFor="flag-new" className="text-xs">
                            Mark as new release
                          </Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          These flags power badges and inclusion in hero /
                          bestseller sections in the storefront.
                        </p>
                      </div>
                    )}

                    <DialogFooter className="mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingProduct(null)}
                      >
                        Close
                      </Button>
                      <Button type="submit">Save product</Button>
                    </DialogFooter>
                  </form>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog
        open={isHeroDialogOpen}
        onOpenChange={(open) => {
          setIsHeroDialogOpen(open);
          if (!open) {
            setEditingHero(null);
            setHeroForm({
              code: "",
              kicker: "",
              headline: "",
              subheadline: "",
              body: "",
              primaryCtaLabel: "",
              primaryCtaHref: "",
              backgroundImageUrl: "",
              galleryImageUrls: [],
            });
          }
        }}
      >
        {isHeroDialogOpen && (
          <DialogContent className="w-[min(1100px,95vw)] max-w-none p-0">
            <div className="flex h-[80vh] flex-col">
              <div className="border-b border-border/60 px-6 pt-4 pb-3">
                <DialogHeader>
                  <DialogTitle>
                    {editingHero ? "Edit hero slide" : "Add hero slide"}
                  </DialogTitle>
                  <DialogDescription>
                    Control the wording, PDF link, and background assets used
                    for the home hero.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex flex-1 flex-col gap-6 px-6 pb-6 pt-4 md:flex-row">
                <div className="space-y-3 md:w-7/12">
                  <Label className="text-xs text-muted-foreground">
                    Live preview
                  </Label>
                  <div className="h-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background/40 to-accent/20">
                    <div className="relative h-full min-h-[220px]">
                      <motion.div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${resolveHeroImageUrl(
                            heroForm.backgroundImageUrl ||
                              (heroForm.galleryImageUrls?.[0] ??
                                editingHero?.background_image_url ??
                                ""),
                          )})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        initial={{ scale: 1 }}
                        animate={{ scale: 1.05 }}
                        transition={{
                          duration: 16,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                        }}
                      />
                      <div className="relative z-10 flex h-full flex-col justify-between bg-gradient-to-t from-black/65 via-black/20 to-black/10 p-6">
                        <div className="max-w-lg space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            {heroForm.kicker ||
                              activeHero?.kicker ||
                              "STORY STUDIO"}
                          </p>
                          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                            {heroForm.headline ||
                              activeHero?.headline ||
                              "Perfume with presence, depth, and soul."}
                          </h2>
                          {(heroForm.subheadline ||
                            heroForm.body ||
                            activeHero?.subheadline) && (
                            <p className="text-xs text-muted-foreground md:text-sm">
                              {heroForm.body ||
                                heroForm.subheadline ||
                                activeHero?.subheadline}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {heroForm.primaryCtaLabel && (
                            <Button size="sm">
                              {heroForm.primaryCtaLabel}
                            </Button>
                          )}
                          {heroForm.secondaryCtaLabel && (
                            <Button size="sm" variant="outline">
                              {heroForm.secondaryCtaLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <form
                  className="mt-2 space-y-4 overflow-y-auto pr-1 text-sm md:mt-0 md:w-5/12"
                  onSubmit={(e) => {
                    e.preventDefault();
                    heroUpsertMutation.mutate();
                  }}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Internal code</Label>
                      <Input
                        value={heroForm.code}
                        onChange={(e) =>
                          setHeroForm((f) => ({ ...f, code: e.target.value }))
                        }
                        placeholder="e.g. home-main"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kicker</Label>
                      <Input
                        value={heroForm.kicker}
                        onChange={(e) =>
                          setHeroForm((f) => ({ ...f, kicker: e.target.value }))
                        }
                        placeholder="Small label above the title"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Headline</Label>
                    <Input
                      value={heroForm.headline}
                      onChange={(e) =>
                        setHeroForm((f) => ({
                          ...f,
                          headline: e.target.value,
                        }))
                      }
                      placeholder="Main hero line"
                      required
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Subheadline</Label>
                      <Input
                        value={heroForm.subheadline}
                        onChange={(e) =>
                          setHeroForm((f) => ({
                            ...f,
                            subheadline: e.target.value,
                          }))
                        }
                        placeholder="Optional supporting line"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Body copy</Label>
                      <Input
                        value={heroForm.body}
                        onChange={(e) =>
                          setHeroForm((f) => ({ ...f, body: e.target.value }))
                        }
                        placeholder="Optional paragraph used in some layouts"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Primary CTA label</Label>
                      <Input
                        value={heroForm.primaryCtaLabel}
                        onChange={(e) =>
                          setHeroForm((f) => ({
                            ...f,
                            primaryCtaLabel: e.target.value,
                          }))
                        }
                        placeholder="e.g. Download scent menu (PDF)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary CTA link (PDF URL)</Label>
                      <Input
                        value={heroForm.primaryCtaHref}
                        onChange={(e) =>
                          setHeroForm((f) => ({
                            ...f,
                            primaryCtaHref: e.target.value,
                          }))
                        }
                        placeholder="Paste or upload a PDF"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Primary CTA upload</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={pdfUploadMutation.isPending}
                      >
                        {pdfUploadMutation.isPending
                          ? "Uploading…"
                          : "Upload PDF"}
                      </Button>
                      {heroForm.primaryCtaHref && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {heroForm.primaryCtaHref}
                        </span>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        pdfUploadMutation.mutate(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Background image</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={imageUploadMutation.isPending}
                      >
                        {imageUploadMutation.isPending
                          ? "Uploading…"
                          : "Upload image"}
                      </Button>
                      {heroForm.backgroundImageUrl ? (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {heroForm.backgroundImageUrl}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          No image selected yet
                        </span>
                      )}
                    </div>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        // First image becomes main background, rest go to gallery
                        imageUploadMutation.mutate(files[0]);
                        if (files.length > 1) {
                          galleryUploadMutation.mutate(files.slice(1));
                        }
                        e.target.value = "";
                      }}
                    />
                    <Input
                      value={heroForm.backgroundImageUrl}
                      onChange={(e) =>
                        setHeroForm((f) => ({
                          ...f,
                          backgroundImageUrl: e.target.value,
                        }))
                      }
                      placeholder="Optional: override with a full image URL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gallery images</Label>
                    {heroForm.galleryImageUrls &&
                    heroForm.galleryImageUrls.length ? (
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {heroForm.galleryImageUrls.map((img, idx) => (
                          <div
                            key={`${img}-${idx}`}
                            className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted"
                          >
                            <img
                              src={resolveHeroImageUrl(img)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 rounded-bl-md bg-black/70 px-1 text-[10px] text-white"
                              onClick={() =>
                                setHeroForm((f) => ({
                                  ...f,
                                  galleryImageUrls: f.galleryImageUrls.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }))
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        No gallery images yet. Add more by uploading multiple
                        files above.
                      </p>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingHero(null);
                        setIsHeroDialogOpen(false);
                        setHeroForm({
                          code: "",
                          kicker: "",
                          headline: "",
                          subheadline: "",
                          body: "",
                          primaryCtaLabel: "",
                          primaryCtaHref: "",
                          backgroundImageUrl: "",
                          galleryImageUrls: [],
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={heroUpsertMutation.isPending}
                    >
                      {heroUpsertMutation.isPending
                        ? "Saving…"
                        : "Save hero slide"}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={!!managingProductsFor} onOpenChange={(open) => !open && setManagingProductsFor(null)}>
        {managingProductsFor && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage products for {managingProductsFor.name}</DialogTitle>
              <DialogDescription>
                Choose which products appear under this collection in the storefront.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-2">Linked products</p>
                {productsForManaging.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No products linked yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {productsForManaging.map((cp: any) => (
                      <li
                        key={cp.id}
                        className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5"
                      >
                        <span className="truncate">
                          {(cp.products as Product)?.product_name ?? "Untitled product"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-destructive"
                          onClick={() => {
                            collectionsApi
                              .removeCollectionProduct(cp.id)
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["collectionProducts"] });
                                toast.success("Product removed from collection.");
                              })
                              .catch((err: any) =>
                                toast.error(err?.message || "Failed to remove product"),
                              );
                          }}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedProductId) {
                    toast.error("Select a product to add.");
                    return;
                  }
                  collectionsApi
                    .addProductToCollection({
                      collection_id: managingProductsFor.id,
                      product_id: selectedProductId,
                    })
                    .then(() => {
                      queryClient.invalidateQueries({ queryKey: ["collectionProducts"] });
                      setSelectedProductId("");
                      toast.success("Product added to collection.");
                    })
                    .catch((err: any) =>
                      toast.error(err?.message || "Failed to add product to collection"),
                    );
                }}
              >
                <Label className="text-xs">Add product</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
                <DialogFooter className="mt-2">
                  <Button type="submit" size="sm" className="text-xs">
                    Add product
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </DashboardLayout>
  );
};

export default Content;
