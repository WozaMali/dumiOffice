import { supabase } from "@/lib/supabase";
import type { Vendor } from "@/types/database";

export const vendorsApi = {
  buildAddress(input: {
    street_address?: string;
    suburb?: string;
    city?: string;
    province?: string;
    country?: string;
    postal_code?: string;
  }): string | null {
    const parts = [
      input.street_address?.trim(),
      input.suburb?.trim(),
      input.city?.trim(),
      input.province?.trim(),
      input.country?.trim(),
      input.postal_code?.trim(),
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  },

  async list(): Promise<Vendor[]> {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as Vendor[];
  },

  async create(input: {
    name: string;
    vat_number?: string;
    company_registration?: string;
    street_address?: string;
    suburb?: string;
    city?: string;
    province?: string;
    country?: string;
    postal_code?: string;
    contact_name?: string;
    contact_phone?: string;
    email?: string;
    notes?: string;
  }): Promise<Vendor> {
    const payload = {
      name: input.name.trim(),
      vat_number: input.vat_number?.trim() || null,
      company_registration: input.company_registration?.trim() || null,
      street_address: input.street_address?.trim() || null,
      suburb: input.suburb?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      country: input.country?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      address: vendorsApi.buildAddress(input),
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const { data, error } = await supabase.from("vendors").insert(payload).select().single();
    if (error) throw error;
    return data as Vendor;
  },

  async update(
    id: string,
    input: {
      name: string;
      vat_number?: string;
      company_registration?: string;
      street_address?: string;
      suburb?: string;
      city?: string;
      province?: string;
      country?: string;
      postal_code?: string;
      contact_name?: string;
      contact_phone?: string;
      email?: string;
      notes?: string;
    },
  ): Promise<Vendor> {
    const payload = {
      name: input.name.trim(),
      vat_number: input.vat_number?.trim() || null,
      company_registration: input.company_registration?.trim() || null,
      street_address: input.street_address?.trim() || null,
      suburb: input.suburb?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      country: input.country?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      address: vendorsApi.buildAddress(input),
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from("vendors")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Vendor;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) throw error;
  },
};

