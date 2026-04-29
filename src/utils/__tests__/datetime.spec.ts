import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  centsToYuan,
  formatThousands,
} from "@/utils/datetime";

describe("formatDate", () => {
  it("returns '—' for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(formatDate("")).toBe("—");
  });

  it("formats UTC ISO string to CST YYYY-MM-DD", () => {
    // 2026-04-03T16:00:00Z → 2026-04-04 00:00 CST
    expect(formatDate("2026-04-03T16:00:00Z")).toBe("2026-04-04");
  });

  it("formats a date that does not roll over midnight in CST", () => {
    // 2026-04-03T10:15:22Z → 2026-04-03 18:15 CST
    expect(formatDate("2026-04-03T10:15:22Z")).toBe("2026-04-03");
  });
});

describe("formatDateTime", () => {
  it("returns '—' for null", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("formats UTC ISO string to CST YYYY-MM-DD HH:mm", () => {
    // 2026-04-03T10:15:22Z → 2026-04-03 18:15 CST
    expect(formatDateTime("2026-04-03T10:15:22Z")).toBe("2026-04-03 18:15");
  });

  it("correctly carries over midnight", () => {
    // 2026-04-03T16:00:00Z → 2026-04-04 00:00 CST
    expect(formatDateTime("2026-04-03T16:00:00Z")).toBe("2026-04-04 00:00");
  });
});

describe("centsToYuan", () => {
  it("converts cents to yuan with 2 decimal places", () => {
    expect(centsToYuan(100)).toBe("1.00");
  });

  it("converts zero correctly", () => {
    expect(centsToYuan(0)).toBe("0.00");
  });

  it("applies thousands separator for large amounts", () => {
    // 1234567 cents = 12345.67 yuan → "12,345.67"
    expect(centsToYuan(1234567)).toBe("12,345.67");
  });

  it("handles non-round amounts", () => {
    // 9900 cents = 99.00 yuan
    expect(centsToYuan(9900)).toBe("99.00");
  });
});

describe("formatThousands", () => {
  it("formats with thousands separator", () => {
    expect(formatThousands(12345.67)).toBe("12,345.67");
  });

  it("respects custom decimal places", () => {
    expect(formatThousands(1000, 0)).toBe("1,000");
  });
});
