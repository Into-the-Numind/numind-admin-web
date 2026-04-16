import { defineStore } from "pinia";
import { ref } from "vue";
import { getCapabilitySchemaApi } from "@/api/ai";
import type { CapabilitySchema } from "@/types/ai";

export const useAiCapabilitySchemaStore = defineStore(
  "aiCapabilitySchema",
  () => {
    const schema = ref<CapabilitySchema>({});
    const loaded = ref(false);
    const loading = ref(false);
    const error = ref("");

    async function ensureLoaded() {
      if (loaded.value || loading.value) return;
      loading.value = true;
      error.value = "";
      try {
        schema.value = await getCapabilitySchemaApi();
        loaded.value = true;
      } catch (e) {
        error.value = e instanceof Error ? e.message : "加载能力 schema 失败";
      } finally {
        loading.value = false;
      }
    }

    function getCapabilityNames(): string[] {
      return Object.keys(schema.value);
    }

    function getCapabilityLabel(key: string): string {
      return schema.value[key]?.label ?? key;
    }

    return {
      schema,
      loaded,
      loading,
      error,
      ensureLoaded,
      getCapabilityNames,
      getCapabilityLabel,
    };
  },
);
