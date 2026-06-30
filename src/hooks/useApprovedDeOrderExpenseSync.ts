import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fragranceApi } from "@/lib/api/fragrance";
import { accountingApi } from "@/lib/api/accounting";
import { syncApprovedDeOrderExpenses } from "@/lib/utils/de-order-expenses";

/** Syncs ledger expenses with approved DE orders from Oils order history. */
export function useApprovedDeOrderExpenseSync(enabled = true) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const { data: proformas = [] } = useQuery({
    queryKey: ["scentProformas"],
    queryFn: fragranceApi.listProformas,
    enabled,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["accountingTransactions"],
    queryFn: accountingApi.listTransactions,
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const result = await syncApprovedDeOrderExpenses(proformas, transactions);
        if (cancelled) return;
        if (result.created || result.removed || result.deduped) {
          await queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
        }
      } catch (err) {
        console.error("Failed syncing approved DE order expenses", err);
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, proformas, transactions, queryClient]);
}
