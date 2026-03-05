import { supabase } from "@/lib/supabase";
import type { Customer, Address } from "@/types/database";

export const customersApi = {
  async list(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("customer_name");

    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getByEmail(email: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("customer_email", email)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async create(customer: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const addressesApi = {
  async listByCustomerId(customerId: string): Promise<Address[]> {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", customerId);

    if (error) throw error;
    return data ?? [];
  },

  async create(address: Partial<Address>): Promise<Address> {
    const { data, error } = await supabase
      .from("addresses")
      .insert(address)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
