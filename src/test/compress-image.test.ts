import { describe, expect, it } from "vitest";
import { compressImageForUpload } from "@/lib/utils/compress-image";
import { isPdfUpload } from "@/lib/utils/compress-pdf";

describe("compressImageForUpload", () => {
  it("passes through non-image files unchanged", async () => {
    const pdf = new File(["%PDF-1.4"], "receipt.pdf", { type: "application/pdf" });
    const result = await compressImageForUpload(pdf, "attachment");
    expect(result).toBe(pdf);
  });

  it("passes through GIF unchanged", async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], "anim.gif", {
      type: "image/gif",
    });
    const result = await compressImageForUpload(gif, "product");
    expect(result).toBe(gif);
  });
});

describe("isPdfUpload", () => {
  it("detects pdf by mime and extension", () => {
    expect(
      isPdfUpload(new File(["x"], "a.pdf", { type: "application/pdf" })),
    ).toBe(true);
    expect(isPdfUpload(new File(["x"], "a.PDF", { type: "" }))).toBe(true);
    expect(
      isPdfUpload(new File(["x"], "a.jpg", { type: "image/jpeg" })),
    ).toBe(false);
  });
});
