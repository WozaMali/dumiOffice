import { supabase } from "@/lib/supabase";
import type {
  ScentProduct,
  ScentProforma,
  ScentProformaLine,
  ScentProformaExtraLine,
  FragranceBottleProduct,
  PerfumePumpProduct,
  PerfumeCapProduct,
  ScentechEthanolProduct,
} from "@/types/database";

export const fragranceApi = {
  // Scent products
  async listScentProducts(): Promise<ScentProduct[]> {
    const { data, error } = await supabase
      .from("scent_products")
      .select("*")
      .order("item");
    if (error) throw error;
    return data ?? [];
  },

  async upsertScentProduct(
    product: Partial<ScentProduct>,
  ): Promise<ScentProduct> {
    const { data, error } = await supabase
      .from("scent_products")
      .upsert(product, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return data as ScentProduct;
  },

  async deleteScentProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from("scent_products")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // Pro-formas
  async createProforma(
    header: Partial<ScentProforma>,
    lines: Omit<ScentProformaLine, "id" | "created_at" | "proforma_id">[],
    extras: Omit<
      ScentProformaExtraLine,
      "id" | "created_at" | "proforma_id"
    >[] = [],
  ): Promise<{
    header: ScentProforma;
    lines: ScentProformaLine[];
    extras: ScentProformaExtraLine[];
  }> {
    const { data: insertedHeader, error: headerError } = await supabase
      .from("scent_proformas")
      .insert(header)
      .select()
      .single();
    if (headerError) throw headerError;

    let insertedLines: ScentProformaLine[] = [];
    if (lines.length) {
      const payload = lines.map((l) => ({
        ...l,
        proforma_id: insertedHeader.id,
      }));

      const { data, error } = await supabase
        .from("scent_proforma_lines")
        .insert(payload)
        .select();

      if (error) throw error;
      insertedLines = (data ?? []) as ScentProformaLine[];
    }

    let insertedExtras: ScentProformaExtraLine[] = [];
    if (extras.length) {
      const extrasPayload = extras.map((e) => ({
        ...e,
        proforma_id: insertedHeader.id,
      }));

      const { data, error } = await supabase
        .from("scent_proforma_extra_lines")
        .insert(extrasPayload)
        .select();

      if (error) throw error;
      insertedExtras = (data ?? []) as ScentProformaExtraLine[];
    }

    return {
      header: insertedHeader as ScentProforma,
      lines: insertedLines,
      extras: insertedExtras,
    };
  },

  async listProformas(): Promise<ScentProforma[]> {
    const { data, error } = await supabase
      .from("scent_proformas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ScentProforma[];
  },

  async deleteProforma(id: string): Promise<void> {
    const { error } = await supabase
      .from("scent_proformas")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async updateProforma(
    id: string,
    patch: Partial<ScentProforma>,
  ): Promise<ScentProforma> {
    const { data, error } = await supabase
      .from("scent_proformas")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as ScentProforma;
  },


  async listProformaLines(proformaId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("scent_proforma_lines")
      .select("*, scent_products ( brand, item, inspired_by, designer )")
      .eq("proforma_id", proformaId)
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },

  async listProformaExtras(proformaId: string): Promise<ScentProformaExtraLine[]> {
    const { data, error } = await supabase
      .from("scent_proforma_extra_lines")
      .select("*")
      .eq("proforma_id", proformaId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as ScentProformaExtraLine[];
  },

  // Packaging master data
  async listBottleProducts(): Promise<FragranceBottleProduct[]> {
    const { data, error } = await supabase
      .from("fragrance_bottle_products")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async upsertBottleProducts(
    products: Partial<FragranceBottleProduct>[],
  ): Promise<void> {
    const { error } = await supabase
      .from("fragrance_bottle_products")
      .insert(products);
    if (error) throw error;
  },

  async listPumpProducts(): Promise<PerfumePumpProduct[]> {
    const { data, error } = await supabase
      .from("perfume_pump_products")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async upsertPumpProducts(
    products: Partial<PerfumePumpProduct>[],
  ): Promise<void> {
    const { error } = await supabase
      .from("perfume_pump_products")
      .insert(products);
    if (error) throw error;
  },

  async listCapProducts(): Promise<PerfumeCapProduct[]> {
    const { data, error } = await supabase
      .from("perfume_cap_products")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async upsertCapProducts(
    products: Partial<PerfumeCapProduct>[],
  ): Promise<void> {
    const { error } = await supabase
      .from("perfume_cap_products")
      .insert(products);
    if (error) throw error;
  },

  async listEthanolProducts(): Promise<ScentechEthanolProduct[]> {
    const { data, error } = await supabase
      .from("scentech_ethanol_products")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as ScentechEthanolProduct[];
  },

  async insertEthanolProducts(
    products: Partial<ScentechEthanolProduct>[],
  ): Promise<void> {
    const { error } = await supabase
      .from("scentech_ethanol_products")
      .insert(products);
    if (error) throw error;
  },

  async deleteEthanolProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from("scentech_ethanol_products")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

