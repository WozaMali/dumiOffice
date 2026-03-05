import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Package, AlertTriangle, Search, ArrowUpDown, Edit, Download, CheckCircle2, XCircle, RefreshCw, Target } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/lib/api/products";
import { inventoryApi } from "@/lib/api/inventory";
import type { Product, ProductCategory } from "@/types/database";
import { toast } from "sonner";
import { downloadCSV, generateProductsCSV } from "@/lib/utils/bulk-actions";

const Inventory = () => {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, error, refetch } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const [search, setSearch] = useState("");
  const STORAGE_KEY_DRAFT = "dumi-inventory-adjustment-draft";
  const [adjustmentPanelOpen, setAdjustmentPanelOpen] = useState(false);
  const [adjustmentTab, setAdjustmentTab] = useState<"Details" | "Items" | "Location" | "Valuation" | "Notes">("Details");
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustmentType: "",
    date: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    reason: "",
    productId: "",
    quantity: "1",
    direction: "increase" as "increase" | "decrease",
    location: "",
    notes: "",
  });
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [categoryFilter, setCategoryFilter] = useState<"all" | ProductCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "inStock" | "lowStock" | "inactive">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    product_name: "",
    product_category: "Perfume" as ProductCategory,
    product_type: "",
    sku: "",
    stock_on_hand: "0",
    stock_threshold: "5",
    description: "",
  });

  const createProductMutation = useMutation({
    mutationFn: (product: Partial<Product>) => productsApi.create(product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product added successfully");
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add product");
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) => productsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
      setEditingProduct(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update product");
    },
  });

  const totalProducts = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.stock_on_hand, 0);
  const lowStockCount = items.filter((item) => item.stock_on_hand <= item.stock_threshold).length;
  const outOfStockCount = items.filter((item) => item.stock_on_hand === 0).length;

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      // Category filter
      if (categoryFilter !== "all" && item.product_category !== categoryFilter) {
        return false;
      }

      // Status filter
      const isLow = item.stock_on_hand <= item.stock_threshold;
      if (statusFilter === "inStock" && (isLow || !item.is_active)) {
        return false;
      }
      if (statusFilter === "lowStock" && !isLow) {
        return false;
      }
      if (statusFilter === "inactive" && item.is_active) {
        return false;
      }

      // Search filter
      if (!term) return true;
      return [item.product_name, item.sku, item.product_category].some((field) =>
        field.toLowerCase().includes(term),
      );
    });
  }, [items, search, categoryFilter, statusFilter]);

  const paginatedItems = useMemo(() => {
    const start = page * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      product_name: "",
      product_category: "Perfume",
      product_type: "",
      sku: "",
      stock_on_hand: "0",
      stock_threshold: "5",
      description: "",
    });
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      product_name: product.product_name,
      product_category: product.product_category,
      product_type: product.product_type || "",
      sku: product.sku,
      stock_on_hand: product.stock_on_hand.toString(),
      stock_threshold: product.stock_threshold.toString(),
      description: product.description || "",
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  const totalUnitsFiltered = useMemo(
    () => filteredItems.reduce((sum, p) => sum + p.stock_on_hand, 0),
    [filteredItems],
  );

  const toggleSelectAll = () => {
    const onPage = paginatedItems.map((p) => p.id);
    const allOnPageSelected = onPage.length > 0 && onPage.every((id) => selectedIds.includes(id));
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !onPage.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...onPage])]);
    }
  };

  const handleBulkAction = async (action: "activate" | "deactivate" | "export") => {
    if (selectedIds.length === 0) {
      toast.error("No products selected");
      return;
    }

    if (action === "export") {
      const selectedProducts = items.filter((p) => selectedIds.includes(p.id));
      const csv = generateProductsCSV(selectedProducts);
      const filename = `dumi-essence-products-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCSV(csv, filename);
      toast.success(`Exported ${selectedIds.length} products to CSV`);
      return;
    }

    const makeActive = action === "activate";
    try {
      await Promise.all(
        selectedIds.map((id) =>
          productsApi.update(id, { is_active: makeActive }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedIds([]);
      toast.success(
        `${selectedIds.length} products marked as ${makeActive ? "active" : "inactive"}`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update products");
    }
  };

  const handleAddProduct = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.product_name.trim() || !form.sku.trim()) return;

    const stock = Number(form.stock_on_hand) || 0;
    const threshold = Number(form.stock_threshold) || 0;

    const newItem: Partial<Product> = {
      product_name: form.product_name.trim(),
      product_category: form.product_category,
      product_type: form.product_type.trim() || undefined,
      sku: form.sku.trim(),
      price: 0,
      stock_on_hand: stock,
      stock_threshold: threshold,
      description: form.description.trim() || undefined,
      is_active: true,
    };

    createProductMutation.mutate(newItem);
  };

  const handleUpdateProduct = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProduct || !form.product_name.trim() || !form.sku.trim()) return;

    const stock = Number(form.stock_on_hand) || 0;
    const threshold = Number(form.stock_threshold) || 0;

    const updates: Partial<Product> = {
      product_name: form.product_name.trim(),
      product_category: form.product_category,
      product_type: form.product_type.trim() || undefined,
      sku: form.sku.trim(),
      stock_on_hand: stock,
      stock_threshold: threshold,
      description: form.description.trim() || undefined,
    };

    updateProductMutation.mutate({ id: editingProduct.id, updates });
  };

  const handleAdjustStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustingProduct) return;

    const formData = new FormData(event.currentTarget);
    const direction = formData.get("direction") as "increase" | "decrease";
    const qty = Number(formData.get("quantity") || "0");
    const reason = (formData.get("reason") as string) || "correction";
    const note = (formData.get("note") as string) || undefined;

    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }

    const delta = direction === "increase" ? qty : -qty;

    try {
      await inventoryApi.adjustStock({
        productId: adjustingProduct.id,
        delta,
        source: "manual_adjustment",
        reason,
        reference: note,
        createdBy: "Admin",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock adjusted");
      setAdjustingProduct(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust stock");
    }
  };

  const handleAdjustmentPanelApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentForm.productId || !adjustmentForm.adjustmentType) {
      toast.error("Select adjustment type and a product");
      return;
    }
    const qty = Number(adjustmentForm.quantity) || 0;
    if (qty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    const delta = adjustmentForm.direction === "increase" ? qty : -qty;
    try {
      await inventoryApi.adjustStock({
        productId: adjustmentForm.productId,
        delta,
        source: "manual_adjustment",
        reason: adjustmentForm.reason || adjustmentForm.adjustmentType,
        reference: adjustmentForm.referenceNumber || undefined,
        createdBy: "Admin",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock adjustment applied");
      setAdjustmentPanelOpen(false);
      setAdjustmentForm({
        adjustmentType: "",
        date: new Date().toISOString().slice(0, 10),
        referenceNumber: "",
        reason: "",
        productId: "",
        quantity: "1",
        direction: "increase",
        location: "",
        notes: "",
      });
      clearAdjustmentDraft();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust stock");
    }
  };

  const loadAdjustmentDraft = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_DRAFT);
      if (raw) {
        const draft = JSON.parse(raw) as typeof adjustmentForm;
        setAdjustmentForm((prev) => ({ ...prev, ...draft }));
      }
    } catch (_) {}
  };

  const handleSaveDraft = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(adjustmentForm));
      toast.success("Draft saved. You can continue later.");
    } catch (_) {
      toast.error("Could not save draft");
    }
  };

  const clearAdjustmentDraft = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY_DRAFT);
    } catch (_) {}
  };

  useEffect(() => {
    if (adjustmentPanelOpen) loadAdjustmentDraft();
  }, [adjustmentPanelOpen]);

  return (
    <DashboardLayout>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-semibold text-foreground"
            >
              Inventory Management
            </motion.h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage stock levels for perfumes, diffusers and car perfumes.
            </p>
          </div>
          <DialogTrigger asChild>
            <Button className="px-4 py-2">+ Add product</Button>
          </DialogTrigger>
        </div>

        {/* Overview metrics */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs flex-1 min-w-0">
            <div className="glass-card px-4 py-3 flex flex-col gap-1">
              <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Total products</span>
              <span className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                {totalProducts}
              </span>
              <span className="text-muted-foreground text-[11px]">Active SKUs</span>
            </div>
            <div className="glass-card px-4 py-3 flex flex-col gap-1">
              <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Total units</span>
              <span className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {totalUnits}
              </span>
              <span className="text-muted-foreground text-[11px]">In inventory</span>
            </div>
            <div className="glass-card px-4 py-3 flex flex-col gap-1">
              <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Low stock alerts</span>
              <span className="text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                {lowStockCount}
              </span>
              <span className="text-muted-foreground text-[11px]">Items below threshold</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setAdjustmentPanelOpen((o) => !o)} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              + Adjust stock
            </Button>
          </div>
        </div>

        {/* Stock Adjustment section */}
        {adjustmentPanelOpen && (
          <div className="glass-card rounded-lg border border-border p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Stock Adjustment</h2>
                <p className="text-sm text-muted-foreground">Adjust inventory levels for materials.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAdjustmentPanelOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10" onClick={handleSaveDraft}>
                  Save Draft
                </Button>
                <Button type="submit" form="stock-adjustment-form" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Save & Apply
                </Button>
              </div>
            </div>
            <div className="flex gap-1 border-b border-border mb-4">
              {(["Details", "Items", "Location", "Valuation", "Notes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                    adjustmentTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setAdjustmentTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <form id="stock-adjustment-form" onSubmit={handleAdjustmentPanelApply} className="space-y-4">
              {adjustmentTab === "Details" && (
                <>
                  <h3 className="text-sm font-medium text-foreground">Adjustment Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Adjustment type *</Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={adjustmentForm.adjustmentType}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, adjustmentType: e.target.value }))}
                      >
                        <option value="">Select type</option>
                        <option value="count">Stock count</option>
                        <option value="receipt">Receipt</option>
                        <option value="damage">Damage</option>
                        <option value="return">Return</option>
                        <option value="transfer">Transfer</option>
                        <option value="sample">Tester / sample</option>
                        <option value="correction">Correction</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={adjustmentForm.date}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reference number</Label>
                      <Input
                        placeholder="REF-2024-001"
                        value={adjustmentForm.referenceNumber}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Input
                        placeholder="Enter reason"
                        value={adjustmentForm.reason}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, reason: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}
              {adjustmentTab === "Items" && (
                <>
                  <h3 className="text-sm font-medium text-foreground">Adjustment items</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Product *</Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={adjustmentForm.productId}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, productId: e.target.value }))}
                      >
                        <option value="">Select product</option>
                        {items.map((p) => (
                          <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={adjustmentForm.quantity}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Direction</Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={adjustmentForm.direction}
                        onChange={(e) => setAdjustmentForm((f) => ({ ...f, direction: e.target.value as "increase" | "decrease" }))}
                      >
                        <option value="increase">Increase stock</option>
                        <option value="decrease">Decrease stock</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {adjustmentTab === "Location" && (
                <>
                  <h3 className="text-sm font-medium text-foreground">Location</h3>
                  <div className="space-y-2">
                    <Label>Warehouse / location</Label>
                    <Input
                      placeholder="e.g. Main store, Warehouse A"
                      value={adjustmentForm.location}
                      onChange={(e) => setAdjustmentForm((f) => ({ ...f, location: e.target.value }))}
                    />
                  </div>
                </>
              )}
              {adjustmentTab === "Valuation" && (
                <div className="py-4 text-sm text-muted-foreground">
                  Valuation is not used for inventory adjustments. Stock levels only.
                </div>
              )}
              {adjustmentTab === "Notes" && (
                <>
                  <h3 className="text-sm font-medium text-foreground">Notes</h3>
                  <div className="space-y-2">
                    <Label>Additional notes</Label>
                    <textarea
                      className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Enter any additional notes..."
                      value={adjustmentForm.notes}
                      onChange={(e) => setAdjustmentForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </form>
          </div>
        )}

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>Capture a new product with category, SKU and initial stock.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">Product name *</Label>
                <Input id="product_name" value={form.product_name} onChange={(e) => handleChange("product_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_category">Category</Label>
                <select
                  id="product_category"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.product_category}
                  onChange={(e) => handleChange("product_category", e.target.value as ProductCategory)}
                >
                  <option value="Perfume">Perfume</option>
                  <option value="Diffuser">Diffuser</option>
                  <option value="Car Perfume">Car Perfume</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" value={form.sku} onChange={(e) => handleChange("sku", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_type">Type / variant</Label>
                <Input id="product_type" placeholder="e.g. EDP 50ml" value={form.product_type} onChange={(e) => handleChange("product_type", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock_on_hand">Initial stock on hand</Label>
                <Input
                  id="stock_on_hand"
                  type="number"
                  min={0}
                  value={form.stock_on_hand}
                  onChange={(e) => handleChange("stock_on_hand", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_threshold">Low stock threshold</Label>
                <Input
                  id="stock_threshold"
                  type="number"
                  min={0}
                  value={form.stock_threshold}
                  onChange={(e) => handleChange("stock_threshold", e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" size="sm" disabled={createProductMutation.isPending}>
                {createProductMutation.isPending ? "Saving…" : "Save product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit product dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>Update product details and stock thresholds.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_product_name">Product name *</Label>
                <Input id="edit_product_name" value={form.product_name} onChange={(e) => handleChange("product_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_product_category">Category</Label>
                <select
                  id="edit_product_category"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.product_category}
                  onChange={(e) => handleChange("product_category", e.target.value as ProductCategory)}
                >
                  <option value="Perfume">Perfume</option>
                  <option value="Diffuser">Diffuser</option>
                  <option value="Car Perfume">Car Perfume</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_sku">SKU *</Label>
                <Input id="edit_sku" value={form.sku} onChange={(e) => handleChange("sku", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_product_type">Type / variant</Label>
                <Input id="edit_product_type" value={form.product_type} onChange={(e) => handleChange("product_type", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_stock_on_hand">Stock on hand</Label>
                <Input
                  id="edit_stock_on_hand"
                  type="number"
                  min={0}
                  value={form.stock_on_hand}
                  onChange={(e) => handleChange("stock_on_hand", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_stock_threshold">Low stock threshold</Label>
                <Input
                  id="edit_stock_threshold"
                  type="number"
                  min={0}
                  value={form.stock_threshold}
                  onChange={(e) => handleChange("stock_threshold", e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" size="sm" disabled={updateProductMutation.isPending}>
                {updateProductMutation.isPending ? "Saving…" : "Update product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustingProduct} onOpenChange={(open) => !open && setAdjustingProduct(null)}>
        {adjustingProduct && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust stock - {adjustingProduct.product_name}</DialogTitle>
              <DialogDescription>
                Apply a manual stock adjustment and record the reason for audit purposes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdjustStock} className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current stock</Label>
                  <p className="text-foreground">
                    {adjustingProduct.stock_on_hand} units
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direction">Direction</Label>
                  <select
                    id="direction"
                    name="direction"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="increase"
                  >
                    <option value="increase">Increase stock</option>
                    <option value="decrease">Decrease stock</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <select
                    id="reason"
                    name="reason"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="correction"
                  >
                    <option value="count">Stock count</option>
                    <option value="damage">Damage</option>
                    <option value="theft">Theft / loss</option>
                    <option value="sample">Tester / sample</option>
                    <option value="correction">Correction</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Reference / note</Label>
                <Input
                  id="note"
                  name="note"
                  placeholder="Optional reference, e.g. count sheet, incident ID..."
                />
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustingProduct(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">Apply adjustment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card px-4 py-3 mb-4 flex items-center justify-between"
        >
          <span className="text-xs text-foreground">
            {selectedIds.length} products selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("activate")}
            >
              <CheckCircle2 size={14} /> Mark active
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("deactivate")}
            >
              <XCircle size={14} /> Mark inactive
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("export")}
            >
              <Download size={14} /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Current Inventory */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Current Inventory</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csv = generateProductsCSV(filteredItems);
              downloadCSV(csv, "inventory.csv");
              toast.success("Export started");
            }}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="glass-card p-4 mb-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, SKU or category..."
            className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as "all" | ProductCategory)
            }
          >
            <option value="all">All categories</option>
            <option value="Perfume">Perfume</option>
            <option value="Diffuser">Diffuser</option>
            <option value="Car Perfume">Car Perfume</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "inStock" | "lowStock" | "inactive",
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="inStock">In stock</option>
            <option value="lowStock">Low stock</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card overflow-hidden">
        {isLoading && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading inventory…</div>}
        {error && <div className="px-4 py-6 text-center text-sm text-rose-400">Failed to load inventory. Check your Supabase connection.</div>}
        {!isLoading && !error && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={
                      paginatedItems.length > 0 &&
                      paginatedItems.every((p) => selectedIds.includes(p.id))
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                {["Product", "SKU", "Category", "Type", "Stock", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4"
                    >
                      <span className="flex items-center gap-1">
                        {h} <ArrowUpDown size={12} />
                      </span>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-muted-foreground" />
                      <p className="text-sm text-foreground">No products found</p>
                      <p className="text-xs text-muted-foreground">
                        {items.length === 0 ? "Add your first product to get started" : "Try adjusting your search"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, i) => {
                  const isLow = item.stock_on_hand <= item.stock_threshold;
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 * i }}
                      className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{item.sku}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{item.product_category}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.product_type || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${isLow ? "text-destructive" : "text-foreground"}`}>{item.stock_on_hand}</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isLow ? "bg-destructive" : "bg-success"}`}
                              style={{ width: `${Math.min((item.stock_on_hand / (item.stock_threshold * 3 || 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isLow ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"}`}>
                          {isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-emerald-300 hover:text-emerald-200 transition-colors text-xs underline flex items-center gap-1"
                          >
                            <Edit size={12} /> Edit
                          </button>
                          <button
                            onClick={() => setAdjustingProduct(item)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Adjust stock
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/30 bg-muted/20">
                <td colSpan={8} className="px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span>Total Records: {filteredItems.length}</span>
                    <span>Total Units: {totalUnitsFiltered}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={page <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-foreground">
                        Page {page + 1} of {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default Inventory;
