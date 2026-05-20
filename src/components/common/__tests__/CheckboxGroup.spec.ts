import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CheckboxGroup from "../CheckboxGroup.vue";

const OPTIONS = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("CheckboxGroup", () => {
  describe("single select / multi-select", () => {
    it("renders all option labels", () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: [], options: OPTIONS },
      });
      const labels = wrapper.findAll(".checkbox-group__option");
      expect(labels).toHaveLength(3);
    });

    it("checks checkboxes matching modelValue", () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: ["a", "c"], options: OPTIONS },
      });
      const checkboxes = wrapper.findAll<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      expect(checkboxes[0].element.checked).toBe(true); // a
      expect(checkboxes[1].element.checked).toBe(false); // b
      expect(checkboxes[2].element.checked).toBe(true); // c
    });

    it("emits update:modelValue with new value when option is checked", async () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: ["a"], options: OPTIONS },
      });
      const checkboxes = wrapper.findAll<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      // Check option b — set element.checked first so event.target.checked is true
      checkboxes[1].element.checked = true;
      await checkboxes[1].trigger("change");
      const emitted = wrapper.emitted("update:modelValue");
      expect(emitted).toBeTruthy();
      // After checking b, array should contain a and b
      const lastEmit = emitted![emitted!.length - 1][0] as string[];
      expect(lastEmit).toContain("a");
      expect(lastEmit).toContain("b");
    });

    it("emits update:modelValue without value when option is unchecked", async () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: ["a", "b"], options: OPTIONS },
      });
      const checkboxes = wrapper.findAll<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      // Uncheck option a
      checkboxes[0].element.checked = false;
      await checkboxes[0].trigger("change");
      const emitted = wrapper.emitted("update:modelValue");
      expect(emitted).toBeTruthy();
      const lastEmit = emitted![emitted!.length - 1][0] as string[];
      expect(lastEmit).not.toContain("a");
      expect(lastEmit).toContain("b");
    });
  });

  describe("allowOther", () => {
    it("does not render other row when allowOther is false", () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: [], options: OPTIONS, allowOther: false },
      });
      expect(wrapper.find(".checkbox-group__option--other").exists()).toBe(
        false,
      );
    });

    it("renders other row when allowOther is true", () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: [], options: OPTIONS, allowOther: true },
      });
      expect(wrapper.find(".checkbox-group__option--other").exists()).toBe(
        true,
      );
    });

    it("toggling 'other' checkbox emits empty string placeholder", async () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: [], options: OPTIONS, allowOther: true },
      });
      const otherCheckbox = wrapper
        .find(".checkbox-group__option--other")
        .find<HTMLInputElement>('input[type="checkbox"]');
      otherCheckbox.element.checked = true;
      await otherCheckbox.trigger("change");
      const emitted = wrapper.emitted("update:modelValue");
      expect(emitted).toBeTruthy();
      const lastEmit = emitted![emitted!.length - 1][0] as string[];
      // Should contain empty string placeholder for the other entry
      expect(lastEmit).toContain("");
    });

    it("typing in other text input emits the text value", async () => {
      // modelValue already has empty string (other checked)
      const wrapper = mount(CheckboxGroup, {
        props: {
          modelValue: ["a", ""],
          options: OPTIONS,
          allowOther: true,
        },
      });
      const textInput = wrapper.find<HTMLInputElement>(
        ".checkbox-group__other-input",
      );
      expect(textInput.exists()).toBe(true);
      await textInput.setValue("custom text");
      await textInput.trigger("input");
      const emitted = wrapper.emitted("update:modelValue");
      expect(emitted).toBeTruthy();
      const lastEmit = emitted![emitted!.length - 1][0] as string[];
      expect(lastEmit).toContain("custom text");
      expect(lastEmit).toContain("a");
    });

    it("unchecking other removes the free-text entry", async () => {
      const wrapper = mount(CheckboxGroup, {
        props: {
          modelValue: ["a", "some custom"],
          options: OPTIONS,
          allowOther: true,
        },
      });
      const otherCheckbox = wrapper
        .find(".checkbox-group__option--other")
        .find<HTMLInputElement>('input[type="checkbox"]');
      otherCheckbox.element.checked = false;
      await otherCheckbox.trigger("change");
      const emitted = wrapper.emitted("update:modelValue");
      expect(emitted).toBeTruthy();
      const lastEmit = emitted![emitted!.length - 1][0] as string[];
      expect(lastEmit).not.toContain("some custom");
      expect(lastEmit).toContain("a");
    });
  });

  describe("readonly", () => {
    it("disables all checkboxes when readonly=true", () => {
      const wrapper = mount(CheckboxGroup, {
        props: {
          modelValue: ["a"],
          options: OPTIONS,
          allowOther: true,
          readonly: true,
        },
      });
      const checkboxes = wrapper.findAll<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      checkboxes.forEach((cb) => {
        expect(cb.element.disabled).toBe(true);
      });
    });

    it("applies readonly class to root element", () => {
      const wrapper = mount(CheckboxGroup, {
        props: { modelValue: [], options: OPTIONS, readonly: true },
      });
      expect(wrapper.classes()).toContain("checkbox-group--readonly");
    });
  });
});
