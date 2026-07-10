import { describe, expect, it } from "vitest";
import {
  bundleUsesTabs,
  totalPickCount,
  validateBundleSelections,
} from "@/lib/utils/bundleSpecials";
import type { BundleSpecialWithSlots } from "@/types/database";

const hisAndHers = {
  id: "1",
  code: "his-and-hers",
  name: "His & Hers",
  bundle_price: 699.99,
  is_active: true,
  sort_order: 0,
  bundle_special_slots: [
    {
      id: "s1",
      bundle_special_id: "1",
      slot_code: "mens",
      tab_label: "Men's",
      collection_code: "mens",
      pick_count: 2,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    },
    {
      id: "s2",
      bundle_special_id: "1",
      slot_code: "womens",
      tab_label: "Women's",
      collection_code: "womens",
      pick_count: 2,
      sort_order: 1,
      created_at: "",
      updated_at: "",
    },
  ],
} as BundleSpecialWithSlots;

describe("bundleSpecials utils", () => {
  it("detects multi-tab bundles", () => {
    expect(bundleUsesTabs(hisAndHers)).toBe(true);
  });

  it("sums pick counts", () => {
    expect(totalPickCount(hisAndHers)).toBe(4);
  });

  it("validates complete selections", () => {
    expect(
      validateBundleSelections(hisAndHers, {
        mens: ["a", "b"],
        womens: ["c", "d"],
      }).ok,
    ).toBe(true);

    const bad = validateBundleSelections(hisAndHers, {
      mens: ["a"],
      womens: ["c", "d"],
    });
    expect(bad.ok).toBe(false);
  });
});
