import { supabase } from "@/lib/supabase";
import type { MarketingCampaign } from "@/types/database";

export const marketingCampaignsApi = {
  async list(): Promise<MarketingCampaign[]> {
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .order("campaign_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as MarketingCampaign[];
  },

  async upsert(input: {
    id?: string;
    name: string;
    status: MarketingCampaign["status"];
    sent: number;
    open_rate: number | null;
    click_rate: number | null;
    campaign_date: string | null; // YYYY-MM-DD
    revenue_impact: number;
  }): Promise<MarketingCampaign> {
    const payload: Partial<MarketingCampaign> = {
      // Supabase will accept "YYYY-MM-DD" for date columns
      campaign_date: input.campaign_date ?? null,
      open_rate: input.open_rate ?? null,
      click_rate: input.click_rate ?? null,
      revenue_impact: input.revenue_impact,
      name: input.name,
      status: input.status,
      sent: input.sent,
    };

    const query = input.id
      ? supabase
          .from("marketing_campaigns")
          .update(payload)
          .eq("id", input.id)
          .select("*")
          .single()
      : supabase
          .from("marketing_campaigns")
          .insert(payload)
          .select("*")
          .single();

    const { data, error } = await query;
    if (error) throw error;
    return data as MarketingCampaign;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

