import { useEffect, useState, type ChangeEvent } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Download, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fragranceApi } from "@/lib/api/fragrance";
import type {
  ScentechEthanolProduct,
  ScentProduct,
  ScentProforma,
  ScentProformaExtraLine,
} from "@/types/database";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type ScentRow = {
  id?: string;
  brand: string;
  item: string;
  inspiredBy: string;
  designer: string;
  type: string;
  price1kg: string;
  qty1kg: string;
  price500g: string;
  qty500g: string;
  price200g: string;
  qty200g: string;
  price100g: string;
  qty100g: string;
};

const emptyRow: ScentRow = {
  brand: "Dumi Essence",
  item: "",
  inspiredBy: "",
  designer: "",
  type: "",
  price1kg: "",
  qty1kg: "",
  price500g: "",
  qty500g: "",
  price200g: "",
  qty200g: "",
  price100g: "",
  qty100g: "",
};

type ProFormaRow = {
  id: string;
  productIndex: number | null;
  qty1kg: string;
  qty500g: string;
  qty200g: string;
  qty100g: string;
};

const OilsPage = () => {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "pro-forma" | "products" | "listed" | "proformas"
  >("dashboard");
  const [productRows, setProductRows] = useState<ScentRow[]>([emptyRow]);
  const [proFormaRows, setProFormaRows] = useState<ProFormaRow[]>([]);
  const [bottles, setBottles] = useState<
    { id?: string; name: string; ml: string; code: string; colour: string; shape: string; price: string; qty: string }
  >([{ id: undefined, name: "", ml: "", code: "", colour: "", shape: "", price: "", qty: "" }]);
  const [caps, setCaps] = useState<
    { id?: string; name: string; ml: string; code: string; colour: string; price: string; qty: string }
  >([{ id: undefined, name: "", ml: "", code: "", colour: "", price: "", qty: "" }]);
  const [pumps, setPumps] = useState<
    { id?: string; name: string; ml: string; code: string; colour: string; price: string; qty: string }
  >([{ id: undefined, name: "", ml: "", code: "", colour: "", price: "", qty: "" }]);
  const [printFees, setPrintFees] = useState<
    { name: string; colour: string; type: string; price: string; qty: string }
  >([{ name: "", colour: "", type: "", price: "", qty: "" }]);
  const [scentSearch, setScentSearch] = useState("");
  const [ethanolRows, setEthanolRows] = useState<
    { id?: string; name: string; liters: string; price: string; qty: string }
  >([{ id: undefined, name: "", liters: "", price: "", qty: "" }]);
  const [selectedProformaId, setSelectedProformaId] = useState<string | null>(null);
  const [editingProformaId, setEditingProformaId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const queryClient = useQueryClient();

  const { data: scentProducts = [] } = useQuery<ScentProduct[]>({
    queryKey: ["scentProducts"],
    queryFn: fragranceApi.listScentProducts,
  });

  const { data: scentProformas = [] } = useQuery<ScentProforma[]>({
    queryKey: ["scentProformas"],
    queryFn: fragranceApi.listProformas,
  });

  const { data: selectedProformaLines = [], isFetching: isProformaLinesFetching } = useQuery({
    queryKey: ["scentProformaLines", selectedProformaId],
    queryFn: () => fragranceApi.listProformaLines(selectedProformaId as string),
    enabled: !!selectedProformaId,
  });

  const {
    data: selectedProformaExtras = [],
    isFetching: isProformaExtrasFetching,
  } = useQuery<ScentProformaExtraLine[]>({
    queryKey: ["scentProformaExtras", selectedProformaId],
    queryFn: () =>
      fragranceApi.listProformaExtras(selectedProformaId as string),
    enabled: !!selectedProformaId,
  });

  const { data: bottleProducts = [] } = useQuery({
    queryKey: ["bottleProducts"],
    queryFn: fragranceApi.listBottleProducts,
  });

  const { data: pumpProducts = [] } = useQuery({
    queryKey: ["pumpProducts"],
    queryFn: fragranceApi.listPumpProducts,
  });

  const { data: capProducts = [] } = useQuery({
    queryKey: ["capProducts"],
    queryFn: fragranceApi.listCapProducts,
  });

  const { data: ethanolProducts = [] } = useQuery<ScentechEthanolProduct[]>({
    queryKey: ["ethanolProducts"],
    queryFn: fragranceApi.listEthanolProducts,
  });

  useEffect(() => {
    const loadRole = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return;
        const role = (data.user.user_metadata as any)?.role;
        if (role === "superadmin") {
          setIsSuperAdmin(true);
        }
      } catch {
        // ignore
      }
    };
    loadRole();
  }, []);

  useEffect(() => {
    if (!editingProformaId) return;
    if (!selectedProformaLines || selectedProformaLines.length === 0) return;

    // 1) Restore scent rows
    const mappedRows: ProFormaRow[] = selectedProformaLines.map(
      (line: any, index: number) => {
        const productIndex = scentProducts.findIndex(
          (p) => p.id === line.scent_product_id,
        );

        return {
          id: `pf-edit-${line.id ?? index}`,
          productIndex: productIndex >= 0 ? productIndex : null,
          qty1kg:
            line.qty_1kg !== undefined && line.qty_1kg !== null
              ? String(line.qty_1kg)
              : "",
          qty500g:
            line.qty_500g !== undefined && line.qty_500g !== null
              ? String(line.qty_500g)
              : "",
          qty200g:
            line.qty_200g !== undefined && line.qty_200g !== null
              ? String(line.qty_200g)
              : "",
          qty100g:
            line.qty_100g !== undefined && line.qty_100g !== null
              ? String(line.qty_100g)
              : "",
        };
      },
    );

    if (mappedRows.length > 0) {
      setProFormaRows(mappedRows);
    }

    // 2) Restore packaging / extras into the Pro-Forma editor
    if (selectedProformaExtras && selectedProformaExtras.length > 0) {
      const bottleExtras = selectedProformaExtras.filter(
        (e) => e.kind === "bottle",
      );
      if (bottleExtras.length) {
        setBottles(
          bottleExtras.map((e) => {
            const match = bottleProducts.find((b) => b.name === e.name);
            const qty = Number(e.qty ?? 0) || 0;
            const unitPrice =
              qty && e.line_total != null
                ? Number(e.line_total) / qty
                : match?.price ?? null;
            return {
              id: match?.id,
              name: e.name,
              ml: match?.ml != null ? String(match.ml) : "",
              code: match?.code ?? "",
              colour: match?.colour ?? "",
              shape: match?.shape ?? "",
              price: unitPrice != null ? unitPrice.toFixed(2) : "",
              qty: qty ? String(qty) : "",
            };
          }),
        );
      }

      const printExtras = selectedProformaExtras.filter(
        (e) => e.kind === "print_fee",
      );
      if (printExtras.length) {
        setPrintFees(
          printExtras.map((e) => {
            const qty = Number(e.qty ?? 0) || 0;
            const unitPrice =
              qty && e.line_total != null
                ? Number(e.line_total) / qty
                : null;
            return {
              name: e.name,
              colour: "",
              type: e.spec ?? "",
              price: unitPrice != null ? unitPrice.toFixed(2) : "",
              qty: qty ? String(qty) : "",
            };
          }),
        );
      }

      const ethanolExtras = selectedProformaExtras.filter(
        (e) => e.kind === "ethanol",
      );
      if (ethanolExtras.length) {
        setEthanolRows(
          ethanolExtras.map((e) => {
            const match = ethanolProducts.find((p) => p.name === e.name);
            const qty = Number(e.qty ?? 0) || 0;
            const unitPrice =
              qty && e.line_total != null
                ? Number(e.line_total) / qty
                : match?.price ?? null;
            return {
              id: match?.id,
              name: e.name,
              liters: match?.liters != null ? String(match.liters) : "",
              price: unitPrice != null ? unitPrice.toFixed(2) : "",
              qty: qty ? String(qty) : "",
            };
          }),
        );
      }

      const pumpExtras = selectedProformaExtras.filter(
        (e) => e.kind === "pump",
      );
      if (pumpExtras.length) {
        setPumps(
          pumpExtras.map((e) => {
            const match = pumpProducts.find((p) => p.name === e.name);
            const qty = Number(e.qty ?? 0) || 0;
            const unitPrice =
              qty && e.line_total != null
                ? Number(e.line_total) / qty
                : match?.price ?? null;
            return {
              id: match?.id,
              name: e.name,
              ml: match?.ml != null ? String(match.ml) : "",
              code: match?.code ?? "",
              colour: match?.colour ?? "",
              price: unitPrice != null ? unitPrice.toFixed(2) : "",
              qty: qty ? String(qty) : "",
            };
          }),
        );
      }

      const capExtras = selectedProformaExtras.filter((e) => e.kind === "cap");
      if (capExtras.length) {
        setCaps(
          capExtras.map((e) => {
            const match = capProducts.find((p) => p.name === e.name);
            const qty = Number(e.qty ?? 0) || 0;
            const unitPrice =
              qty && e.line_total != null
                ? Number(e.line_total) / qty
                : match?.price ?? null;
            return {
              id: match?.id,
              name: e.name,
              ml: match?.ml != null ? String(match.ml) : "",
              code: match?.code ?? "",
              colour: match?.colour ?? "",
              price: unitPrice != null ? unitPrice.toFixed(2) : "",
              qty: qty ? String(qty) : "",
            };
          }),
        );
      }
    }

    setActiveTab("pro-forma");
    setEditingProformaId(null);
  }, [
    editingProformaId,
    selectedProformaLines,
    selectedProformaExtras,
    scentProducts,
    bottleProducts,
    pumpProducts,
    capProducts,
    ethanolProducts,
    setActiveTab,
  ]);

  useEffect(() => {
    if (scentProducts.length === 0) return;
    // Keep Products tab as data-entry only; Pro-Forma uses listed products
    setProFormaRows((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              id: `pf-init`,
              productIndex: 0,
        qty1kg: "",
        qty500g: "",
        qty200g: "",
        qty100g: "",
            },
          ],
    );
  }, [scentProducts]);

  useEffect(() => {
    if (bottleProducts.length === 0) return;
    setBottles((prev) => {
      const isPristine =
        prev.length === 1 &&
        !prev[0].id &&
        !prev[0].name &&
        !prev[0].code &&
        !prev[0].colour &&
        !prev[0].shape &&
        !prev[0].price &&
        !prev[0].qty;
      if (!isPristine) return prev;
      return bottleProducts.map((p) => ({
        id: p.id,
        name: p.name,
        ml: p.ml?.toString() ?? "",
        code: p.code ?? "",
        colour: p.colour ?? "",
        shape: p.shape ?? "",
        price: p.price?.toString() ?? "",
        qty: "",
      }));
    });
  }, [bottleProducts]);

  useEffect(() => {
    if (pumpProducts.length === 0) return;
    setPumps((prev) => {
      const isPristine =
        prev.length === 1 &&
        !prev[0].id &&
        !prev[0].name &&
        !prev[0].code &&
        !prev[0].colour &&
        !prev[0].price &&
        !prev[0].qty;
      if (!isPristine) return prev;
      return pumpProducts.map((p) => ({
        id: p.id,
        name: p.name,
        ml: p.ml?.toString() ?? "",
        code: p.code ?? "",
        colour: p.colour ?? "",
        price: p.price?.toString() ?? "",
        qty: "",
      }));
    });
  }, [pumpProducts]);

  useEffect(() => {
    if (capProducts.length === 0) return;
    setCaps((prev) => {
      const isPristine =
        prev.length === 1 &&
        !prev[0].id &&
        !prev[0].name &&
        !prev[0].code &&
        !prev[0].colour &&
        !prev[0].price &&
        !prev[0].qty;
      if (!isPristine) return prev;
      return capProducts.map((p) => ({
        id: p.id,
        name: p.name,
        ml: p.ml?.toString() ?? "",
        code: p.code ?? "",
        colour: p.colour ?? "",
        price: p.price?.toString() ?? "",
        qty: "",
      }));
    });
  }, [capProducts]);

  useEffect(() => {
    if (ethanolProducts.length === 0) return;
    setEthanolRows((prev) => {
      const isPristine =
        prev.length === 1 &&
        !prev[0].id &&
        !prev[0].name &&
        !prev[0].liters &&
        !prev[0].price &&
        !prev[0].qty;
      if (!isPristine) return prev;
      return ethanolProducts.map((p) => ({
        id: p.id,
        name: p.name,
        liters: p.liters?.toString() ?? "",
        price: p.price?.toString() ?? "",
        qty: "",
      }));
    });
  }, [ethanolProducts]);

  const saveScentProductsMutation = useMutation({
    mutationFn: async (rows: ScentRow[]) => {
      const parsePrice = (value: string) => {
        if (!value) return null;
        const cleaned = value
          .replace(/R/gi, "")
          .replace(/\s/g, "")
          .replace(/,/g, "");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      const isEmptyRow = (r: ScentRow) => {
        const hasBrand = r.brand && r.brand.trim().length > 0;
        const hasItem = r.item && r.item.trim().length > 0;
        const hasAnyPrice =
          (r.price1kg && r.price1kg.trim().length > 0) ||
          (r.price500g && r.price500g.trim().length > 0) ||
          (r.price200g && r.price200g.trim().length > 0) ||
          (r.price100g && r.price100g.trim().length > 0);
        return !hasBrand && !hasItem && !hasAnyPrice;
      };

      const normalizeKey = (brand: string | undefined, item: string | undefined) =>
        `${(brand || "Dumi Essence").trim().toLowerCase()}|${(item || "").trim().toLowerCase()}`;

      const existingKeys = new Set(
        scentProducts.map((p) => normalizeKey(p.brand, p.item)),
      );

      await Promise.all(
        rows
          .filter((r) => !isEmptyRow(r))
          // Skip new rows that would duplicate an existing listed product
          .filter((r) => {
            if (r.id) return true;
            if (!r.item || !r.item.trim()) return false;
            const key = normalizeKey(r.brand, r.item);
            if (existingKeys.has(key)) {
              return false;
            }
            existingKeys.add(key);
            return true;
          })
          .map((r) =>
            fragranceApi.upsertScentProduct({
              id: r.id,
              brand: r.brand || "Dumi Essence",
              item: r.item.trim(),
              inspired_by: r.inspiredBy || null,
              designer: r.designer || null,
              scent_type: r.type || null,
              price_1kg: parsePrice(r.price1kg),
              price_500g: parsePrice(r.price500g),
              price_200g: parsePrice(r.price200g),
              price_100g: parsePrice(r.price100g),
            }),
          ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scentProducts"] });
      toast.success("Scent products saved to Supabase");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save scent products");
    },
  });

  const updateProductCell = (index: number, field: keyof ScentRow, value: string) => {
    setProductRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addProductRow = () => {
    setProductRows((prev) => [...prev, emptyRow]);
  };

  const addProFormaRow = () => {
    setProFormaRows((prev) => [
      ...prev,
      {
        id: `pf-${Date.now()}-${prev.length}`,
        productIndex: productRows.length > 0 ? 0 : null,
        qty1kg: "",
        qty500g: "",
        qty200g: "",
        qty100g: "",
      },
    ]);
  };

  const updateProFormaRow = (
    id: string,
    field: keyof ProFormaRow,
    value: string | number | null,
  ) => {
    setProFormaRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value as any } : row,
      ),
    );
  };

  const updateBottle = (
    index: number,
    field: "name" | "ml" | "code" | "colour" | "shape" | "price" | "qty",
    value: string,
  ) => {
    setBottles((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addBottleRow = () => {
    setBottles((prev) => [
      ...prev,
      { name: "", ml: "", code: "", colour: "", shape: "", price: "", qty: "" },
    ]);
  };

  const updateCap = (
    index: number,
    field: "name" | "ml" | "code" | "colour" | "price" | "qty",
    value: string,
  ) => {
    setCaps((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addCapRow = () => {
    setCaps((prev) => [
      ...prev,
      { name: "", ml: "", code: "", colour: "", price: "", qty: "" },
    ]);
  };

  const amountValue = (price: string, qty: string) => {
    const normalize = (value: string) => {
      if (!value) return 0;
      const cleaned = value
        .replace(/R/gi, "")
        .replace(/\s/g, "")
        .replace(",", ".");
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : 0;
    };

    const p = normalize(price);
    const q = normalize(qty);
    return p * q;
  };

  const updatePump = (
    index: number,
    field: "name" | "ml" | "code" | "colour" | "price" | "qty",
    value: string,
  ) => {
    setPumps((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addPumpRow = () => {
    setPumps((prev) => [
      ...prev,
      { name: "", ml: "", code: "", colour: "", price: "", qty: "" },
    ]);
  };

  const updatePrintFee = (
    index: number,
    field: "name" | "colour" | "type" | "price" | "qty",
    value: string,
  ) => {
    setPrintFees((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addPrintFeeRow = () => {
    setPrintFees((prev) => [
      ...prev,
      { name: "", colour: "", type: "", price: "", qty: "" },
    ]);
  };

  const updateEthanol = (
    index: number,
    field: "name" | "liters" | "price" | "qty",
    value: string,
  ) => {
    setEthanolRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addEthanolRow = () => {
    setEthanolRows((prev) => [
      ...prev,
      { id: undefined, name: "", liters: "", price: "", qty: "" },
    ]);
  };

  const parseCsv = (text: string) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Prefer semicolon-separated; fall back to comma if needed
        const hasSemicolon = line.includes(";");
        const delimiter = hasSemicolon ? ";" : ",";
        return line.split(delimiter).map((cell) => cell.trim());
      });

  const handleScentProductsCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (!lines.length) return;

      const headerLine = lines[0];
      const delimiter = headerLine.includes(";") ? ";" : ",";
      const headers = headerLine
        .split(delimiter)
        .map((h) => h.trim().toLowerCase());

      const idx = (name: string) => headers.indexOf(name.toLowerCase());

      const iBrand = idx("brand");
      const iItem = idx("item");
      const iInspired = idx("inspired by");
      const iDesigner = idx("designer");
      const iType = idx("type");
      const iP1 = idx("price 1kg");
      const iP5 = idx("price 500g");
      const iP2 = idx("price 200g");
      const iP1h = idx("price 100g");

      const stripQuotes = (value: string) =>
        value.startsWith('"') && value.endsWith('"')
          ? value.slice(1, -1)
          : value;

      const dataLines = lines.slice(1);
      const imported: ScentRow[] = dataLines.map((line) => {
        const cols = line.split(delimiter).map((c) => stripQuotes(c.trim()));
        return {
          brand: iBrand >= 0 ? cols[iBrand] || "Dumi Essence" : "Dumi Essence",
          item: iItem >= 0 ? cols[iItem] || "" : "",
          inspiredBy: iInspired >= 0 ? cols[iInspired] || "" : "",
          designer: iDesigner >= 0 ? cols[iDesigner] || "" : "",
          type: iType >= 0 ? cols[iType] || "" : "",
          price1kg: iP1 >= 0 ? cols[iP1] || "" : "",
          qty1kg: "",
          price500g: iP5 >= 0 ? cols[iP5] || "" : "",
          qty500g: "",
          price200g: iP2 >= 0 ? cols[iP2] || "" : "",
          qty200g: "",
          price100g: iP1h >= 0 ? cols[iP1h] || "" : "",
          qty100g: "",
        };
      });

      setProductRows((prev) => [...prev, ...imported]);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleBottleProductsCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (!rows.length) return;
      const [, ...dataRows] = rows;
      const imported = dataRows.map((cols) => ({
        name: cols[0] || "",
        ml: cols[1] || "",
        code: cols[2] || "",
        colour: cols[3] || "",
        shape: cols[4] || "",
        price: cols[5] || "",
        qty: cols[6] || "",
      }));
      setBottles((prev) => [...prev, ...imported]);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handlePumpProductsCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (!rows.length) return;
      const [, ...dataRows] = rows;
      const imported = dataRows.map((cols) => ({
        name: cols[0] || "",
        ml: cols[1] || "",
        code: cols[2] || "",
        colour: cols[3] || "",
        price: cols[4] || "",
        qty: cols[5] || "",
      }));
      setPumps((prev) => [...prev, ...imported]);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleCapProductsCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (!rows.length) return;
      const [, ...dataRows] = rows;
      const imported = dataRows.map((cols) => ({
        name: cols[0] || "",
        ml: cols[1] || "",
        code: cols[2] || "",
        colour: cols[3] || "",
        price: cols[4] || "",
        qty: cols[5] || "",
      }));
      setCaps((prev) => [...prev, ...imported]);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const calcAmount = (price: string, qty: string) => {
    const total = amountValue(price, qty);
    if (!total) return "";
    return total.toFixed(2);
  };

  const scentsSubtotal =
    proFormaRows.reduce((sum, pfRow) => {
      const base =
        pfRow.productIndex !== null ? scentProducts[pfRow.productIndex] : null;
      if (!base) return sum;
      return (
        sum +
        amountValue(base.price_1kg?.toString() ?? "", pfRow.qty1kg) +
        amountValue(base.price_500g?.toString() ?? "", pfRow.qty500g) +
        amountValue(base.price_200g?.toString() ?? "", pfRow.qty200g) +
        amountValue(base.price_100g?.toString() ?? "", pfRow.qty100g)
      );
    }, 0);

  const bottlesSubtotal = bottles.reduce(
    (sum, row) => sum + amountValue(row.price, row.qty),
    0,
  );

  const pumpsSubtotal = pumps.reduce(
    (sum, row) => sum + amountValue(row.price, row.qty),
    0,
  );

  const capsSubtotal = caps.reduce(
    (sum, row) => sum + amountValue(row.price, row.qty),
    0,
  );
  const printFeesSubtotal = printFees.reduce(
    (sum, row) => sum + amountValue(row.price, row.qty),
    0,
  );
  const ethanolSubtotal = ethanolRows.reduce(
    (sum, row) => sum + amountValue(row.price, row.qty),
    0,
  );

  const subtotal =
    scentsSubtotal +
    bottlesSubtotal +
    pumpsSubtotal +
    capsSubtotal +
    printFeesSubtotal +
    ethanolSubtotal;
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const createProformaMutation = useMutation({
    mutationFn: async () => {
      if (!proFormaRows.length) {
        throw new Error("No pro-forma lines to create an order.");
      }

      // Auto-generate next reference like DE-000001
      const existing = await fragranceApi.listProformas();
      const prefix = "DE-";
      let maxSeq = 0;
      existing.forEach((pf) => {
        if (!pf.reference || !pf.reference.startsWith(prefix)) return;
        const numPart = pf.reference.slice(prefix.length).replace(/\D/g, "");
        const num = Number(numPart);
        if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
      });
      const nextSeq = maxSeq + 1;
      const nextRef = `${prefix}${nextSeq.toString().padStart(6, "0")}`;

      const header = {
        name: "Fragrance purchase",
        customer_name: "ACS Promotions",
        reference: nextRef,
        status: "pending" as const,
        subtotal,
        vat,
        total,
      };

      const toNumber = (value: string) => {
        if (!value) return 0;
        const cleaned = value.replace(/\s/g, "").replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : 0;
      };

      const lines = proFormaRows
        .map((pfRow) => {
          const base =
            pfRow.productIndex !== null
              ? scentProducts[pfRow.productIndex]
              : undefined;
          if (!base) return null;

          const qty_1kg = toNumber(pfRow.qty1kg);
          const qty_500g = toNumber(pfRow.qty500g);
          const qty_200g = toNumber(pfRow.qty200g);
          const qty_100g = toNumber(pfRow.qty100g);

          if (!qty_1kg && !qty_500g && !qty_200g && !qty_100g) {
            return null;
          }

          const row_total =
            amountValue(base.price_1kg?.toString() ?? "", pfRow.qty1kg) +
            amountValue(base.price_500g?.toString() ?? "", pfRow.qty500g) +
            amountValue(base.price_200g?.toString() ?? "", pfRow.qty200g) +
            amountValue(base.price_100g?.toString() ?? "", pfRow.qty100g);

          return {
            scent_product_id: base.id,
            qty_1kg,
            qty_500g,
            qty_200g,
            qty_100g,
            row_total,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      if (!lines.length) {
        throw new Error("All pro-forma lines are empty.");
      }

      const parseQty = (value: string) => {
        if (!value) return 0;
        const cleaned = value.replace(/\s/g, "").replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : 0;
      };

      const extras = [
        // Bottles
        ...bottles
          .map((row) => {
            const totalAmount = amountValue(row.price, row.qty);
            if (!row.name && !totalAmount) return null;
            const specBits: string[] = [];
            if (row.ml) specBits.push(`${row.ml}ml`);
            if (row.code) specBits.push(`Code: ${row.code}`);
            if (row.colour) specBits.push(row.colour);
            if (row.shape) specBits.push(row.shape);
            return {
              kind: "bottle" as const,
              name: row.name || "Bottle",
              spec: specBits.join(" · "),
              qty: parseQty(row.qty),
              line_total: totalAmount,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null),
        // Print fees
        ...printFees
          .map((row) => {
            const totalAmount = amountValue(row.price, row.qty);
            if (!row.name && !totalAmount) return null;
            const specBits: string[] = [];
            if (row.colour) specBits.push(row.colour);
            if (row.type) specBits.push(row.type);
            return {
              kind: "print_fee" as const,
              name: row.name || "Print fee",
              spec: specBits.join(" · "),
              qty: parseQty(row.qty),
              line_total: totalAmount,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null),
        // Ethanol
        ...ethanolRows
          .map((row) => {
            const totalAmount = amountValue(row.price, row.qty);
            if (!row.name && !totalAmount) return null;
            const specBits: string[] = [];
            if (row.liters) specBits.push(`${row.liters}L`);
            return {
              kind: "ethanol" as const,
              name: row.name || "Ethanol",
              spec: specBits.join(" · "),
              qty: parseQty(row.qty),
              line_total: totalAmount,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null),
        // Pumps
        ...pumps
          .map((row) => {
            const totalAmount = amountValue(row.price, row.qty);
            if (!row.name && !totalAmount) return null;
            const specBits: string[] = [];
            if (row.ml) specBits.push(`${row.ml}ml`);
            if (row.code) specBits.push(`Code: ${row.code}`);
            if (row.colour) specBits.push(row.colour);
            return {
              kind: "pump" as const,
              name: row.name || "Pump",
              spec: specBits.join(" · "),
              qty: parseQty(row.qty),
              line_total: totalAmount,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null),
        // Caps
        ...caps
          .map((row) => {
            const totalAmount = amountValue(row.price, row.qty);
            if (!row.name && !totalAmount) return null;
            const specBits: string[] = [];
            if (row.ml) specBits.push(`${row.ml}ml`);
            if (row.code) specBits.push(`Code: ${row.code}`);
            if (row.colour) specBits.push(row.colour);
            return {
              kind: "cap" as const,
              name: row.name || "Cap",
              spec: specBits.join(" · "),
              qty: parseQty(row.qty),
              line_total: totalAmount,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null),
      ];

      return fragranceApi.createProforma(header, lines, extras);
    },
    onSuccess: () => {
      toast.success("Order created from pro-forma");
      queryClient.invalidateQueries({ queryKey: ["scentProducts"] });
      queryClient.invalidateQueries({ queryKey: ["scentProformas"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create order");
    },
  });

  const deleteProformaMutation = useMutation({
    mutationFn: (id: string) => fragranceApi.deleteProforma(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scentProformas"] });
      toast.success("Pro-forma deleted");
      setSelectedProformaId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete pro-forma");
    },
  });

  const selectedProforma =
    selectedProformaId != null
      ? scentProformas.find((p) => p.id === selectedProformaId) ?? null
      : null;

  const handleDownloadSelectedHistoryPdf = async (
    orientation: "portrait" | "landscape" = "landscape",
  ) => {
    if (!selectedProformaId || !selectedProforma) {
      toast.message("Select a fragrance purchase in the table first.");
      return;
    }
    if (isProformaLinesFetching) {
      toast.message("Loading purchase lines…");
      return;
    }
    if (isProformaExtrasFetching) {
      toast.message("Loading purchase details…");
      return;
    }
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: orientation === "landscape" ? "landscape" : "portrait",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const lineHeight = 6;

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });

    const logoImg = await loadImage("/DUMI ESSENCE logo.png");

    // Header background band
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 40, "F");

    // Left-hand wording: brand + tagline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dumi Essence", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text("Fragrance & packaging solutions", margin, 26);

    // Centered logo
    if (logoImg) {
      const logoHeight = 18;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      const logoX = (pageWidth - logoWidth) / 2;
      const logoY = 11;
      doc.addImage(logoImg, "PNG", logoX, logoY, logoWidth, logoHeight);
    }

    // Address and contacts on the right
    const infoX = pageWidth - margin;
    let yInfo = 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ["652 Hashe Street", "Dobsonville", "1863"].forEach((line) => {
      doc.text(line, infoX, yInfo, { align: "right" });
      yInfo += 4;
    });

    yInfo += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Contacts", infoX, yInfo, { align: "right" });
    yInfo += 4;
    doc.setFont("helvetica", "normal");
    doc.text("info@dumiessence.co.za", infoX, yInfo, { align: "right" });
    yInfo += 4;
    doc.text("072 849 5559", infoX, yInfo, { align: "right" });

    // Separator line under header
    doc.setDrawColor(200, 170, 90);
    doc.setLineWidth(0.6);
    doc.line(margin, 45, pageWidth - margin, 45);

    // Document title and meta (match Pro-Forma tab export)
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Oils & Containers Purchase List", margin, 58);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const createdDate = new Date(selectedProforma.created_at).toISOString().slice(0, 10);
    doc.text(`Generated: ${createdDate}`, margin, 64);

    // Start content area below header
    let contentY = 80;

    const ensureSpace = (neededHeight: number) => {
      const bottomMargin = pageHeight - 20;
      if (contentY + neededHeight > bottomMargin) {
        doc.addPage();
        contentY = 30;
      }
    };

    // Table layout (Excel-style)
    const tableX = margin;
    const tableWidth = pageWidth - margin * 2;
    const col1Width = tableWidth * 0.4;
    const col2Width = tableWidth * 0.3;
    const col3Width = tableWidth * 0.15;
    const col4Width = tableWidth * 0.15;
    const colX1 = tableX;
    const colX2 = tableX + col1Width;
    const colX3 = colX2 + col2Width;
    const colX4 = colX3 + col3Width;
    const rowHeight = 5;

    const drawTableSection = (
      title: string,
      headers: [string, string, string, string],
      rows: { c1: string; c2: string; c3: string; c4: string }[],
    ) => {
      // Section heading
      ensureSpace(rowHeight * 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(title, tableX, contentY);
      contentY += rowHeight;

      // If no rows, show simple note and skip table/grid
      if (rows.length === 0) {
        ensureSpace(rowHeight);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        doc.text("No items captured.", tableX, contentY + 3);
        contentY += rowHeight + 3;
        contentY += 2;
        return;
      }

      // Header row
      ensureSpace(rowHeight + 2);
      let yTop = contentY;
      let yText = yTop + 3.5;
      doc.setDrawColor(200, 170, 90);
      doc.setFillColor(245, 245, 245);
      doc.rect(tableX, yTop, tableWidth, rowHeight, "F");
      doc.line(colX2, yTop, colX2, yTop + rowHeight);
      doc.line(colX3, yTop, colX3, yTop + rowHeight);
      doc.line(colX4, yTop, colX4, yTop + rowHeight);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(40, 40, 40);
      doc.text(headers[0], colX1 + 2, yText);
      doc.text(headers[1], colX2 + 2, yText);
      doc.text(headers[2], colX3 + 2, yText);
      doc.text(headers[3], colX4 + col4Width - 2, yText, { align: "right" });

      contentY += rowHeight;

      // Data rows
      rows.forEach((row) => {
        ensureSpace(rowHeight + 2);
        yTop = contentY;
        yText = yTop + 3.5;
        doc.setDrawColor(220, 220, 220);
        doc.rect(tableX, yTop, tableWidth, rowHeight);
        doc.line(colX2, yTop, colX2, yTop + rowHeight);
        doc.line(colX3, yTop, colX3, yTop + rowHeight);
        doc.line(colX4, yTop, colX4, yTop + rowHeight);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(40, 40, 40);
        doc.text(row.c1, colX1 + 2, yText);
        if (row.c2) doc.text(row.c2, colX2 + 2, yText);
        if (row.c3) doc.text(row.c3, colX3 + 2, yText);
        if (row.c4)
          doc.text(row.c4, colX4 + col4Width - 2, yText, { align: "right" });

        contentY += rowHeight;
      });

      contentY += 3;
    };

    // Build rows from stored pro-forma lines (match Pro-Forma scent section)
    const scentRows = selectedProformaLines
      .map((line: any) => {
        const qty1 = Number(line.qty_1kg ?? 0) || 0;
        const qty5 = Number(line.qty_500g ?? 0) || 0;
        const qty2 = Number(line.qty_200g ?? 0) || 0;
        const qty1h = Number(line.qty_100g ?? 0) || 0;
        if (!qty1 && !qty5 && !qty2 && !qty1h) return null;

        const rowTotalNum = Number(line.row_total ?? 0) || 0;

        const sizeBits: string[] = [];
        if (qty1) sizeBits.push(`${qty1} × 1kg`);
        if (qty5) sizeBits.push(`${qty5} × 500g`);
        if (qty2) sizeBits.push(`${qty2} × 200g`);
        if (qty1h) sizeBits.push(`${qty1h} × 100g`);

        const brand = line.scent_products?.brand || "Dumi Essence";
        const item = line.scent_products?.item || "—";
        const inspiredBits: string[] = [];
        if (line.scent_products?.inspired_by)
          inspiredBits.push(line.scent_products.inspired_by);
        if (line.scent_products?.designer)
          inspiredBits.push(line.scent_products.designer);

        return {
          c1: `${brand} – ${item}`,
          c2: inspiredBits.join(" / "),
          c3: sizeBits.join(", "),
          c4: `R${rowTotalNum.toFixed(2)}`,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    drawTableSection(
      "Scents (Pro-Forma)",
      ["Product", "Inspired / Designer", "Size & qty", "Row total"],
      scentRows,
    );

    const extrasOfKind = (kind: ScentProformaExtraLine["kind"]) =>
      selectedProformaExtras
        .filter((e) => e.kind === kind)
        .map((e) => ({
          c1: e.name,
          c2: e.spec ?? "",
          c3: e.qty ? String(e.qty) : "",
          c4: e.line_total ? `R${e.line_total.toFixed(2)}` : "",
        }));

    const bottleRows = extrasOfKind("bottle");
    const printRows = extrasOfKind("print_fee");
    const ethanolRowsPdf = extrasOfKind("ethanol");
    const pumpRows = extrasOfKind("pump");
    const capRows = extrasOfKind("cap");

    if (bottleRows.length) {
      drawTableSection(
        "Fragrance bottles",
        ["Bottle", "Spec", "Qty", "Line total"],
        bottleRows,
      );
    }

    if (printRows.length) {
      drawTableSection(
        "Print fees",
        ["Description", "Spec", "Qty", "Line total"],
        printRows,
      );
    }

    if (ethanolRowsPdf.length) {
      drawTableSection(
        "Scentech Ethanol",
        ["Name", "Spec", "Qty", "Line total"],
        ethanolRowsPdf,
      );
    }

    if (pumpRows.length) {
      drawTableSection(
        "Perfume pumps",
        ["Pump", "Spec", "Qty", "Line total"],
        pumpRows,
      );
    }

    if (capRows.length) {
      drawTableSection(
        "Perfume caps",
        ["Cap", "Spec", "Qty", "Line total"],
        capRows,
      );
    }

    // Summary box: Scents subtotal, Other materials, Subtotal, Total (incl. VAT)
    const scentsSubtotalPdf = selectedProformaLines.reduce(
      (sum: number, line: any) =>
        sum + (Number(line.row_total ?? 0) || 0),
      0,
    );
    const extrasSubtotalPdf = selectedProformaExtras.reduce(
      (sum: number, e) => sum + (Number(e.line_total ?? 0) || 0),
      0,
    );
    const subtotalPdf = scentsSubtotalPdf + extrasSubtotalPdf;
    const totalInclVat =
      Number(selectedProforma.total ?? subtotalPdf) || subtotalPdf;

    const boxWidth = 70;
    const boxHeight = 4 * lineHeight + 12;
    const boxX = pageWidth - margin - boxWidth;
    const bottomMargin = 20;
    let boxY = pageHeight - bottomMargin - boxHeight;

    if (contentY + 10 > boxY) {
      doc.addPage();
      contentY = 30;
      boxY = pageHeight - bottomMargin - boxHeight;
    }

    doc.setDrawColor(200, 170, 90);
    doc.rect(boxX, boxY, boxWidth, boxHeight);

    let summaryY = boxY + 8;
    const addSummaryLine = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(label, boxX + 3, summaryY);
      doc.text(value, boxX + boxWidth - 3, summaryY, {
        align: "right",
      });
      summaryY += lineHeight;
    };

    addSummaryLine("Scents subtotal", `R${scentsSubtotalPdf.toFixed(2)}`);
    addSummaryLine(
      "Other materials",
      `R${extrasSubtotalPdf.toFixed(2)}`,
    );
    addSummaryLine("Subtotal", `R${subtotalPdf.toFixed(2)}`);
    addSummaryLine("Total (incl. VAT)", `R${totalInclVat.toFixed(2)}`, true);

    doc.save(`purchase-history-${selectedProforma.id}.pdf`);
  };

  const handleDownloadProformaPdf = async (
    proforma: ScentProforma,
    lines: any[],
    orientation: "landscape" | "portrait" = "landscape",
  ) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: orientation === "portrait" ? "portrait" : "landscape",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });

    const logoImg = await loadImage("/DUMI ESSENCE logo.png");

    // Header band
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dumi Essence", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text("Fragrance & packaging solutions", margin, 26);

    if (logoImg) {
      const logoHeight = 18;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      const logoX = (pageWidth - logoWidth) / 2;
      const logoY = 11;
      doc.addImage(logoImg, "PNG", logoX, logoY, logoWidth, logoHeight);
    }

    const infoX = pageWidth - margin;
    let yInfo = 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    ["652 Hashe Street", "Dobsonville", "1863"].forEach((line) => {
      doc.text(line, infoX, yInfo, { align: "right" });
      yInfo += 4;
    });
    yInfo += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Contacts", infoX, yInfo, { align: "right" });
    yInfo += 4;
    doc.setFont("helvetica", "normal");
    doc.text("info@dumiessence.co.za", infoX, yInfo, { align: "right" });
    yInfo += 4;
    doc.text("072 849 5559", infoX, yInfo, { align: "right" });

    // Divider
    doc.setDrawColor(200, 170, 90);
    doc.setLineWidth(0.6);
    doc.line(margin, 45, pageWidth - margin, 45);

    // Title + meta
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Fragrance Purchase Pro-Forma", margin, 58);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Created: ${new Date(proforma.created_at).toLocaleString()}`,
      margin,
      64,
    );

    // Table layout
    const tableTop = 72;
    const rowH = 7;
    const col = {
      brand: 32,
      item: 78,
      q1: 20,
      q5: 20,
      q2: 20,
      qh: 20,
      total: 27,
    };
    const maxTableWidth =
      col.brand + col.item + col.q1 + col.q5 + col.q2 + col.qh + col.total;

    // If we ever change column widths, keep it within the printable area
    const printableWidth = pageWidth - margin * 2;
    const scale = maxTableWidth > printableWidth ? printableWidth / maxTableWidth : 1;

    const w = {
      brand: col.brand * scale,
      item: col.item * scale,
      q1: col.q1 * scale,
      q5: col.q5 * scale,
      q2: col.q2 * scale,
      qh: col.qh * scale,
      total: col.total * scale,
    };

    const drawHeader = (y: number) => {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, printableWidth, rowH, "F");
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, y, printableWidth, rowH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);

      let x = margin + 2;
      doc.text("Brand", x, y + 5);
      x += w.brand;
      doc.text("Item", x + 2, y + 5);
      x += w.item;
      doc.text("Qty 1kg", x + w.q1 - 2, y + 5, { align: "right" });
      x += w.q1;
      doc.text("Qty 500g", x + w.q5 - 2, y + 5, { align: "right" });
      x += w.q5;
      doc.text("Qty 200g", x + w.q2 - 2, y + 5, { align: "right" });
      x += w.q2;
      doc.text("Qty 100g", x + w.qh - 2, y + 5, { align: "right" });
      x += w.qh;
      doc.text("Row total", x + w.total - 2, y + 5, { align: "right" });
    };

    const ellipsize = (text: string, maxWidth: number) => {
      if (!text) return "";
      if (doc.getTextWidth(text) <= maxWidth) return text;
      let t = text;
      while (t.length > 0 && doc.getTextWidth(`${t}…`) > maxWidth) {
        t = t.slice(0, -1);
      }
      return `${t}…`;
    };

    let y = tableTop;
    drawHeader(y);
    y += rowH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);

    lines.forEach((line, idx) => {
      if (y + rowH + 30 > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawHeader(y);
        y += rowH;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y, printableWidth, rowH, "F");
      }

      const brand = line.scent_products?.brand ?? "—";
      const item = line.scent_products?.item ?? "—";
      const qty1 = Number(line.qty_1kg ?? 0) || 0;
      const qty5 = Number(line.qty_500g ?? 0) || 0;
      const qty2 = Number(line.qty_200g ?? 0) || 0;
      const qtyh = Number(line.qty_100g ?? 0) || 0;
      const rowTotal = Number(line.row_total ?? 0) || 0;

      let x = margin + 2;
      doc.text(ellipsize(String(brand), w.brand - 4), x, y + 5);
      x += w.brand;
      doc.text(ellipsize(String(item), w.item - 4), x + 2, y + 5);
      x += w.item;
      doc.text(String(qty1 || ""), x + w.q1 - 2, y + 5, { align: "right" });
      x += w.q1;
      doc.text(String(qty5 || ""), x + w.q5 - 2, y + 5, { align: "right" });
      x += w.q5;
      doc.text(String(qty2 || ""), x + w.q2 - 2, y + 5, { align: "right" });
      x += w.q2;
      doc.text(String(qtyh || ""), x + w.qh - 2, y + 5, { align: "right" });
      x += w.qh;
      doc.text(`R${rowTotal.toFixed(2)}`, x + w.total - 2, y + 5, {
        align: "right",
      });

      y += rowH;
    });

    // Totals block
    const totalsY = Math.min(y + 10, pageHeight - margin - 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`Subtotal: R${proforma.subtotal.toFixed(2)}`, infoX, totalsY, {
      align: "right",
    });
    doc.text(`VAT (15%): R${proforma.vat.toFixed(2)}`, infoX, totalsY + 6, {
      align: "right",
    });
    doc.text(`Total: R${proforma.total.toFixed(2)}`, infoX, totalsY + 12, {
      align: "right",
    });

    doc.save(`proforma-${proforma.id}.pdf`);
  };

  const saveBottleProductsMutation = useMutation({
    mutationFn: async (
      rows: {
        id?: string;
        name: string;
        ml: string;
        code: string;
        colour: string;
        shape: string;
        price: string;
      }[],
    ) => {
      const parseNumber = (value: string) => {
        if (!value) return null;
        const cleaned = value
          .replace(/R/gi, "")
          .replace(/\s/g, "")
          .replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      const payload = rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          ml: parseNumber(r.ml),
          code: r.code || null,
          colour: r.colour || null,
          shape: r.shape || null,
          price: parseNumber(r.price),
        }));

      if (!payload.length) return;
      return fragranceApi.upsertBottleProducts(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bottleProducts"] });
      toast.success("Fragrance bottle products saved");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save fragrance bottle products");
    },
  });

  const savePumpProductsMutation = useMutation({
    mutationFn: async (
      rows: {
        id?: string;
        name: string;
        ml: string;
        code: string;
        colour: string;
        price: string;
      }[],
    ) => {
      const parseNumber = (value: string) => {
        if (!value) return null;
        const cleaned = value
          .replace(/R/gi, "")
          .replace(/\s/g, "")
          .replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      const payload = rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          ml: parseNumber(r.ml),
          code: r.code || null,
          colour: r.colour || null,
          price: parseNumber(r.price),
        }));

      if (!payload.length) return;
      return fragranceApi.upsertPumpProducts(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pumpProducts"] });
      toast.success("Perfume pump products saved");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save perfume pump products");
    },
  });

  const saveCapProductsMutation = useMutation({
    mutationFn: async (
      rows: {
        id?: string;
        name: string;
        ml: string;
        code: string;
        colour: string;
        price: string;
      }[],
    ) => {
      const parseNumber = (value: string) => {
        if (!value) return null;
        const cleaned = value
          .replace(/R/gi, "")
          .replace(/\s/g, "")
          .replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      const payload = rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          ml: parseNumber(r.ml),
          code: r.code || null,
          colour: r.colour || null,
          price: parseNumber(r.price),
        }));

      if (!payload.length) return;
      return fragranceApi.upsertCapProducts(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capProducts"] });
      toast.success("Perfume cap products saved");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save perfume cap products");
    },
  });

  const saveEthanolProductsMutation = useMutation({
    mutationFn: async (
      rows: { id?: string; name: string; liters: string; price: string }[],
    ) => {
      const parseNumber = (value: string) => {
        if (!value) return null;
        const cleaned = value
          .replace(/R/gi, "")
          .replace(/\s/g, "")
          .replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      const payload = rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          liters: parseNumber(r.liters),
          price: parseNumber(r.price),
        }));

      if (!payload.length) return;
      return fragranceApi.insertEthanolProducts(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ethanolProducts"] });
      toast.success("Scentech Ethanol products saved");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save Scentech Ethanol products");
    },
  });

  const deleteScentProductMutation = useMutation({
    mutationFn: (id: string) => fragranceApi.deleteScentProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scentProducts"] });
      toast.success("Scent product deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete scent product");
    },
  });

  const deleteEthanolProductMutation = useMutation({
    mutationFn: (id: string) => fragranceApi.deleteEthanolProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ethanolProducts"] });
      toast.success("Ethanol product deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete ethanol product");
    },
  });

  const handleDownloadPdf = async (orientation: "portrait" | "landscape" = "landscape") => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: orientation === "landscape" ? "landscape" : "portrait",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const lineHeight = 6;

    const renderDocument = (logoImg?: HTMLImageElement) => {
      // Header background band
      doc.setFillColor(20, 20, 20);
      doc.rect(0, 0, pageWidth, 40, "F");

      // Left-hand wording: brand + tagline (original layout)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("Dumi Essence", margin, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(220, 220, 220);
      doc.text("Fragrance & packaging solutions", margin, 26);

      // Centered logo on letterhead (no text changes)
      if (logoImg) {
        const logoHeight = 18;
        const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
        const logoX = (pageWidth - logoWidth) / 2;
        const logoY = 11;
        doc.addImage(logoImg, "PNG", logoX, logoY, logoWidth, logoHeight);
      }

      // Address and contacts on the right
      const infoX = pageWidth - margin;
      let y = 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const addressLines = ["652 Hashe Street", "Dobsonville", "1863"];
      addressLines.forEach((line) => {
        doc.text(line, infoX, y, { align: "right" });
        y += 4;
      });

      y += 2;
      doc.setFont("helvetica", "bold");
      doc.text("Contacts", infoX, y, { align: "right" });
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.text("info@dumiessence.co.za", infoX, y, { align: "right" });
      y += 4;
      doc.text("072 849 5559", infoX, y, { align: "right" });

        // Separator line under header
        doc.setDrawColor(200, 170, 90);
        doc.setLineWidth(0.6);
        doc.line(margin, 45, pageWidth - margin, 45);

        // Document title and meta
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Oils & Containers Purchase List", margin, 58);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const today = new Date().toISOString().slice(0, 10);
        doc.text(`Generated: ${today}`, margin, 64);

      // Start content area below header
      let contentY = 80;

      const ensureSpace = (neededHeight: number) => {
        const bottomMargin = pageHeight - 20;
        if (contentY + neededHeight > bottomMargin) {
          doc.addPage();
          contentY = 30;
        }
      };

      // Table layout (Excel-style)
      const tableX = margin;
      const tableWidth = pageWidth - margin * 2;
      const col1Width = tableWidth * 0.4;
      const col2Width = tableWidth * 0.3;
      const col3Width = tableWidth * 0.15;
      const col4Width = tableWidth * 0.15;
      const colX1 = tableX;
      const colX2 = tableX + col1Width;
      const colX3 = colX2 + col2Width;
      const colX4 = colX3 + col3Width;
      const rowHeight = 5;

      const drawTableSection = (
        title: string,
        headers: [string, string, string, string],
        rows: { c1: string; c2: string; c3: string; c4: string }[],
      ) => {
        // Section heading
        ensureSpace(rowHeight * 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(title, tableX, contentY);
        contentY += rowHeight;

        // If no rows, show simple note and skip table/grid
        if (rows.length === 0) {
          ensureSpace(rowHeight);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(130, 130, 130);
          doc.text("No items captured.", tableX, contentY + 3);
          contentY += rowHeight + 3;
          contentY += 2;
          return;
        }

        // Header row
        ensureSpace(rowHeight + 2);
        let yTop = contentY;
        let yText = yTop + 3.5;
        doc.setDrawColor(200, 170, 90);
        doc.setFillColor(245, 245, 245);
        doc.rect(tableX, yTop, tableWidth, rowHeight, "F");
        doc.line(colX2, yTop, colX2, yTop + rowHeight);
        doc.line(colX3, yTop, colX3, yTop + rowHeight);
        doc.line(colX4, yTop, colX4, yTop + rowHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(40, 40, 40);
        doc.text(headers[0], colX1 + 2, yText);
        doc.text(headers[1], colX2 + 2, yText);
        doc.text(headers[2], colX3 + 2, yText);
        doc.text(headers[3], colX4 + col4Width - 2, yText, { align: "right" });

        contentY += rowHeight;

        // Data rows (only non-empty rows passed in)
        rows.forEach((row) => {
          ensureSpace(rowHeight + 2);
          yTop = contentY;
          yText = yTop + 3.5;
          doc.setDrawColor(220, 220, 220);
          doc.rect(tableX, yTop, tableWidth, rowHeight);
          doc.line(colX2, yTop, colX2, yTop + rowHeight);
          doc.line(colX3, yTop, colX3, yTop + rowHeight);
          doc.line(colX4, yTop, colX4, yTop + rowHeight);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
          doc.setTextColor(40, 40, 40);
          doc.text(row.c1, colX1 + 2, yText);
          if (row.c2) doc.text(row.c2, colX2 + 2, yText);
          if (row.c3) doc.text(row.c3, colX3 + 2, yText);
          if (row.c4)
            doc.text(row.c4, colX4 + col4Width - 2, yText, { align: "right" });

          contentY += rowHeight;
        });

        contentY += 3;
      };

      const toNumber = (value: string) => {
        if (!value) return 0;
        const cleaned = value.replace(/\s/g, "").replace(",", ".");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : 0;
      };

      // 1) Scents (Pro-Forma)
      const scentRows = proFormaRows
        .map((pfRow) => {
          const base =
            pfRow.productIndex !== null ? scentProducts[pfRow.productIndex] : undefined;
          if (!base) return null;

          const qty1 = toNumber(pfRow.qty1kg);
          const qty5 = toNumber(pfRow.qty500g);
          const qty2 = toNumber(pfRow.qty200g);
          const qty1h = toNumber(pfRow.qty100g);
          if (!qty1 && !qty5 && !qty2 && !qty1h) return null;

          const rowTotal =
            amountValue(base.price_1kg?.toString() ?? "", pfRow.qty1kg) +
            amountValue(base.price_500g?.toString() ?? "", pfRow.qty500g) +
            amountValue(base.price_200g?.toString() ?? "", pfRow.qty200g) +
            amountValue(base.price_100g?.toString() ?? "", pfRow.qty100g);

          const sizeBits: string[] = [];
          if (qty1) sizeBits.push(`${qty1} × 1kg`);
          if (qty5) sizeBits.push(`${qty5} × 500g`);
          if (qty2) sizeBits.push(`${qty2} × 200g`);
          if (qty1h) sizeBits.push(`${qty1h} × 100g`);

          const inspiredBits: string[] = [];
          if (base.inspired_by) inspiredBits.push(base.inspired_by);
          if (base.designer) inspiredBits.push(base.designer);

          return {
            c1: `${base.brand || "Dumi Essence"} – ${base.item}`,
            c2: inspiredBits.join(" / "),
            c3: sizeBits.join(", "),
            c4: `R${rowTotal.toFixed(2)}`,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      drawTableSection(
        "Scents (Pro-Forma)",
        ["Product", "Inspired / Designer", "Size & qty", "Row total"],
        scentRows,
      );

      // 2) Bottles
      const bottleRows = bottles
        .map((row) => {
          const totalAmount = amountValue(row.price, row.qty);
          if (!row.name && !totalAmount) return null;
          const specBits: string[] = [];
          if (row.ml) specBits.push(`${row.ml}ml`);
          if (row.code) specBits.push(`Code: ${row.code}`);
          if (row.colour) specBits.push(row.colour);
          if (row.shape) specBits.push(row.shape);
          return {
            c1: row.name || "Bottle",
            c2: specBits.join(" · "),
            c3: row.qty ? `${row.qty}` : "",
            c4: totalAmount ? `R${totalAmount.toFixed(2)}` : "",
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      drawTableSection("Fragrance bottles", ["Bottle", "Spec", "Qty", "Line total"], bottleRows);

      // 3) Print fees
      const printRows = printFees
        .map((row) => {
          const totalAmount = amountValue(row.price, row.qty);
          if (!row.name && !totalAmount) return null;
          const specBits: string[] = [];
          if (row.colour) specBits.push(row.colour);
          if (row.type) specBits.push(row.type);
          return {
            c1: row.name || "Print fee",
            c2: specBits.join(" · "),
            c3: row.qty ? `${row.qty}` : "",
            c4: totalAmount ? `R${totalAmount.toFixed(2)}` : "",
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      drawTableSection(
        "Print fees",
        ["Description", "Spec", "Qty", "Line total"],
        printRows,
      );

      // 4) Scentech Ethanol
      const ethanolPdfRows = ethanolRows
        .map((row) => {
          const totalAmount = amountValue(row.price, row.qty);
          if (!row.name && !totalAmount) return null;
          const specBits: string[] = [];
          if (row.liters) specBits.push(`${row.liters}L`);
          return {
            c1: row.name || "Ethanol",
            c2: specBits.join(" · "),
            c3: row.qty ? `${row.qty}` : "",
            c4: totalAmount ? `R${totalAmount.toFixed(2)}` : "",
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      drawTableSection(
        "Scentech Ethanol",
        ["Name", "Liters", "Qty", "Line total"],
        ethanolPdfRows,
      );

      // 5) Pumps
      const pumpRows = pumps
        .map((row) => {
          const totalAmount = amountValue(row.price, row.qty);
          if (!row.name && !totalAmount) return null;
          const specBits: string[] = [];
          if (row.ml) specBits.push(`${row.ml}ml`);
          if (row.code) specBits.push(`Code: ${row.code}`);
          if (row.colour) specBits.push(row.colour);
          return {
            c1: row.name || "Pump",
            c2: specBits.join(" · "),
            c3: row.qty ? `${row.qty}` : "",
            c4: totalAmount ? `R${totalAmount.toFixed(2)}` : "",
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      drawTableSection(
        "Perfume pumps",
        ["Pump", "Spec", "Qty", "Line total"],
        pumpRows,
      );

      // 6) Caps
      const capRows = caps
        .map((row) => {
          const totalAmount = amountValue(row.price, row.qty);
          if (!row.name && !totalAmount) return null;
          const specBits: string[] = [];
          if (row.ml) specBits.push(`${row.ml}ml`);
          if (row.code) specBits.push(`Code: ${row.code}`);
          if (row.colour) specBits.push(row.colour);
          return {
            c1: row.name || "Cap",
            c2: specBits.join(" · "),
            c3: row.qty ? `${row.qty}` : "",
            c4: totalAmount ? `R${totalAmount.toFixed(2)}` : "",
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      drawTableSection("Perfume caps", ["Cap", "Spec", "Qty", "Line total"], capRows);

      // Summary box with current totals at bottom-right of last page
      const boxWidth = 80;
      const boxHeight = lineHeight * 4 + 6;
      const boxX = pageWidth - margin - boxWidth;
      const bottomMargin = 20;
      let boxY = pageHeight - bottomMargin - boxHeight;

      if (contentY > boxY - 10) {
        // Not enough space on this page; move to new page
        doc.addPage();
        contentY = 30;
        boxY = pageHeight - bottomMargin - boxHeight;
      }

      doc.setDrawColor(200, 170, 90);
      doc.rect(boxX, boxY, boxWidth, boxHeight);

      let summaryY = boxY + 8;
      const addSummaryLine = (label: string, value: string, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.text(label, boxX + 3, summaryY);
        doc.text(value, boxX + boxWidth - 3, summaryY, { align: "right" });
        summaryY += lineHeight;
      };

      addSummaryLine("Scents subtotal", `R${scentsSubtotal.toFixed(2)}`);
      addSummaryLine(
        "Other materials",
        `R${(bottlesSubtotal + pumpsSubtotal + capsSubtotal + printFeesSubtotal).toFixed(2)}`,
      );
      addSummaryLine("Subtotal", `R${subtotal.toFixed(2)}`);
      addSummaryLine("Total (incl. VAT)", `R${total.toFixed(2)}`, true);

      doc.save("dumi-essence-oils-list.pdf");
    };

    let rendered = false;
    const safeRender = (logoImg?: HTMLImageElement) => {
      if (rendered) return;
      rendered = true;
      renderDocument(logoImg);
    };

    const img = new Image();
    img.src = "/DUMI ESSENCE logo.png";
    img.onload = () => safeRender(img);
    img.onerror = () => safeRender(undefined);

    // Fallback in case onload/onerror never fires (e.g. caching quirks)
    setTimeout(() => safeRender(undefined), 1500);
  };

  return (
    <DashboardLayout>
      <div className="sourcing-workbench">
      <PageHero
        eyebrow="DE Orders"
        title="DE orders with more ceremony and less spreadsheet fatigue."
        description="Build pro-formas, curate listed scents, and manage bottles, pumps, caps, ethanol, and sourcing procurement for DE orders in a single premium workbench."
        actions={
          <>
            {activeTab === "pro-forma" && (
              <>
                <Button variant="outline" onClick={() => handleDownloadPdf("portrait")}>
                  <Download className="h-4 w-4" />
                  PDF portrait
                </Button>
                <Button variant="outline" onClick={() => handleDownloadPdf("landscape")}>
                  <Download className="h-4 w-4" />
                  PDF landscape
                </Button>
              </>
            )}
            {activeTab === "proformas" && (
              <>
                <Button variant="outline" onClick={() => handleDownloadSelectedHistoryPdf("portrait")}>
                  <Download className="h-4 w-4" />
                  Export portrait
                </Button>
                <Button variant="outline" onClick={() => handleDownloadSelectedHistoryPdf("landscape")}>
                  <Download className="h-4 w-4" />
                  Export landscape
                </Button>
              </>
            )}
          </>
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="luxury-note">Listed scents</p>
              <p className="mt-2 text-3xl font-display font-semibold text-foreground">{scentProducts.length}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="luxury-note">Saved pro-formas</p>
              <p className="mt-2 text-3xl font-display font-semibold text-foreground">{scentProformas.length}</p>
            </div>
          </div>
        }
      />

      <div className="mb-6">
        <nav className="segmented-tabs text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`segmented-tab ${
              activeTab === "dashboard"
                ? "segmented-tab-active"
                : ""
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pro-forma")}
            className={`segmented-tab ${
              activeTab === "pro-forma"
                ? "segmented-tab-active"
                : ""
            }`}
          >
            Pro-Forma
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`segmented-tab ${
              activeTab === "products"
                ? "segmented-tab-active"
                : ""
            }`}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("listed")}
            className={`segmented-tab ${
              activeTab === "listed"
                ? "segmented-tab-active"
                : ""
            }`}
          >
            Listed Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("proformas")}
            className={`segmented-tab ${
              activeTab === "proformas"
                ? "segmented-tab-active"
                : ""
            }`}
            >
            Order history
          </button>
        </nav>
      </div>

      {activeTab === "dashboard" ? (
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="rounded-xl bg-primary/10 p-3">
              <LayoutGrid className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">DE Orders Overview</h2>
              <p className="text-sm text-muted-foreground">Quick access to your sourcing workbench</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <button
              type="button"
              onClick={() => setActiveTab("pro-forma")}
              className="rounded-2xl border border-border/60 bg-background/40 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <p className="luxury-note mb-1">Pro-Forma</p>
              <p className="text-2xl font-display font-semibold text-foreground">Build</p>
              <p className="text-xs text-muted-foreground mt-1">Create new pro-formas</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("listed")}
              className="rounded-2xl border border-border/60 bg-background/40 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <p className="luxury-note mb-1">Listed Scents</p>
              <p className="text-2xl font-display font-semibold text-foreground">{scentProducts.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Curated products</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("proformas")}
              className="rounded-2xl border border-border/60 bg-background/40 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <p className="luxury-note mb-1">Saved Pro-Formas</p>
              <p className="text-2xl font-display font-semibold text-foreground">{scentProformas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Order history</p>
            </button>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
              <p className="luxury-note mb-1">Bottles</p>
              <p className="text-2xl font-display font-semibold text-foreground">{bottleProducts.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
              <p className="luxury-note mb-1">Pumps & Caps</p>
              <p className="text-2xl font-display font-semibold text-foreground">{pumpProducts.length + capProducts.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Packaging</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
              <p className="luxury-note mb-1">Ethanol</p>
              <p className="text-2xl font-display font-semibold text-foreground">{ethanolProducts.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Products</p>
            </div>
          </div>
          <div className="pt-4 border-t border-border/60">
            <p className="text-sm text-muted-foreground">
              Use the tabs above to build pro-formas, manage products, curate listed scents, or view order history.
            </p>
          </div>
        </div>
      ) : activeTab === "pro-forma" ? (
        <>
      <div className="glass-card overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Scent Pro-Forma
            </h2>
            <p className="text-xs text-muted-foreground">
              Build a pro-forma from products listed under the Listed Products tab.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              Listed products: {scentProducts.length}
            </span>
            <input
              type="text"
              value={scentSearch}
              onChange={(e) => setScentSearch(e.target.value)}
              placeholder="Search scents…"
              className="hidden md:block h-8 w-44 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-[11px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={addProFormaRow}
              disabled={scentProducts.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </button>
          </div>
        </div>

        <div className="max-h-[480px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground border-b border-border/70 w-10">
                  #
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Dumi Essence
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Item
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Inspired By
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Designer
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Type
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price 1kg
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty 1kg
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price 500g
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty 500g
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price 200g
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty 200g
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price 100g
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty 100g
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Row total
                </th>
              </tr>
            </thead>
            <tbody>
              {proFormaRows.map((pfRow, index) => {
                const base =
                  pfRow.productIndex !== null
                    ? scentProducts[pfRow.productIndex]
                    : undefined;
                const rowTotal = base
                  ? amountValue(base.price_1kg?.toString() ?? "", pfRow.qty1kg) +
                    amountValue(base.price_500g?.toString() ?? "", pfRow.qty500g) +
                    amountValue(base.price_200g?.toString() ?? "", pfRow.qty200g) +
                    amountValue(base.price_100g?.toString() ?? "", pfRow.qty100g)
                  : 0;

                return (
                  <tr
                    key={pfRow.id}
                    className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                  >
                  <td className="px-3 py-2 border-b border-border/40 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={
                        pfRow.productIndex !== null ? String(pfRow.productIndex) : ""
                      }
                      onChange={(e) =>
                        updateProFormaRow(
                          pfRow.id,
                          "productIndex",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Select product…</option>
                      {(() => {
                        const seenKeys = new Set<string>();
                        const term = scentSearch.trim().toLowerCase();
                        const matchesFilter = (p: ScentProduct) => {
                          if (!term) return true;
                          const haystack = [
                            p.brand,
                            p.item,
                            p.inspired_by,
                            p.designer,
                            p.scent_type,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();
                          return haystack.includes(term);
                        };
                        return scentProducts.map((p, i) => {
                          const key = `${(p.brand || "Dumi Essence")
                            .trim()
                            .toLowerCase()}|${p.item.trim().toLowerCase()}`;
                          if (seenKeys.has(key)) return null;
                          if (!matchesFilter(p)) return null;
                          seenKeys.add(key);
                          return (
                            <option key={p.id} value={i}>
                          {p.brand} – {p.item}
                        </option>
                          );
                        });
                      })()}
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
                    {base?.item ?? "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
                    {base?.inspired_by ?? "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
                    {base?.designer ?? "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
                    {base?.scent_type ?? "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-xs text-muted-foreground">
                    {base?.price_1kg != null ? base.price_1kg.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={pfRow.qty1kg}
                      onChange={(e) =>
                        updateProFormaRow(pfRow.id, "qty1kg", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-xs text-muted-foreground">
                    {base?.price_500g != null ? base.price_500g.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={pfRow.qty500g}
                      onChange={(e) =>
                        updateProFormaRow(pfRow.id, "qty500g", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-xs text-muted-foreground">
                    {base?.price_200g != null ? base.price_200g.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={pfRow.qty200g}
                      onChange={(e) =>
                        updateProFormaRow(pfRow.id, "qty200g", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-xs text-muted-foreground">
                    {base?.price_100g != null ? base.price_100g.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={pfRow.qty100g}
                      onChange={(e) =>
                        updateProFormaRow(pfRow.id, "qty100g", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-muted-foreground">
                    {rowTotal ? rowTotal.toFixed(2) : ""}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card overflow-x-auto mt-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Fragrance bottles
            </h2>
          </div>
          <button
            type="button"
            onClick={addBottleRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add bottle
          </button>
        </div>

        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground border-b border-border/70 w-10">
                  #
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Bottle name
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  ml
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Code
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Colour
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Shape
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Total amount
                </th>
              </tr>
            </thead>
            <tbody>
              {bottles.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                >
                  <td className="px-3 py-2 border-b border-border/40 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={row.id ?? ""}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const product = bottleProducts.find((p) => p.id === selectedId);
                        if (!product) {
                          updateBottle(index, "name", "");
                          updateBottle(index, "ml", "");
                          updateBottle(index, "code", "");
                          updateBottle(index, "colour", "");
                          updateBottle(index, "shape", "");
                          updateBottle(index, "price", "");
                          return;
                        }
                        setBottles((prev) =>
                          prev.map((b, i) =>
                            i === index
                              ? {
                                  ...b,
                                  id: product.id,
                                  name: product.name,
                                  ml: product.ml != null ? String(product.ml) : "",
                                  code: product.code ?? "",
                                  colour: product.colour ?? "",
                                  shape: product.shape ?? "",
                                  price: product.price != null ? String(product.price) : "",
                                }
                              : b,
                          ),
                        );
                      }}
                    >
                      <option value="">Select bottle…</option>
                      {bottleProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="ml"
                      value={row.ml}
                      onChange={(e) =>
                        updateBottle(index, "ml", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Code"
                      value={row.code}
                      onChange={(e) =>
                        updateBottle(index, "code", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Colour"
                      value={row.colour}
                      onChange={(e) =>
                        updateBottle(index, "colour", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Shape"
                      value={row.shape}
                      onChange={(e) =>
                        updateBottle(index, "shape", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) =>
                        updateBottle(index, "price", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) =>
                        updateBottle(index, "qty", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-muted-foreground">
                    {calcAmount(row.price, row.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card overflow-x-auto mt-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Scentech Ethanol
            </h2>
          </div>
          <button
            type="button"
            onClick={addEthanolRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add ethanol
          </button>
        </div>

        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Name
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Liters
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Total amount
                </th>
              </tr>
            </thead>
            <tbody>
              {ethanolRows.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                >
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Name"
                      value={row.name}
                      onChange={(e) => updateEthanol(index, "name", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Liters"
                      value={row.liters}
                      onChange={(e) =>
                        updateEthanol(index, "liters", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) =>
                        updateEthanol(index, "price", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => updateEthanol(index, "qty", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-muted-foreground">
                    {calcAmount(row.price, row.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card overflow-x-auto mt-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Perfume pumps
            </h2>
          </div>
          <button
            type="button"
            onClick={addPumpRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add pump
          </button>
        </div>

        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Pump name
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  ml
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Code
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Colour
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Total amount
                </th>
              </tr>
            </thead>
            <tbody>
              {pumps.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                >
                  <td className="px-3 py-2 border-b border-border/40">
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={row.id ?? ""}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const product = pumpProducts.find((p) => p.id === selectedId);
                        if (!product) {
                          updatePump(index, "name", "");
                          updatePump(index, "ml", "");
                          updatePump(index, "code", "");
                          updatePump(index, "colour", "");
                          updatePump(index, "price", "");
                          return;
                        }
                        setPumps((prev) =>
                          prev.map((p, i) =>
                            i === index
                              ? {
                                  ...p,
                                  id: product.id,
                                  name: product.name,
                                  ml: product.ml != null ? String(product.ml) : "",
                                  code: product.code ?? "",
                                  colour: product.colour ?? "",
                                  price: product.price != null ? String(product.price) : "",
                                }
                              : p,
                          ),
                        );
                      }}
                    >
                      <option value="">Select pump…</option>
                      {pumpProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="ml"
                      value={row.ml}
                      onChange={(e) =>
                        updatePump(index, "ml", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Code"
                      value={row.code}
                      onChange={(e) =>
                        updatePump(index, "code", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Colour"
                      value={row.colour}
                      onChange={(e) =>
                        updatePump(index, "colour", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) =>
                        updatePump(index, "price", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) =>
                        updatePump(index, "qty", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-muted-foreground">
                    {calcAmount(row.price, row.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card overflow-x-auto mt-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Print fee
            </h2>
          </div>
          <button
            type="button"
            onClick={addPrintFeeRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add print fee
          </button>
        </div>

        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Colour
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Type
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Total amount
                </th>
              </tr>
            </thead>
            <tbody>
              {printFees.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                >
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Name"
                      value={row.name}
                      onChange={(e) =>
                        updatePrintFee(index, "name", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Colour"
                      value={row.colour}
                      onChange={(e) =>
                        updatePrintFee(index, "colour", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Type"
                      value={row.type}
                      onChange={(e) =>
                        updatePrintFee(index, "type", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) =>
                        updatePrintFee(index, "price", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) =>
                        updatePrintFee(index, "qty", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-muted-foreground">
                    {calcAmount(row.price, row.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card overflow-x-auto mt-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Perfume caps
            </h2>
          </div>
          <button
            type="button"
            onClick={addCapRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add cap
          </button>
        </div>

        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Cap name
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  ml
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Code
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                  Colour
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Price
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                  Total amount
                </th>
              </tr>
            </thead>
            <tbody>
              {caps.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                >
                  <td className="px-3 py-2 border-b border-border/40">
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={row.id ?? ""}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const product = capProducts.find((p) => p.id === selectedId);
                        if (!product) {
                          updateCap(index, "name", "");
                          updateCap(index, "ml", "");
                          updateCap(index, "code", "");
                          updateCap(index, "colour", "");
                          updateCap(index, "price", "");
                          return;
                        }
                        setCaps((prev) =>
                          prev.map((c, i) =>
                            i === index
                              ? {
                                  ...c,
                                  id: product.id,
                                  name: product.name,
                                  ml: product.ml != null ? String(product.ml) : "",
                                  code: product.code ?? "",
                                  colour: product.colour ?? "",
                                  price: product.price != null ? String(product.price) : "",
                                }
                              : c,
                          ),
                        );
                      }}
                    >
                      <option value="">Select cap…</option>
                      {capProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="ml"
                      value={row.ml}
                      onChange={(e) =>
                        updateCap(index, "ml", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Code"
                      value={row.code}
                      onChange={(e) =>
                        updateCap(index, "code", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                      placeholder="Colour"
                      value={row.colour}
                      onChange={(e) =>
                        updateCap(index, "colour", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) =>
                        updateCap(index, "price", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <input
                      className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) =>
                        updateCap(index, "qty", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-right text-muted-foreground">
                    {calcAmount(row.price, row.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card mt-8 max-w-md ml-auto">
        <div className="px-4 py-3 border-b border-border/60">
          <h2 className="text-sm font-semibold text-foreground">
            Summary
          </h2>
          <p className="text-xs text-muted-foreground">
            Subtotal of all scents, bottles, pumps and caps with VAT @ 15%.
          </p>
        </div>
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground">
              {subtotal ? subtotal.toFixed(2) : "0.00"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">VAT @ 15%</span>
            <span className="font-medium text-foreground">
              {vat ? vat.toFixed(2) : "0.00"}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-foreground">
              {total ? total.toFixed(2) : "0.00"}
            </span>
          </div>
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <button
            type="button"
            onClick={() => createProformaMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!total || createProformaMutation.isPending}
          >
            {createProformaMutation.isPending ? "Creating order…" : "Create order"}
          </button>
        </div>
      </div>
        </>
      ) : activeTab === "products" ? (
        <>
          <div className="glass-card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Scent products
                </h2>
                <p className="text-xs text-muted-foreground">
                  Master list of scents used to build Pro-Forma rows.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer">
                  Import CSV/TXT
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleScentProductsCsv}
                  />
                </label>
                <button
                  type="button"
                  onClick={addProductRow}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add product
                </button>
                <button
                  type="button"
                  onClick={() => saveScentProductsMutation.mutate(productRows)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={saveScentProductsMutation.isPending}
                >
                  {saveScentProductsMutation.isPending ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>

            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Dumi Essence
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Inspired By
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Designer
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Type
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 1kg
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty 1kg
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 500g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty 500g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 200g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty 200g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 100g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty 100g
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          value={row.brand}
                          onChange={(e) =>
                            updateProductCell(index, "brand", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Oil name from supplier"
                          value={row.item}
                          onChange={(e) =>
                            updateProductCell(index, "item", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Inspired by"
                          value={row.inspiredBy}
                          onChange={(e) =>
                            updateProductCell(index, "inspiredBy", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Designer / house"
                          value={row.designer}
                          onChange={(e) =>
                            updateProductCell(index, "designer", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="EDP, oil, diffuser…"
                          value={row.type}
                          onChange={(e) =>
                            updateProductCell(index, "type", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price1kg}
                          onChange={(e) =>
                            updateProductCell(index, "price1kg", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty1kg}
                          onChange={(e) =>
                            updateProductCell(index, "qty1kg", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price500g}
                          onChange={(e) =>
                            updateProductCell(index, "price500g", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty500g}
                          onChange={(e) =>
                            updateProductCell(index, "qty500g", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price200g}
                          onChange={(e) =>
                            updateProductCell(index, "price200g", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty200g}
                          onChange={(e) =>
                            updateProductCell(index, "qty200g", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price100g}
                          onChange={(e) =>
                            updateProductCell(index, "price100g", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty100g}
                          onChange={(e) =>
                            updateProductCell(index, "qty100g", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Listed Scentech Ethanol
                </h2>
                <p className="text-xs text-muted-foreground">
                  Read-only view of Scentech Ethanol products stored in Supabase.
                </p>
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Liters
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ethanolProducts.map((p, index) => (
                    <tr
                      key={p.id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.liters != null ? p.liters : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price != null ? `R${p.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        <button
                          type="button"
                          onClick={() => deleteEthanolProductMutation.mutate(p.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/60 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                          disabled={deleteEthanolProductMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Fragrance bottle products
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer">
                  Import CSV/TXT
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleBottleProductsCsv}
                  />
                </label>
                <button
                  type="button"
                  onClick={addBottleRow}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add bottle
                </button>
                <button
                  type="button"
                  onClick={() => saveBottleProductsMutation.mutate(bottles)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={saveBottleProductsMutation.isPending}
                >
                  {saveBottleProductsMutation.isPending ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Bottle name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      ml
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Colour
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Shape
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bottles.map((row, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Bottle name"
                          value={row.name}
                          onChange={(e) =>
                            updateBottle(index, "name", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="ml"
                          value={row.ml}
                          onChange={(e) => updateBottle(index, "ml", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Code"
                          value={row.code}
                          onChange={(e) =>
                            updateBottle(index, "code", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Colour"
                          value={row.colour}
                          onChange={(e) =>
                            updateBottle(index, "colour", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Shape"
                          value={row.shape}
                          onChange={(e) =>
                            updateBottle(index, "shape", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price}
                          onChange={(e) =>
                            updateBottle(index, "price", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => updateBottle(index, "qty", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Perfume pump products
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer">
                  Import CSV/TXT
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handlePumpProductsCsv}
                  />
                </label>
                <button
                  type="button"
                  onClick={addPumpRow}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add pump
                </button>
                <button
                  type="button"
                  onClick={() => savePumpProductsMutation.mutate(pumps)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={savePumpProductsMutation.isPending}
                >
                  {savePumpProductsMutation.isPending ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Pump name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      ml
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Colour
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pumps.map((row, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Pump name"
                          value={row.name}
                          onChange={(e) => updatePump(index, "name", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="ml"
                          value={row.ml}
                          onChange={(e) => updatePump(index, "ml", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Code"
                          value={row.code}
                          onChange={(e) => updatePump(index, "code", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Colour"
                          value={row.colour}
                          onChange={(e) =>
                            updatePump(index, "colour", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price}
                          onChange={(e) =>
                            updatePump(index, "price", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => updatePump(index, "qty", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Perfume cap products
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer">
                  Import CSV/TXT
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleCapProductsCsv}
                  />
                </label>
                <button
                  type="button"
                  onClick={addCapRow}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add cap
                </button>
                <button
                  type="button"
                  onClick={() => saveCapProductsMutation.mutate(caps)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={saveCapProductsMutation.isPending}
                >
                  {saveCapProductsMutation.isPending ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Cap name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      ml
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Colour
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {caps.map((row, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Cap name"
                          value={row.name}
                          onChange={(e) => updateCap(index, "name", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="ml"
                          value={row.ml}
                          onChange={(e) => updateCap(index, "ml", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Code"
                          value={row.code}
                          onChange={(e) => updateCap(index, "code", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Colour"
                          value={row.colour}
                          onChange={(e) =>
                            updateCap(index, "colour", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price}
                          onChange={(e) => updateCap(index, "price", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => updateCap(index, "qty", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Scentech Ethanol
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addEthanolRow}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add ethanol
                </button>
                <button
                  type="button"
                  onClick={() => saveEthanolProductsMutation.mutate(ethanolRows)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={saveEthanolProductsMutation.isPending}
                >
                  {saveEthanolProductsMutation.isPending ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Liters
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ethanolRows.map((row, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs"
                          placeholder="Name"
                          value={row.name}
                          onChange={(e) =>
                            updateEthanol(index, "name", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Liters"
                          value={row.liters}
                          onChange={(e) =>
                            updateEthanol(index, "liters", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="0.00"
                          value={row.price}
                          onChange={(e) =>
                            updateEthanol(index, "price", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <input
                          className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs text-right"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) =>
                            updateEthanol(index, "qty", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === "listed" ? (
        <>
          <div className="glass-card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Listed scent products
                </h2>
                <p className="text-xs text-muted-foreground">
                  Read-only view of scent products stored in Supabase.
                </p>
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Brand
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Inspired By
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Designer
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Type
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 1kg
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 500g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 200g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price 100g
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scentProducts.map((p, index) => (
                    <tr
                      key={p.id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.brand}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.item}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.inspired_by || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.designer || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.scent_type || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price_1kg != null ? `R${p.price_1kg.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price_500g != null ? `R${p.price_500g.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price_200g != null ? `R${p.price_200g.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price_100g != null ? `R${p.price_100g.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        <button
                          type="button"
                          onClick={() => deleteScentProductMutation.mutate(p.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/60 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                          disabled={deleteScentProductMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Listed fragrance bottle products
                </h2>
                <p className="text-xs text-muted-foreground">
                  Read-only view of fragrance bottle products stored in Supabase.
                </p>
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Bottle name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      ml
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Colour
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Shape
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bottleProducts.map((p, index) => (
                    <tr
                      key={p.id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.ml != null ? p.ml : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.code || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.colour || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.shape || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price != null ? `R${p.price.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Listed perfume pump products
                </h2>
                <p className="text-xs text-muted-foreground">
                  Read-only view of perfume pump products stored in Supabase.
                </p>
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Pump name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      ml
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Colour
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pumpProducts.map((p, index) => (
                    <tr
                      key={p.id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.ml != null ? p.ml : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.code || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.colour || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price != null ? `R${p.price.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-x-auto mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Listed perfume cap products
                </h2>
                <p className="text-xs text-muted-foreground">
                  Read-only view of perfume cap products stored in Supabase.
                </p>
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Cap name
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      ml
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Colour
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {capProducts.map((p, index) => (
                    <tr
                      key={p.id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/40"}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.ml != null ? p.ml : "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.code || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {p.colour || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {p.price != null ? `R${p.price.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="glass-card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Fragrance order history
                </h2>
                <p className="text-xs text-muted-foreground">
                  Previously created fragrance purchase pro-formas.
                </p>
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Supplier
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Reference
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Status
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Subtotal
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      VAT
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Total
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                      Created at
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scentProformas.map((pf, index) => (
                    <tr
                      key={pf.id}
                      className={`${
                        index % 2 === 0 ? "bg-background" : "bg-muted/40"
                      } ${
                        selectedProformaId === pf.id ? "ring-1 ring-primary/60" : ""
                      }`}
                      onClick={() => setSelectedProformaId(pf.id)}
                    >
                      <td className="px-3 py-2 border-b border-border/40">
                        {pf.name}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {pf.customer_name || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {pf.reference || "—"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {pf.status === "approved" ? "Approved" : "Pending"}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {pf.subtotal.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {pf.vat.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right">
                        {pf.total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        {new Date(pf.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProformaId(pf.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (pf.status === "approved") {
                              toast.message("Approved orders cannot be edited.");
                              return;
                            }
                            setSelectedProformaId(pf.id);
                            setEditingProformaId(pf.id);
                            setActiveTab("pro-forma");
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-60"
                          disabled={pf.status === "approved"}
                        >
                          Edit
                        </button>
                        {isSuperAdmin && pf.status !== "approved" && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await fragranceApi.updateProforma(pf.id, {
                                  status: "approved",
                                });
                                queryClient.invalidateQueries({ queryKey: ["scentProformas"] });
                                toast.success("Order approved and marked as complete.");
                              } catch (err: any) {
                                toast.error(err.message || "Failed to approve order");
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                          >
                            Approve &amp; complete
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProformaMutation.mutate(pf.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/60 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                            disabled={deleteProformaMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedProformaId && selectedProforma && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedProformaId(null)}
            />

            <div className="relative w-[min(1100px,95vw)] rounded-lg border border-border bg-background shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Order details
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Pro-forma created on{" "}
                      {new Date(selectedProforma.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supplier: {selectedProforma.customer_name || "ACS Promotions"} · Reference:{" "}
                      {selectedProforma.reference || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isProformaLinesFetching) {
                          toast.message("Loading order lines…");
                          return;
                        }
                        handleDownloadSelectedHistoryPdf("landscape");
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isProformaLinesFetching}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF (Landscape)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isProformaLinesFetching) {
                          toast.message("Loading order lines…");
                          return;
                        }
                        handleDownloadSelectedHistoryPdf("portrait");
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isProformaLinesFetching}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF (Portrait)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProformaId(null)}
                      className="inline-flex items-center rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-md border border-border/60 p-3">
                      <div className="text-muted-foreground">Subtotal</div>
                      <div className="font-semibold text-foreground">
                        R{selectedProforma.subtotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 p-3">
                      <div className="text-muted-foreground">VAT (15%)</div>
                      <div className="font-semibold text-foreground">
                        R{selectedProforma.vat.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 p-3">
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-semibold text-foreground">
                        R{selectedProforma.total.toFixed(2)}
                      </div>
                    </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Supplier</div>
                    <div className="font-semibold text-foreground">
                      {selectedProforma.customer_name || "—"}
                    </div>
                  </div>
                  </div>

                  <div className="rounded-md border border-border/60 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                      <div className="text-xs font-semibold text-foreground">
                        Line items
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isProformaLinesFetching || isProformaExtrasFetching
                          ? "Loading…"
                          : ""}
                      </div>
                    </div>
                    <div className="max-h-[55vh] overflow-auto p-3 space-y-4">
                      {/* Scents (Pro-Forma) */}
                      {selectedProformaLines.some((line: any) => {
                        const q1 = Number(line.qty_1kg ?? 0) || 0;
                        const q5 = Number(line.qty_500g ?? 0) || 0;
                        const q2 = Number(line.qty_200g ?? 0) || 0;
                        const qh = Number(line.qty_100g ?? 0) || 0;
                        const rowTotal = Number(line.row_total ?? 0) || 0;
                        return q1 || q5 || q2 || qh || rowTotal;
                      }) && (
                        <div>
                          <div className="text-xs font-semibold text-foreground mb-2">
                            Scents (Pro-Forma)
                          </div>
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/60 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                                  Product
                                </th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                                  Inspired / Designer
                                </th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                                  Size & qty
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                                  Row total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedProformaLines
                                .map((line: any, index: number) => {
                                  const brand =
                                    line.scent_products?.brand || "Dumi Essence";
                                  const item =
                                    line.scent_products?.item || "—";
                                  const qty1 =
                                    Number(line.qty_1kg ?? 0) || 0;
                                  const qty5 =
                                    Number(line.qty_500g ?? 0) || 0;
                                  const qty2 =
                                    Number(line.qty_200g ?? 0) || 0;
                                  const qtyh =
                                    Number(line.qty_100g ?? 0) || 0;
                                  const rowTotalNum =
                                    Number(line.row_total ?? 0) || 0;

                                  if (!qty1 && !qty5 && !qty2 && !qtyh && !rowTotalNum) {
                                    return null;
                                  }

                                  const sizeBits: string[] = [];
                                  if (qty1) sizeBits.push(`${qty1} × 1kg`);
                                  if (qty5) sizeBits.push(`${qty5} × 500g`);
                                  if (qty2) sizeBits.push(`${qty2} × 200g`);
                                  if (qtyh) sizeBits.push(`${qtyh} × 100g`);

                                  const inspiredBits: string[] = [];
                                  if (line.scent_products?.inspired_by)
                                    inspiredBits.push(
                                      line.scent_products.inspired_by,
                                    );
                                  if (line.scent_products?.designer)
                                    inspiredBits.push(
                                      line.scent_products.designer,
                                    );

                                  return (
                                    <tr
                                      key={line.id}
                                      className={
                                        index % 2 === 0
                                          ? "bg-background"
                                          : "bg-muted/40"
                                      }
                                    >
                                      <td className="px-3 py-2 border-b border-border/40">
                                        {brand} – {item}
                                      </td>
                                      <td className="px-3 py-2 border-b border-border/40">
                                        {inspiredBits.join(" / ") || "—"}
                                      </td>
                                      <td className="px-3 py-2 border-b border-border/40">
                                        {sizeBits.join(", ")}
                                      </td>
                                      <td className="px-3 py-2 border-b border-border/40 text-right">
                                        R{rowTotalNum.toFixed(2)}
                                      </td>
                                    </tr>
                                  );
                                })
                                .filter(Boolean)}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Helper to render extras by kind */}
                      {(["bottle", "print_fee", "ethanol", "pump", "cap"] as const).map(
                        (kind) => {
                          const titleMap: Record<
                            typeof kind,
                            string
                          > = {
                            bottle: "Fragrance bottles",
                            print_fee: "Print fees",
                            ethanol: "Scentech Ethanol",
                            pump: "Perfume pumps",
                            cap: "Perfume caps",
                          };

                          const rows = selectedProformaExtras
                            .filter((e) => e.kind === kind)
                            .filter(
                              (e) =>
                                (e.qty ?? 0) !== 0 ||
                                (e.line_total ?? 0) !== 0,
                            );

                          if (!rows.length) return null;

                          return (
                            <div key={kind}>
                              <div className="text-xs font-semibold text-foreground mb-2">
                                {titleMap[kind]}
                              </div>
                              <table className="min-w-full text-xs">
                                <thead className="bg-muted/60 sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                                      {kind === "bottle"
                                        ? "Bottle"
                                        : kind === "ethanol"
                                        ? "Name"
                                        : kind === "pump"
                                        ? "Pump"
                                        : kind === "cap"
                                        ? "Cap"
                                        : "Description"}
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border/70">
                                      Spec
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                                      Qty
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border/70">
                                      Line total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, index) => (
                                    <tr
                                      key={row.id}
                                      className={
                                        index % 2 === 0
                                          ? "bg-background"
                                          : "bg-muted/40"
                                      }
                                    >
                                      <td className="px-3 py-2 border-b border-border/40">
                                        {row.name}
                                      </td>
                                      <td className="px-3 py-2 border-b border-border/40">
                                        {row.spec || "—"}
                                      </td>
                                      <td className="px-3 py-2 border-b border-border/40 text-right">
                                        {row.qty}
                                      </td>
                                      <td className="px-3 py-2 border-b border-border/40 text-right">
                                        R{(row.line_total ?? 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </DashboardLayout>
  );
};

export default OilsPage;

