import { supabase } from "@/lib/supabase";
import type {
  AccountingCategory,
  AccountingCategoryKind,
  AccountingTransaction,
  AccountingTransactionType,
  AccountingAttachment,
} from "@/types/database";

export const accountingApi = {
  async listCategories(): Promise<AccountingCategory[]> {
    const { data, error } = await supabase
      .from("accounting_categories")
      .select<"*", AccountingCategory>("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async createCategory(input: {
    name: string;
    kind: AccountingCategoryKind;
    code?: string;
    description?: string;
  }): Promise<AccountingCategory> {
    const { data, error } = await supabase
      .from("accounting_categories")
      .insert({
        name: input.name,
        kind: input.kind,
        code: input.code,
        description: input.description,
      })
      .select()
      .single();

    if (error) throw error;
    return data as AccountingCategory;
  },

  async listTransactions(): Promise<AccountingTransaction[]> {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .select<"*", AccountingTransaction>("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async updateTransaction(
    id: string,
    updates: Partial<{
      date: string;
      type: AccountingTransactionType;
      category_id: string | null;
      description: string | null;
      amount: number;
      reference: string | null;
      vendor: string | null;
      campaign: string | null;
    }>
  ): Promise<AccountingTransaction> {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as AccountingTransaction;
  },

  async deleteTransaction(id: string): Promise<void> {
    const { error: attErr } = await supabase
      .from("accounting_attachments")
      .delete()
      .eq("transaction_id", id);
    if (attErr) throw attErr;

    const { error } = await supabase
      .from("accounting_transactions")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async createTransaction(input: {
    date: string;
    type: AccountingTransactionType;
    category_id?: string;
    description?: string;
    amount: number;
    currency?: string;
    order_id?: string;
    reference?: string;
    vendor?: string;
    campaign?: string;
    created_by?: string;
  }): Promise<AccountingTransaction> {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .insert({
        date: input.date,
        type: input.type,
        category_id: input.category_id,
        description: input.description,
        amount: input.amount,
        currency: input.currency ?? "ZAR",
        order_id: input.order_id,
        reference: input.reference,
        vendor: input.vendor,
        campaign: input.campaign,
        created_by: input.created_by,
      })
      .select()
      .single();

    if (error) throw error;
    return data as AccountingTransaction;
  },

  async listAttachments(transactionId: string): Promise<AccountingAttachment[]> {
    const { data, error } = await supabase
      .from("accounting_attachments")
      .select<"*", AccountingAttachment>("*")
      .eq("transaction_id", transactionId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async uploadAttachment(params: {
    transactionId: string;
    file: File;
    uploadedBy?: string;
  }): Promise<AccountingAttachment> {
    const { transactionId, file, uploadedBy } = params;

    const bucket = "accounting-files";
    const path = `transactions/${transactionId}/${Date.now()}-${file.name}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (storageError || !storageData) {
      throw storageError || new Error("Failed to upload file");
    }

    const fileUrl = storageData.path;

    const { data, error } = await supabase
      .from("accounting_attachments")
      .insert({
        transaction_id: transactionId,
        file_url: fileUrl,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data as AccountingAttachment;
  },

  async deleteTransactionsInRange(params: {
    dateFrom: string;
    dateTo: string;
  }): Promise<number> {
    const { dateFrom, dateTo } = params;

    const { data: txData, error: txIdsError } = await supabase
      .from("accounting_transactions")
      .select("id")
      .gte("date", dateFrom)
      .lte("date", dateTo);

    if (txIdsError) throw txIdsError;

    const ids = (txData ?? []).map((t) => (t as any).id as string);
    if (ids.length === 0) return 0;

    const { error: attachmentsError } = await supabase
      .from("accounting_attachments")
      .delete()
      .in("transaction_id", ids);
    if (attachmentsError) throw attachmentsError;

    const { error: deleteError } = await supabase
      .from("accounting_transactions")
      .delete()
      .gte("date", dateFrom)
      .lte("date", dateTo);
    if (deleteError) throw deleteError;

    return ids.length;
  },

  async deleteAllTransactions(): Promise<number> {
    const { data: txData, error: txIdsError } = await supabase
      .from("accounting_transactions")
      .select("id");

    if (txIdsError) throw txIdsError;

    const ids = (txData ?? []).map((t) => (t as any).id as string);
    if (ids.length === 0) return 0;

    const { error: attachmentsError } = await supabase
      .from("accounting_attachments")
      .delete()
      .in("transaction_id", ids);
    if (attachmentsError) throw attachmentsError;

    const { error: deleteError } = await supabase
      .from("accounting_transactions")
      .delete();
    if (deleteError) throw deleteError;

    return ids.length;
  },
};

