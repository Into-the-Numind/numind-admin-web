/**
 * Regression test for the free-model pricing label (customer-reported, prod).
 *
 * Bug: on the AI service edit page, a pricing rule that EXISTS but has all
 * cost/sell prices = 0 (a free model — intentionally no charge) was labelled
 * "未配置" (not configured). A rule with all-zero prices is configured; it just
 * doesn't charge. The "no rule at all" case has its own separate template branch
 * ("未找到计费规则"), so this label must read "免费", never "未配置".
 *
 * The first test is the Rule 11 reproduction (FAIL → PASS across the fix); the
 * rest guard the paid-mode labels and price formatting.
 */
import { describe, it, expect } from "vitest";
import type { PricingRule } from "@/api/billing";
import { billingModeLabel, billingModeCss, formatPrice } from "../pricing";

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: 1,
    service_type: "llm_chat",
    provider: "agnes-ai",
    model: "free-model",
    billing_mode: "flat",
    input_price_per_mtok: 0,
    output_price_per_mtok: 0,
    price_per_call: 0,
    price_per_gb: 0,
    sell_input_price_per_mtok: 0,
    sell_output_price_per_mtok: 0,
    sell_price_per_call: 0,
    sell_price_per_gb: 0,
    ...overrides,
  } as PricingRule;
}

describe("billingModeLabel (regression: free model mislabelled 未配置)", () => {
  it("labels an all-zero (free) rule as 免费, not 未配置", () => {
    const label = billingModeLabel(rule({}));
    expect(label).toBe("免费");
    expect(label).not.toBe("未配置");
  });

  it("labels token-priced rules as 按量计费", () => {
    expect(billingModeLabel(rule({ input_price_per_mtok: 2 }))).toBe(
      "按量计费",
    );
    expect(billingModeLabel(rule({ output_price_per_mtok: 5 }))).toBe(
      "按量计费",
    );
  });

  it("labels per-call rules as 按次计费", () => {
    expect(billingModeLabel(rule({ price_per_call: 0.01 }))).toBe("按次计费");
  });

  it("labels per-gb rules as 按量计费", () => {
    expect(billingModeLabel(rule({ price_per_gb: 0.5 }))).toBe("按量计费");
  });
});

describe("billingModeCss", () => {
  it("gives a distinct class to a free rule", () => {
    expect(billingModeCss(rule({}))).toBe("pricing-badge--free");
    expect(billingModeCss(rule({ input_price_per_mtok: 2 }))).toBe(
      "pricing-badge--token",
    );
    expect(billingModeCss(rule({ price_per_call: 0.01 }))).toBe(
      "pricing-badge--call",
    );
  });
});

describe("formatPrice", () => {
  it("shows a dash for a free rule and prices otherwise", () => {
    expect(formatPrice(rule({}))).toBe("—");
    expect(formatPrice(rule({ price_per_call: 0.02 }))).toBe("¥0.02 / 次");
    expect(
      formatPrice(rule({ input_price_per_mtok: 1, output_price_per_mtok: 3 })),
    ).toBe("输入 ¥1 / 输出 ¥3 (per Mtok)");
  });
});
