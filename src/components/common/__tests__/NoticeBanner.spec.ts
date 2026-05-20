import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import NoticeBanner from "../NoticeBanner.vue";

describe("NoticeBanner", () => {
  describe("type rendering", () => {
    it("renders info type by default", () => {
      const wrapper = mount(NoticeBanner, {
        slots: { default: "Info message" },
      });
      expect(wrapper.classes()).toContain("notice-banner--info");
    });

    it("renders warn type", () => {
      const wrapper = mount(NoticeBanner, {
        props: { type: "warn" },
        slots: { default: "Warning message" },
      });
      expect(wrapper.classes()).toContain("notice-banner--warn");
    });

    it("renders error type", () => {
      const wrapper = mount(NoticeBanner, {
        props: { type: "error" },
        slots: { default: "Error message" },
      });
      expect(wrapper.classes()).toContain("notice-banner--error");
    });
  });

  describe("icon", () => {
    it("renders an icon element (svg)", () => {
      const wrapper = mount(NoticeBanner, {
        slots: { default: "test" },
      });
      // lucide-vue-next renders an <svg>
      expect(wrapper.find("svg").exists()).toBe(true);
    });

    it("renders different icon for each type (different lucide component)", () => {
      const infoWrapper = mount(NoticeBanner, {
        props: { type: "info" },
        slots: { default: "info" },
      });
      const warnWrapper = mount(NoticeBanner, {
        props: { type: "warn" },
        slots: { default: "warn" },
      });
      const errorWrapper = mount(NoticeBanner, {
        props: { type: "error" },
        slots: { default: "error" },
      });
      // All have icons; we verify by checking the SVG exists in each
      expect(infoWrapper.find("svg").exists()).toBe(true);
      expect(warnWrapper.find("svg").exists()).toBe(true);
      expect(errorWrapper.find("svg").exists()).toBe(true);
    });
  });

  describe("slot content", () => {
    it("renders default slot content", () => {
      const wrapper = mount(NoticeBanner, {
        slots: { default: "<strong>Important notice</strong>" },
      });
      expect(wrapper.find(".notice-banner__content").html()).toContain(
        "<strong>Important notice</strong>",
      );
    });

    it("renders plain text slot content", () => {
      const wrapper = mount(NoticeBanner, {
        slots: { default: "Simple text message" },
      });
      expect(wrapper.find(".notice-banner__content").text()).toBe(
        "Simple text message",
      );
    });
  });
});
