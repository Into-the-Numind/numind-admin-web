// Pinia store for compliance rule CRUD.
// Setup syntax per numind-admin-web CLAUDE.md §2.

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  listComplianceRules,
  createComplianceRule,
  getComplianceRule,
  patchComplianceRule,
  deleteComplianceRule,
} from "@/api/complianceRule";
import type {
  ComplianceRule,
  CreateRuleRequest,
  PatchRuleRequest,
  ListRulesParams,
} from "@/types/compliance";

export const useComplianceRuleStore = defineStore("complianceRule", () => {
  // --- List state ---
  const rules = ref<ComplianceRule[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- Current (detail/edit) state ---
  const current = ref<ComplianceRule | null>(null);
  const currentLoading = ref(false);
  const currentError = ref<string | null>(null);

  // --- Shared saving flag (create/update/delete) ---
  const saving = ref(false);

  // --- Getters ---
  const isEmpty = computed(() => !loading.value && rules.value.length === 0);

  // --- Actions ---

  async function fetchList(params: ListRulesParams = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await listComplianceRules({
        page: 1,
        page_size: 50,
        ...params,
      });
      rules.value = res.list ?? [];
      total.value = res.total ?? 0;
    } catch (e) {
      error.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: number) {
    currentLoading.value = true;
    currentError.value = null;
    try {
      current.value = await getComplianceRule(id);
    } catch (e) {
      currentError.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      currentLoading.value = false;
    }
  }

  async function create(data: CreateRuleRequest): Promise<ComplianceRule> {
    saving.value = true;
    try {
      const rule = await createComplianceRule(data);
      current.value = rule;
      return rule;
    } finally {
      saving.value = false;
    }
  }

  async function update(
    id: number,
    data: PatchRuleRequest,
  ): Promise<ComplianceRule> {
    saving.value = true;
    try {
      const rule = await patchComplianceRule(id, data);
      current.value = rule;
      // Update in-list optimistically if present
      const idx = rules.value.findIndex((r) => r.id === id);
      if (idx !== -1) {
        rules.value[idx] = rule;
      }
      return rule;
    } finally {
      saving.value = false;
    }
  }

  async function remove(id: number): Promise<void> {
    saving.value = true;
    try {
      await deleteComplianceRule(id);
      // Optimistic local mutation
      rules.value = rules.value.filter((r) => r.id !== id);
      total.value = Math.max(0, total.value - 1);
    } finally {
      saving.value = false;
    }
  }

  // Pinia setup-syntax stores need explicit reset (no auto $reset)
  function $reset() {
    rules.value = [];
    total.value = 0;
    loading.value = false;
    error.value = null;
    current.value = null;
    currentLoading.value = false;
    currentError.value = null;
    saving.value = false;
  }

  return {
    // state
    rules,
    total,
    loading,
    error,
    current,
    currentLoading,
    currentError,
    saving,
    // getters
    isEmpty,
    // actions
    fetchList,
    fetchOne,
    create,
    update,
    remove,
    $reset,
  };
});
