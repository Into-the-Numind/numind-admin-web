import type { PricingRule } from "@/api/billing";

// Pricing display helpers for admin billing surfaces (ServiceEdit pricing card,
// etc.). Pure functions of a PricingRule so they are unit-testable.

export function formatPrice(rule: PricingRule): string {
  if (rule.price_per_call && rule.price_per_call > 0) {
    return `¥${rule.price_per_call} / 次`;
  }
  const inp = rule.input_price_per_mtok ?? 0;
  const out = rule.output_price_per_mtok ?? 0;
  if (inp > 0 || out > 0) {
    return `输入 ¥${inp} / 输出 ¥${out} (per Mtok)`;
  }
  if (rule.price_per_gb && rule.price_per_gb > 0) {
    return `¥${rule.price_per_gb} / GB`;
  }
  return "—";
}

/** Returns the billing mode label based on which price fields are non-zero. */
export function billingModeLabel(rule: PricingRule): string {
  if (
    (rule.input_price_per_mtok ?? 0) > 0 ||
    (rule.output_price_per_mtok ?? 0) > 0
  ) {
    return "按量计费";
  }
  if ((rule.price_per_call ?? 0) > 0) {
    return "按次计费";
  }
  if ((rule.price_per_gb ?? 0) > 0) {
    return "按量计费";
  }
  return "未配置";
}

export function billingModeCss(rule: PricingRule): string {
  if (
    (rule.input_price_per_mtok ?? 0) > 0 ||
    (rule.output_price_per_mtok ?? 0) > 0
  ) {
    return "pricing-badge--token";
  }
  if ((rule.price_per_call ?? 0) > 0) {
    return "pricing-badge--call";
  }
  return "pricing-badge--flat";
}
