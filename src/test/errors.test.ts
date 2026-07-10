import { describe, expect, it } from "vitest";
import {
  BUNDLE_SPECIALS_SETUP_HINT,
  isBundleSetupRequired,
  isMissingBundleTables,
} from "@/lib/api/bundleSpecials";
import { isAbortError } from "@/lib/utils";

describe("error helpers", () => {
  it("detects abort errors", () => {
    expect(isAbortError(new DOMException("The lock request is aborted", "AbortError"))).toBe(
      true,
    );
    expect(isAbortError({ name: "AbortError", message: "aborted" })).toBe(true);
    expect(isAbortError(new Error("relation does not exist"))).toBe(false);
  });

  it("detects bundle setup errors from API or wrapped hint", () => {
    expect(
      isMissingBundleTables({
        code: "PGRST205",
        message: "Could not find the table public.bundle_specials in the schema cache",
      }),
    ).toBe(true);
    expect(isBundleSetupRequired(new Error(BUNDLE_SPECIALS_SETUP_HINT))).toBe(true);
    expect(isBundleSetupRequired(new Error("network timeout"))).toBe(false);
  });
});
