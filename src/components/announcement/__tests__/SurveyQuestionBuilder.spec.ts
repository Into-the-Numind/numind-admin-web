/**
 * Unit tests for SurveyQuestionBuilder (notification-center T6a).
 *
 * Covers the v-model emit contract:
 *  - add question seeds a single/2-option default + re-indexed order_index
 *  - remove question drops the row and re-indexes
 *  - move up/down reorders + re-indexes
 *  - type change to rating clears options and seeds rating defaults
 *  - add/remove option mutates the options array
 *  - disabled mode blocks mutations
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SurveyQuestionBuilder from "../SurveyQuestionBuilder.vue";
import type { QuestionInput } from "@/api/announcements";

function lastEmit(wrapper: ReturnType<typeof mount>): QuestionInput[] {
  const events = wrapper.emitted("update:modelValue");
  expect(events).toBeTruthy();
  return events![events!.length - 1][0] as QuestionInput[];
}

function makeQuestion(over: Partial<QuestionInput> = {}): QuestionInput {
  return {
    order_index: 0,
    question_type: "single",
    title: "Q",
    required: true,
    options: ["A", "B"],
    rating_max: null,
    rating_style: null,
    ...over,
  };
}

describe("SurveyQuestionBuilder", () => {
  it("adds a question with default shape and order_index", async () => {
    const wrapper = mount(SurveyQuestionBuilder, {
      props: { modelValue: [] },
    });
    // "添加题目" is the last AppButton (variant secondary).
    const buttons = wrapper.findAll("button");
    const addBtn = buttons.find((b) => b.text().includes("添加题目"));
    expect(addBtn).toBeTruthy();
    await addBtn!.trigger("click");

    const emitted = lastEmit(wrapper);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].question_type).toBe("single");
    expect(emitted[0].order_index).toBe(0);
    expect(emitted[0].options).toEqual(["", ""]);
    expect(emitted[0].required).toBe(true);
    // The local stable render key must NOT leak into the v-model payload.
    expect(emitted[0]).not.toHaveProperty("_key");
  });

  it("never emits the internal _key field (clean QuestionInput[] contract)", async () => {
    const modelValue = [
      makeQuestion({ title: "first", order_index: 0 }),
      makeQuestion({ title: "second", order_index: 1 }),
    ];
    const wrapper = mount(SurveyQuestionBuilder, { props: { modelValue } });
    // Trigger a reorder (the operation that relies on stable keys).
    const downBtn = wrapper.findAll('[aria-label="下移"]')[0];
    await downBtn.trigger("click");

    const emitted = lastEmit(wrapper);
    for (const q of emitted) {
      expect(q).not.toHaveProperty("_key");
    }
  });

  it("removes a question and re-indexes the rest", async () => {
    const modelValue = [
      makeQuestion({ title: "first", order_index: 0 }),
      makeQuestion({ title: "second", order_index: 1 }),
    ];
    const wrapper = mount(SurveyQuestionBuilder, { props: { modelValue } });
    const delBtn = wrapper.find('[aria-label="删除题目"]');
    await delBtn.trigger("click");

    const emitted = lastEmit(wrapper);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].title).toBe("second");
    expect(emitted[0].order_index).toBe(0);
  });

  it("moves a question down and re-indexes", async () => {
    const modelValue = [
      makeQuestion({ title: "first", order_index: 0 }),
      makeQuestion({ title: "second", order_index: 1 }),
    ];
    const wrapper = mount(SurveyQuestionBuilder, { props: { modelValue } });
    const downBtn = wrapper.findAll('[aria-label="下移"]')[0];
    await downBtn.trigger("click");

    const emitted = lastEmit(wrapper);
    expect(emitted.map((q) => q.title)).toEqual(["second", "first"]);
    expect(emitted.map((q) => q.order_index)).toEqual([0, 1]);
  });

  it("switching type to rating clears options and seeds rating defaults", async () => {
    const modelValue = [makeQuestion()];
    const wrapper = mount(SurveyQuestionBuilder, { props: { modelValue } });
    const select = wrapper.find("select");
    await select.setValue("rating");

    const emitted = lastEmit(wrapper);
    expect(emitted[0].question_type).toBe("rating");
    expect(emitted[0].options).toBeNull();
    expect(emitted[0].rating_max).toBe(5);
    expect(emitted[0].rating_style).toBe("star");
  });

  it("adds an option to a choice question", async () => {
    const modelValue = [makeQuestion({ options: ["A", "B"] })];
    const wrapper = mount(SurveyQuestionBuilder, { props: { modelValue } });
    const addOptBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("添加选项"));
    expect(addOptBtn).toBeTruthy();
    await addOptBtn!.trigger("click");

    const emitted = lastEmit(wrapper);
    expect(emitted[0].options).toEqual(["A", "B", ""]);
  });

  it("does not emit when disabled", async () => {
    const modelValue = [makeQuestion()];
    const wrapper = mount(SurveyQuestionBuilder, {
      props: { modelValue, disabled: true },
    });
    const delBtn = wrapper.find('[aria-label="删除题目"]');
    await delBtn.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeFalsy();
  });
});
