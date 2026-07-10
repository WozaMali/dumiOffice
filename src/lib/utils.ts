import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** React Query / fetch cancellations — not a real load failure. */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "AbortError") return true;
  const message = (err.message || "").toLowerCase();
  return message.includes("aborted") || message.includes("abort");
}
