import type { ReactNode } from "react";

/**
 * Wraps public storefront routes so shared tokens and utilities remove flat grey rounds
 * (image wells, icon circles, chips) in favour of deep charcoal aligned with the house UI.
 */
export default function StorefrontShell({ children }: { children: ReactNode }) {
  return <div className="storefront-theme min-h-screen bg-background text-foreground">{children}</div>;
}
