import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { frontPopupApi } from "@/lib/api/frontPopup";
import type { FrontPopup } from "@/types/database";

const STORAGE_PREFIX = "dumi:frontPopup:dismissedAt:";

function getDismissedAt(code: string): number | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${code}`);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function setDismissedAt(code: string, ts: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${code}`, String(ts));
  } catch {
    // ignore
  }
}

function shouldShowPopup(popup: FrontPopup): boolean {
  if (!popup.is_active) return false;
  const code = popup.code || "home-entry";
  const dismissDays = Math.max(0, Number(popup.dismiss_days ?? 0));
  const dismissedAt = getDismissedAt(code);
  if (!dismissedAt) return true;
  if (dismissDays === 0) return false;
  const ms = dismissDays * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt >= ms;
}

export default function FrontPopupModal({ code = "home-entry" }: { code?: string }) {
  const { data } = useQuery<FrontPopup | null>({
    queryKey: ["frontPopup", code],
    queryFn: () => frontPopupApi.getByCode(code),
  });

  const [open, setOpen] = useState(false);

  const show = useMemo(() => {
    if (!data) return false;
    return shouldShowPopup(data);
  }, [data]);

  useEffect(() => {
    setOpen(show);
  }, [show]);

  if (!data || !open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-border/60 bg-background/90 shadow-2xl">
        <button
          type="button"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            setDismissedAt(code, Date.now());
            setOpen(false);
          }}
          aria-label="Dismiss popup"
        >
          <X size={16} />
        </button>

        {data.image_url && (
          <div className="h-52 w-full overflow-hidden storefront-media-bg">
            <img src={data.image_url} alt={data.headline ?? "Popup"} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="space-y-3 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Storefront popup
          </p>
          {data.headline && (
            <h3 className="text-xl font-semibold leading-tight text-foreground">
              {data.headline}
            </h3>
          )}
          {data.body && (
            <p className="text-sm leading-7 text-muted-foreground">{data.body}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {data.cta_href && data.cta_label ? (
              <Button asChild>
                <a href={data.cta_href}>{data.cta_label}</a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDismissedAt(code, Date.now());
                setOpen(false);
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

