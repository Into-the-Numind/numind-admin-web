/**
 * AppButton type 默认值回归（appbutton-default-type-button）。
 *
 * 原生 <button> 在 <form> 内默认 type="submit"，导致放进表单的按钮（如"取消"）
 * 一点就意外提交表单（见 notif-acceptance-fixes Bug 3）。AppButton 现在默认
 * type="button"，需要提交按钮时显式 type="submit"。
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppButton from "../AppButton.vue";

describe("AppButton type", () => {
  it("默认 type=button（不会意外提交表单）", () => {
    const w = mount(AppButton, { slots: { default: "点我" } });
    expect(w.get("button").attributes("type")).toBe("button");
  });

  it("显式 type=submit 透传", () => {
    const w = mount(AppButton, {
      props: { type: "submit" },
      slots: { default: "提交" },
    });
    expect(w.get("button").attributes("type")).toBe("submit");
  });

  it("显式 type=reset 透传", () => {
    const w = mount(AppButton, {
      props: { type: "reset" },
      slots: { default: "重置" },
    });
    expect(w.get("button").attributes("type")).toBe("reset");
  });
});
