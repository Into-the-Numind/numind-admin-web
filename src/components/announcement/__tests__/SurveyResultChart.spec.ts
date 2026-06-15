/**
 * Unit tests for SurveyResultChart (notification-center T6b).
 *
 * Focus: bar-width math + divide-by-zero / empty-response guards across the
 * four question types. Pure-presentation component — assert rendered DOM.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SurveyResultChart from "../SurveyResultChart.vue";
import type { SurveyResultQuestion } from "@/api/announcements";

function mountQ(question: SurveyResultQuestion) {
  return mount(SurveyResultChart, { props: { question } });
}

function fillWidths(wrapper: ReturnType<typeof mountQ>): number[] {
  return wrapper.findAll(".bar-row__fill").map((el) => {
    const w = (el.element as HTMLElement).style.width;
    return parseFloat(w.replace("%", ""));
  });
}

describe("SurveyResultChart — single/multi", () => {
  it("renders bars with width = count/maxCount * 100", () => {
    const wrapper = mountQ({
      question_id: 1,
      title: "Q1",
      question_type: "single",
      option_counts: [
        { option: "A", count: 30 },
        { option: "B", count: 15 },
      ],
    });
    const widths = fillWidths(wrapper);
    expect(widths).toEqual([100, 50]); // 30/30, 15/30
  });

  it("shows percent of total responses per option", () => {
    const wrapper = mountQ({
      question_id: 1,
      title: "Q1",
      question_type: "single",
      option_counts: [
        { option: "A", count: 30 },
        { option: "B", count: 10 },
      ],
    });
    const text = wrapper.text();
    expect(text).toContain("75.0%"); // 30/40
    expect(text).toContain("25.0%"); // 10/40
  });

  it("guards zero responses (all counts 0) → 暂无答卷, no bars", () => {
    const wrapper = mountQ({
      question_id: 1,
      title: "Q1",
      question_type: "single",
      option_counts: [
        { option: "A", count: 0 },
        { option: "B", count: 0 },
      ],
    });
    expect(wrapper.text()).toContain("暂无答卷");
    expect(wrapper.findAll(".bar-row__fill")).toHaveLength(0);
  });

  it("guards missing option_counts → 暂无答卷", () => {
    const wrapper = mountQ({
      question_id: 1,
      title: "Q1",
      question_type: "multi",
    });
    expect(wrapper.text()).toContain("暂无答卷");
  });
});

describe("SurveyResultChart — rating", () => {
  it("renders distribution bars and average", () => {
    const wrapper = mountQ({
      question_id: 2,
      title: "Q2",
      question_type: "rating",
      distribution: [
        { value: 1, count: 1 },
        { value: 2, count: 4 },
      ],
      average: 4.2,
    });
    const widths = fillWidths(wrapper);
    expect(widths).toEqual([25, 100]); // 1/4, 4/4
    expect(wrapper.text()).toContain("平均");
    expect(wrapper.text()).toContain("4.2");
  });

  it("sorts distribution by value ascending", () => {
    const wrapper = mountQ({
      question_id: 2,
      title: "Q2",
      question_type: "rating",
      distribution: [
        { value: 3, count: 2 },
        { value: 1, count: 6 },
        { value: 2, count: 3 },
      ],
      average: 1.6,
    });
    const labels = wrapper
      .findAll(".bar-row__label--narrow")
      .map((el) => el.text());
    expect(labels).toEqual(["1", "2", "3"]);
  });

  it("guards no rating responses → 暂无答卷, hides average", () => {
    const wrapper = mountQ({
      question_id: 2,
      title: "Q2",
      question_type: "rating",
      distribution: [],
      average: 0,
    });
    expect(wrapper.text()).toContain("暂无答卷");
    expect(wrapper.text()).not.toContain("平均");
  });
});

describe("SurveyResultChart — text", () => {
  it("lists text answers with nickname", () => {
    const wrapper = mountQ({
      question_id: 3,
      title: "Q3",
      question_type: "text",
      answers: [
        {
          user_id: 7,
          nickname: "小明",
          text: "很好",
          submitted_at: "2026-06-16T10:00:00",
        },
      ],
    });
    expect(wrapper.text()).toContain("小明");
    expect(wrapper.text()).toContain("很好");
  });

  it("guards no text answers → 暂无答卷", () => {
    const wrapper = mountQ({
      question_id: 3,
      title: "Q3",
      question_type: "text",
      answers: [],
    });
    expect(wrapper.text()).toContain("暂无答卷");
    expect(wrapper.findAll(".text-item")).toHaveLength(0);
  });
});
