import { useMemo, useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Search, Filter, Plus, Trash2, CheckCircle2, Package, Truck, MapPin, Clock, AlertCircle, Edit, Copy, Calendar, Download, Printer } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ordersApi, orderItemsApi, orderHistoryApi } from "@/lib/api/orders";
import { productsApi } from "@/lib/api/products";
import { customersApi } from "@/lib/api/customers";
import type { Order, OrderItem, Product, OrderChannel, OrderStage, OrderStatus, PaymentStatus, ProductCategory } from "@/types/database";
import { toast } from "sonner";
import { validateEmail, validatePhone, validateStockAvailability, formatPhone } from "@/lib/utils/validation";
import { generateOrdersCSV, downloadCSV, generateShippingLabels, printLabels, copyToClipboard } from "@/lib/utils/bulk-actions";
import { generateOrderReceipt } from "@/lib/utils/receipt";

const statusPill: Record<OrderStatus, string> = {
  Processing: "bg-amber-500/15 text-amber-300",
  Shipped: "bg-sky-500/15 text-sky-300",
  Delivered: "bg-emerald-500/15 text-emerald-300",
  Cancelled: "bg-rose-500/15 text-rose-300",
  Returned: "bg-purple-500/15 text-purple-300",
};

const channelRefPrefix: Record<OrderChannel, string> = {
  "Online Orders": "WEB",
  "Boutique & Pop-up": "BTQ",
  Wholesale: "WHO",
  Returns: "RET",
};

type LineItem = {
  tempId: string;
  product_id?: string;
  product_name: string;
  product_category: ProductCategory;
  product_type: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
};

const Orders = () => {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, error } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const [channel, setChannel] = useState<OrderChannel>("Online Orders");
  const [stage, setStage] = useState<"All" | OrderStage>("All");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const [createForm, setCreateForm] = useState({
    channel: "Online Orders" as OrderChannel,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    location: "",
    shippingFee: "0",
    discount: "0",
    paymentMethod: "Card",
    paymentStatus: "Paid" as PaymentStatus,
    shippingMethod: "Standard",
    customerNotes: "",
    internalNotes: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [currentLine, setCurrentLine] = useState({
    productCategory: "Perfume" as ProductCategory,
    productId: "",
    quantity: "1",
    discount: "0",
  });

  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: ["orderItems", selectedOrder?.id],
    queryFn: () => (selectedOrder ? orderItemsApi.listByOrderId(selectedOrder.id) : Promise.resolve([])),
    enabled: !!selectedOrder,
  });

  const { data: orderHistory = [] } = useQuery({
    queryKey: ["orderHistory", selectedOrder?.id],
    queryFn: () => (selectedOrder ? orderHistoryApi.listByOrderId(selectedOrder.id) : Promise.resolve([])),
    enabled: !!selectedOrder,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (order: Partial<Order>) => {
      const created = await ordersApi.create(order);
      if (lineItems.length > 0) {
        await orderItemsApi.bulkCreate(
          lineItems.map((item) => ({
            order_id: created.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_category: item.product_category,
            product_type: item.product_type,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            tax: 0,
            line_total: item.line_total,
          })),
        );
      }
      return created;
    },
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order created successfully");

      // Automatically generate receipt PDF for paid online orders
      if (created.channel === "Online Orders" && created.payment_status === "Paid" && lineItems.length > 0) {
        try {
          await generateOrderReceipt(created as Order, lineItems);
        } catch (err) {
          console.error("Failed to generate receipt PDF", err);
        }
      }

      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create order");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, stage }: { id: string; status: OrderStatus; stage: OrderStage }) =>
      ordersApi.updateStatus(id, status, stage, "Admin"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orderHistory"] });
      toast.success("Order status updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Order> }) => ordersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update order");
    },
  });

  const totals = useMemo(() => {
    const total = orders.length;
    const scheduled = orders.filter((o) => o.stage === "Scheduled").length;
    const inProgress = orders.filter((o) => o.stage === "In Progress").length;
    const completed = orders.filter((o) => o.stage === "Completed").length;
    return { total, scheduled, inProgress, completed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Channel filter
      if (o.channel !== channel) return false;
      
      // Stage filter
      if (stage !== "All" && o.stage !== stage) return false;
      
      // Date filter
      if (dateFilter !== "all") {
        const orderDate = new Date(o.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dateFilter === "today") {
          const orderDay = new Date(orderDate);
          orderDay.setHours(0, 0, 0, 0);
          if (orderDay.getTime() !== today.getTime()) return false;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (orderDate < weekAgo) return false;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          if (orderDate < monthAgo) return false;
        }
      }
      
      // Courier filter
      if (courierFilter !== "all" && o.courier !== courierFilter) return false;
      
      // Payment filter
      if (paymentFilter !== "all" && o.payment_status !== paymentFilter) return false;
      
      // Search filter
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        o.id.toLowerCase().includes(term) ||
        o.reference?.toLowerCase().includes(term) ||
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_email?.toLowerCase().includes(term) ||
        o.customer_phone?.toLowerCase().includes(term)
      );
    });
  }, [orders, channel, stage, search, dateFilter, courierFilter, paymentFilter]);

  const productsByCategory = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        if (!acc[p.product_category]) acc[p.product_category] = [];
        acc[p.product_category].push(p);
        return acc;
      },
      {} as Record<string, Product[]>,
    );
  }, [products]);

  const handleCreateChange = (field: keyof typeof createForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (field: keyof typeof currentLine, value: string) => {
    setCurrentLine((prev) => ({ ...prev, [field]: value }));
  };

  const addLineItem = () => {
    if (!currentLine.productId) return;
    const product = products.find((p) => p.id === currentLine.productId);
    if (!product) return;

    const quantity = Number(currentLine.quantity) || 1;
    
    // Validate stock availability
    const stockCheck = validateStockAvailability(quantity, product.stock_on_hand);
    if (!stockCheck.valid) {
      toast.error(stockCheck.message);
      return;
    }

    const discount = Number(currentLine.discount) || 0;
    const lineTotal = product.price * quantity - discount;

    const newLine: LineItem = {
      tempId: `temp-${Date.now()}`,
      product_id: product.id,
      product_name: product.product_name,
      product_category: product.product_category,
      product_type: product.product_type || "",
      sku: product.sku,
      quantity,
      unit_price: product.price,
      discount,
      line_total: lineTotal,
    };

    setLineItems((prev) => [...prev, newLine]);
    setCurrentLine({
      productCategory: "Perfume",
      productId: "",
      quantity: "1",
      discount: "0",
    });
  };

  const removeLineItem = (tempId: string) => {
    setLineItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const shippingFee = Number(createForm.shippingFee) || 0;
    const discount = Number(createForm.discount) || 0;
    const tax = 0;
    const grandTotal = subtotal + shippingFee - discount + tax;
    return { subtotal, shippingFee, discount, tax, grandTotal };
  };

  const resetCreateForm = () => {
    setCreateForm({
      channel: "Online Orders",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      location: "",
      shippingFee: "0",
      discount: "0",
      paymentMethod: "Card",
      paymentStatus: "Paid",
      shippingMethod: "Standard",
      customerNotes: "",
      internalNotes: "",
    });
    setLineItems([]);
    setCurrentLine({
      productCategory: "Perfume",
      productId: "",
      quantity: "1",
      discount: "0",
    });
  };

  const handleCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createForm.customerName.trim() || lineItems.length === 0) {
      toast.error("Customer name and at least one product are required");
      return;
    }

    // Validate email if provided
    if (createForm.customerEmail.trim() && !validateEmail(createForm.customerEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate phone number
    if (!validatePhone(createForm.customerPhone.trim())) {
      toast.error("Please enter a valid South African phone number (e.g., +27 82 123 4567 or 082 123 4567)");
      return;
    }

    const newIdNumber = 1050 + orders.length;
    const today = new Date();
    const dateStamp = today.toISOString().slice(0, 10).replace(/-/g, "");
    const reference = `${channelRefPrefix[createForm.channel]}-${dateStamp}-${newIdNumber}`;

    const totals = calculateTotals();

    const newOrder: Partial<Order> = {
      id: `DE-${newIdNumber}`,
      reference,
      channel: createForm.channel,
      status: "Processing",
      stage: "Scheduled",
      subtotal: totals.subtotal,
      shipping_fee: totals.shippingFee,
      discount: totals.discount,
      tax: totals.tax,
      grand_total: totals.grandTotal,
      currency: "ZAR",
      payment_status: createForm.paymentStatus,
      payment_method: createForm.paymentMethod,
      shipping_method: createForm.shippingMethod,
      location: createForm.location.trim() || "Online Store",
      score: "-",
      findings: "Awaiting picking",
      customer_name: createForm.customerName.trim(),
      customer_email: createForm.customerEmail.trim(),
      customer_phone: formatPhone(createForm.customerPhone.trim()),
      customer_address: createForm.customerAddress.trim() || "To be confirmed",
      internal_notes: createForm.internalNotes.trim(),
      customer_notes: createForm.customerNotes.trim(),
      date: today.toISOString().slice(0, 10),
    };

    createOrderMutation.mutate(newOrder);
  };

  const handleStatusChange = (orderId: string, status: OrderStatus, stage: OrderStage) => {
    updateStatusMutation.mutate({ id: orderId, status, stage });
    setSelectedOrder(null);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedItems.length === 0) {
      toast.error("No orders selected");
      return;
    }

    if (action === "Mark as In Progress") {
      try {
        await Promise.all(
          selectedItems.map((orderId) =>
            ordersApi.updateStatus(orderId, "Processing", "In Progress", "Admin")
          )
        );
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        setSelectedItems([]);
        toast.success(`${selectedItems.length} orders marked as In Progress`);
      } catch (error) {
        toast.error("Failed to update orders");
        console.error(error);
      }
    } else if (action === "Export CSV") {
      try {
        const selectedOrders = orders.filter((o) => selectedItems.includes(o.id));
        const ordersWithItems = await Promise.all(
          selectedOrders.map(async (order) => {
            const items = await orderItemsApi.listByOrderId(order.id);
            return { ...order, items };
          })
        );
        const csv = generateOrdersCSV(ordersWithItems);
        const filename = `dumi-essence-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCSV(csv, filename);
        toast.success(`Exported ${selectedItems.length} orders to CSV`);
      } catch (error) {
        toast.error("Failed to export CSV");
        console.error(error);
      }
    } else if (action === "Print Labels") {
      try {
        const selectedOrders = orders.filter((o) => selectedItems.includes(o.id));
        const html = generateShippingLabels(selectedOrders);
        printLabels(html);
        toast.success(`Generated labels for ${selectedItems.length} orders`);
      } catch (error) {
        toast.error("Failed to generate labels");
        console.error(error);
      }
    }
  };

  const toggleSelection = (orderId: string) => {
    setSelectedItems((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredOrders.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredOrders.map((o) => o.id));
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setEditOpen(true);
  };

  const handleUpdateCourier = async (orderId: string, courier: string, trackingNumber: string) => {
    try {
      await updateOrderMutation.mutateAsync({
        id: orderId,
        updates: { courier, tracking_number: trackingNumber },
      });
      setSelectedOrder(null);
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleCopyTracking = async (trackingNumber: string) => {
    const success = await copyToClipboard(trackingNumber);
    if (success) {
      toast.success("Tracking number copied to clipboard");
    } else {
      toast.error("Failed to copy tracking number");
    }
  };

  const handleCopyOrderDetails = async (order: Order) => {
    const details = `Order ${order.id}
Reference: ${order.reference}
Customer: ${order.customer_name}
Phone: ${order.customer_phone}
Address: ${order.customer_address}
Total: R${order.grand_total.toFixed(2)}
Status: ${order.status} (${order.stage})`;
    
    const success = await copyToClipboard(details);
    if (success) {
      toast.success("Order details copied to clipboard");
    } else {
      toast.error("Failed to copy order details");
    }
  };

  const totalsCalc = calculateTotals();

  const handleDownloadReceipt = async () => {
    if (!selectedOrder) return;
    if (!orderItems || orderItems.length === 0) {
      toast.error("No order items to include in receipt");
      return;
    }
    try {
      await generateOrderReceipt(selectedOrder, orderItems as any);
    } catch (err) {
      console.error("Failed to generate receipt PDF", err);
      toast.error("Failed to generate receipt PDF");
    }
  };

  // Real-time notifications for new orders
  useEffect(() => {
    const checkForNewOrders = () => {
      if (orders.length > 0) {
        const latestOrder = orders[0];
        const orderAge = Date.now() - new Date(latestOrder.created_at).getTime();
        // If order is less than 5 seconds old, show notification
        if (orderAge < 5000) {
          toast.info(`New order received: ${latestOrder.id}`, {
            description: `${latestOrder.customer_name} - R${latestOrder.grand_total.toFixed(2)}`,
          });
        }
      }
    };

    checkForNewOrders();
  }, [orders]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold text-foreground">
            Orders & Fulfilment
          </motion.h1>
          <p className="text-sm text-muted-foreground mt-1">Plan, execute and track all Dumi Essence customer orders.</p>
        </div>
        <Button className="px-4 py-2" onClick={() => setCreateOpen(true)}>
          + Create Order
        </Button>
      </div>

      {/* Top counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-xs">
        <div className="glass-card px-4 py-3 flex flex-col gap-1">
          <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Total Orders</span>
          <span className="text-lg font-semibold text-foreground">{totals.total}</span>
          <span className="text-[11px] text-muted-foreground">this year</span>
        </div>
        <div className="glass-card px-4 py-3 flex flex-col gap-1">
          <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Scheduled</span>
          <span className="text-lg font-semibold text-foreground">{totals.scheduled}</span>
          <span className="text-[11px] text-muted-foreground">upcoming</span>
        </div>
        <div className="glass-card px-4 py-3 flex flex-col gap-1">
          <span className="text-muted-foreground uppercase tracking-wide text-[11px]">In Progress</span>
          <span className="text-lg font-semibold text-foreground">{totals.inProgress}</span>
          <span className="text-[11px] text-muted-foreground">active</span>
        </div>
        <div className="glass-card px-4 py-3 flex flex-col gap-1">
          <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Completed</span>
          <span className="text-lg font-semibold text-foreground">{totals.completed}</span>
          <span className="text-[11px] text-muted-foreground">delivered</span>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card px-4 py-3 mb-3 flex items-center justify-between"
        >
          <span className="text-xs text-foreground">{selectedItems.length} orders selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Mark as In Progress")}>
              Mark as In Progress
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Export CSV")}>
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Print Labels")}>
              Print Labels
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedItems([])}>
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Channel tabs */}
      <div className="glass-card px-2 py-2 mb-3 flex items-center justify-between text-xs">
        <div className="flex gap-1">
          {(["Online Orders", "Boutique & Pop-up", "Wholesale", "Returns"] as OrderChannel[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setChannel(tab)}
              className={`px-3 py-1.5 rounded-md ${
                channel === tab ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">{filteredOrders.length} total</span>
      </div>

      <p className="text-[11px] text-muted-foreground mb-2 font-medium">{channel}</p>

      {/* Status tabs */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex gap-2">
          {["All", "Scheduled", "In Progress", "Completed"].map((label) => (
            <button
              key={label}
              onClick={() => setStage(label as "All" | OrderStage)}
              className={`px-3 py-1.5 rounded-full border text-[11px] ${
                stage === label ? "bg-foreground text-background border-transparent" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label === "All" ? "All Orders" : label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#020617] border border-border">
            <Search size={14} className="text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders..."
              className="bg-transparent border-none outline-none text-[11px] text-foreground placeholder:text-muted-foreground w-40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Date filter */}
          <select
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-[11px] bg-background text-foreground"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          {/* Payment filter */}
          <select
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-[11px] bg-background text-foreground"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Orders table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
        {isLoading && (
          <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">Loading orders…</div>
        )}
        {error && (
          <div className="px-4 py-6 text-center text-[11px] text-rose-400">
            Failed to load orders. Check your Supabase connection.
          </div>
        )}
        {!isLoading && !error && (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-[#020617]">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                {["Order ID", "Items", "Status", "Payment", "Location", "Date", "Total", "Customer", "Phone", "Ref", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-muted-foreground" />
                      <p className="text-sm text-foreground">No orders found</p>
                      <p className="text-[11px] text-muted-foreground">
                        {orders.length === 0 ? "Create your first order to get started" : "Try adjusting your filters"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, i) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 * i }}
                    className="border-b border-border/40 hover:bg-[#020617] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(order.id)}
                        onChange={() => toggleSelection(order.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-emerald-300">{order.id}</td>
                    <td className="px-4 py-3 text-[11px] text-foreground max-w-[200px] truncate">
                      {orderItems.length > 0 ? `${orderItems.length} items` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPill[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] ${
                          order.payment_status === "Paid"
                            ? "text-emerald-400"
                            : order.payment_status === "Failed"
                              ? "text-rose-400"
                              : "text-amber-300"
                        }`}
                      >
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{order.location}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{order.date}</td>
                    <td className="px-4 py-3 text-[11px] font-semibold text-foreground">R{order.grand_total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{order.customer_name}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{order.customer_phone}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{order.reference}</td>
                    <td className="px-4 py-3 text-[11px] text-emerald-300 underline cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      View
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* View order dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order {selectedOrder.id}</DialogTitle>
              <DialogDescription>Full details and actions for this Dumi Essence order.</DialogDescription>
            </DialogHeader>

            {/* Status action buttons */}
            <div className="flex flex-wrap gap-2 py-3 border-y border-border">
              {selectedOrder.stage === "Scheduled" && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedOrder.id, "Processing", "In Progress")}>
                  <Package size={14} /> Start Picking
                </Button>
              )}
              {selectedOrder.stage === "In Progress" && selectedOrder.status === "Processing" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedOrder.id, "Processing", "In Progress")}>
                    <CheckCircle2 size={14} /> Mark as Packed
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedOrder.id, "Shipped", "In Progress")}>
                    <Truck size={14} /> Mark as Shipped
                  </Button>
                </>
              )}
              {selectedOrder.status === "Shipped" && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedOrder.id, "Delivered", "Completed")}>
                  <MapPin size={14} /> Mark as Delivered
                </Button>
              )}
              {selectedOrder.stage !== "Completed" && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedOrder.id, "Cancelled", "Completed")}>
                  Cancel Order
                </Button>
              )}
              {selectedOrder.status === "Delivered" && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedOrder.id, "Returned", "Completed")}>
                  Mark as Returned
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownloadReceipt}>
                <Printer size={14} /> Receipt PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleCopyOrderDetails(selectedOrder)}>
                <Copy size={14} /> Copy Details
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleEditOrder(selectedOrder)}>
                <Edit size={14} /> Edit Order
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              {/* Customer */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Customer</p>
                <p className="text-foreground">{selectedOrder.customer_name}</p>
                <p className="text-muted-foreground text-xs">{selectedOrder.customer_email}</p>
                <p className="text-muted-foreground text-xs">{selectedOrder.customer_phone}</p>
              </div>

              {/* Delivery address */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Delivery address</p>
                <p className="text-sm text-foreground leading-relaxed">{selectedOrder.customer_address}</p>
              </div>
            </div>

            {/* Order items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Order items</p>
              <div className="glass-card p-4">
                {orderItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No items found</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 text-[11px] text-muted-foreground">Product</th>
                        <th className="text-left py-2 text-[11px] text-muted-foreground">SKU</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Qty</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Price</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Discount</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/20">
                          <td className="py-2 text-foreground">{item.product_name}</td>
                          <td className="py-2 text-muted-foreground">{item.sku}</td>
                          <td className="py-2 text-right text-foreground">{item.quantity}</td>
                          <td className="py-2 text-right text-foreground">R{item.unit_price.toFixed(2)}</td>
                          <td className="py-2 text-right text-muted-foreground">-R{item.discount.toFixed(2)}</td>
                          <td className="py-2 text-right font-semibold text-foreground">R{item.line_total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">Subtotal</p>
                <p className="text-foreground">R{selectedOrder.subtotal.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Shipping</p>
                <p className="text-foreground">R{selectedOrder.shipping_fee.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Discount</p>
                <p className="text-foreground">-R{selectedOrder.discount.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Grand Total</p>
                <p className="text-foreground font-semibold">R{selectedOrder.grand_total.toFixed(2)}</p>
              </div>
            </div>

            {/* Payment & shipping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">Payment</p>
                <p className="text-foreground">
                  {selectedOrder.payment_status} · {selectedOrder.payment_method || "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Shipping method</p>
                <p className="text-foreground">{selectedOrder.shipping_method || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Courier</p>
                <div className="flex items-center gap-2">
                  <p className="text-foreground">{selectedOrder.courier || "Not assigned"}</p>
                  {selectedOrder.stage !== "Completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        const courier = prompt("Enter courier name:", selectedOrder.courier || "");
                        if (courier !== null) {
                          handleUpdateCourier(selectedOrder.id, courier, selectedOrder.tracking_number || "");
                        }
                      }}
                    >
                      <Edit size={10} />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Tracking number</p>
                <div className="flex items-center gap-2">
                  <p className="text-foreground font-mono">{selectedOrder.tracking_number || "Not available"}</p>
                  {selectedOrder.tracking_number && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleCopyTracking(selectedOrder.tracking_number!)}
                    >
                      <Copy size={10} />
                    </Button>
                  )}
                  {selectedOrder.stage !== "Completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        const tracking = prompt("Enter tracking number:", selectedOrder.tracking_number || "");
                        if (tracking !== null) {
                          handleUpdateCourier(selectedOrder.id, selectedOrder.courier || "", tracking);
                        }
                      }}
                    >
                      <Edit size={10} />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {(selectedOrder.customer_notes || selectedOrder.internal_notes) && (
              <div className="space-y-3 text-xs">
                {selectedOrder.customer_notes && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Customer notes</p>
                    <p className="text-foreground bg-muted/30 p-2 rounded">{selectedOrder.customer_notes}</p>
                  </div>
                )}
                {selectedOrder.internal_notes && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Internal notes</p>
                    <p className="text-foreground bg-muted/30 p-2 rounded">{selectedOrder.internal_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Status history */}
            {orderHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Status history</p>
                <div className="space-y-2">
                  {orderHistory.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <Clock size={12} className="text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-foreground">
                          {h.from_status} → <span className="font-medium">{h.to_status}</span> ({h.from_stage} → {h.to_stage})
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()} {h.changed_by && `· by ${h.changed_by}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Create order dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create order</DialogTitle>
            <DialogDescription>Capture a new paid Dumi Essence order with multiple products.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm mt-2">
            {/* Customer details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name *</Label>
                <Input id="customerName" value={createForm.customerName} onChange={(e) => handleCreateChange("customerName", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <select
                  id="channel"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createForm.channel}
                  onChange={(e) => handleCreateChange("channel", e.target.value as OrderChannel)}
                >
                  <option>Online Orders</option>
                  <option>Boutique & Pop-up</option>
                  <option>Wholesale</option>
                  <option>Returns</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Customer email</Label>
                <Input id="email" type="email" value={createForm.customerEmail} onChange={(e) => handleCreateChange("customerEmail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Customer phone *</Label>
                <Input id="phone" value={createForm.customerPhone} onChange={(e) => handleCreateChange("customerPhone", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Delivery address *</Label>
              <Input
                id="address"
                placeholder="Street, suburb, city, postal code"
                value={createForm.customerAddress}
                onChange={(e) => handleCreateChange("customerAddress", e.target.value)}
                required
              />
            </div>

            {/* Line items */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Order items *</Label>
                <span className="text-xs text-muted-foreground">{lineItems.length} items added</span>
              </div>

              {/* Add line item form */}
              <div className="glass-card p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="productCategory" className="text-xs">
                      Product category
                    </Label>
                    <select
                      id="productCategory"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={currentLine.productCategory}
                      onChange={(e) => {
                        handleLineChange("productCategory", e.target.value as ProductCategory);
                        handleLineChange("productId", "");
                      }}
                    >
                      <option value="Perfume">Perfume</option>
                      <option value="Diffuser">Diffuser</option>
                      <option value="Car Perfume">Car Perfume</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productId" className="text-xs">
                      Product *
                    </Label>
                    <select
                      id="productId"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={currentLine.productId}
                      onChange={(e) => handleLineChange("productId", e.target.value)}
                    >
                      <option value="">Select product…</option>
                      {(productsByCategory[currentLine.productCategory] || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} (Stock: {p.stock_on_hand})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-xs">
                      Qty
                    </Label>
                    <Input id="quantity" type="number" min={1} value={currentLine.quantity} onChange={(e) => handleLineChange("quantity", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lineDiscount" className="text-xs">
                      Discount (R)
                    </Label>
                    <Input id="lineDiscount" type="number" min={0} value={currentLine.discount} onChange={(e) => handleLineChange("discount", e.target.value)} />
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addLineItem} disabled={!currentLine.productId}>
                  <Plus size={14} /> Add item
                </Button>
              </div>

              {/* Line items list */}
              {lineItems.length > 0 && (
                <div className="glass-card p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 text-[11px] text-muted-foreground">Product</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Qty</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Price</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Discount</th>
                        <th className="text-right py-2 text-[11px] text-muted-foreground">Total</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item) => (
                        <tr key={item.tempId} className="border-b border-border/20">
                          <td className="py-2 text-foreground">
                            {item.product_name}
                            <span className="text-muted-foreground ml-1">({item.product_type})</span>
                          </td>
                          <td className="py-2 text-right text-foreground">{item.quantity}</td>
                          <td className="py-2 text-right text-foreground">R{item.unit_price.toFixed(2)}</td>
                          <td className="py-2 text-right text-muted-foreground">-R{item.discount.toFixed(2)}</td>
                          <td className="py-2 text-right font-semibold text-foreground">R{item.line_total.toFixed(2)}</td>
                          <td className="py-2 text-right">
                            <button type="button" onClick={() => removeLineItem(item.tempId)} className="text-rose-400 hover:text-rose-300">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment & shipping */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="paymentStatus" className="text-xs">
                  Payment status
                </Label>
                <select
                  id="paymentStatus"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createForm.paymentStatus}
                  onChange={(e) => handleCreateChange("paymentStatus", e.target.value as PaymentStatus)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod" className="text-xs">
                  Payment method
                </Label>
                <select
                  id="paymentMethod"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createForm.paymentMethod}
                  onChange={(e) => handleCreateChange("paymentMethod", e.target.value)}
                >
                  <option>Card</option>
                  <option>EFT</option>
                  <option>Cash</option>
                  <option>COD</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingMethod" className="text-xs">
                  Shipping method
                </Label>
                <select
                  id="shippingMethod"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createForm.shippingMethod}
                  onChange={(e) => handleCreateChange("shippingMethod", e.target.value)}
                >
                  <option>Standard</option>
                  <option>Express</option>
                  <option>Same-day</option>
                  <option>Collection</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingFee" className="text-xs">
                  Shipping fee (R)
                </Label>
                <Input id="shippingFee" type="number" min={0} step="0.01" value={createForm.shippingFee} onChange={(e) => handleCreateChange("shippingFee", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount" className="text-xs">
                  Order discount (R)
                </Label>
                <Input id="discount" type="number" min={0} step="0.01" value={createForm.discount} onChange={(e) => handleCreateChange("discount", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs">
                  Fulfilment location
                </Label>
                <Input id="location" placeholder="e.g. Johannesburg Warehouse" value={createForm.location} onChange={(e) => handleCreateChange("location", e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="customerNotes" className="text-xs">
                  Customer notes
                </Label>
                <Input
                  id="customerNotes"
                  placeholder="Gift wrapping, special instructions…"
                  value={createForm.customerNotes}
                  onChange={(e) => handleCreateChange("customerNotes", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internalNotes" className="text-xs">
                  Internal notes
                </Label>
                <Input
                  id="internalNotes"
                  placeholder="Staff notes, reminders…"
                  value={createForm.internalNotes}
                  onChange={(e) => handleCreateChange("internalNotes", e.target.value)}
                />
              </div>
            </div>

            {/* Order summary */}
            <div className="glass-card p-4 space-y-2 text-xs bg-muted/20">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">R{totalsCalc.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="text-foreground">R{totalsCalc.shippingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-foreground">-R{totalsCalc.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-foreground">Grand Total</span>
                <span className="font-semibold text-foreground">R{totalsCalc.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending || lineItems.length === 0}>
                {createOrderMutation.isPending ? "Saving…" : "Save order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editingOrder && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Order {editingOrder.id}</DialogTitle>
              <DialogDescription>Update customer details, shipping, and courier information.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updates: Partial<Order> = {
                  customer_name: formData.get("customerName") as string,
                  customer_email: formData.get("customerEmail") as string,
                  customer_phone: formatPhone(formData.get("customerPhone") as string),
                  customer_address: formData.get("customerAddress") as string,
                  courier: formData.get("courier") as string,
                  tracking_number: formData.get("trackingNumber") as string,
                  shipping_method: formData.get("shippingMethod") as string,
                  location: formData.get("location") as string,
                  internal_notes: formData.get("internalNotes") as string,
                };

                // Validate email
                if (updates.customer_email && !validateEmail(updates.customer_email)) {
                  toast.error("Please enter a valid email address");
                  return;
                }

                // Validate phone
                if (updates.customer_phone && !validatePhone(updates.customer_phone)) {
                  toast.error("Please enter a valid phone number");
                  return;
                }

                updateOrderMutation.mutate(
                  { id: editingOrder.id, updates },
                  {
                    onSuccess: () => {
                      setEditOpen(false);
                      setEditingOrder(null);
                    },
                  }
                );
              }}
              className="space-y-4 text-sm mt-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_customerName">Customer name *</Label>
                  <Input id="edit_customerName" name="customerName" defaultValue={editingOrder.customer_name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_customerEmail">Customer email</Label>
                  <Input id="edit_customerEmail" name="customerEmail" type="email" defaultValue={editingOrder.customer_email || ""} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_customerPhone">Customer phone *</Label>
                  <Input id="edit_customerPhone" name="customerPhone" defaultValue={editingOrder.customer_phone || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_location">Fulfilment location</Label>
                  <Input id="edit_location" name="location" defaultValue={editingOrder.location} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_customerAddress">Delivery address *</Label>
                <Input id="edit_customerAddress" name="customerAddress" defaultValue={editingOrder.customer_address || ""} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_shippingMethod">Shipping method</Label>
                  <select
                    id="edit_shippingMethod"
                    name="shippingMethod"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue={editingOrder.shipping_method || "Standard"}
                  >
                    <option>Standard</option>
                    <option>Express</option>
                    <option>Same-day</option>
                    <option>Collection</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_courier">Courier</Label>
                  <Input id="edit_courier" name="courier" placeholder="e.g., The Courier Guy" defaultValue={editingOrder.courier || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_trackingNumber">Tracking number</Label>
                  <Input id="edit_trackingNumber" name="trackingNumber" defaultValue={editingOrder.tracking_number || ""} />
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="edit_internalNotes">Internal notes</Label>
                <Input id="edit_internalNotes" name="internalNotes" placeholder="Staff notes, reminders…" defaultValue={editingOrder.internal_notes || ""} />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateOrderMutation.isPending}>
                  {updateOrderMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </DashboardLayout>
  );
};

export default Orders;
