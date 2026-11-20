import { ref, shallowRef, watch, type Ref, type WatchSource } from 'vue';
import type { ApiResult } from './api';

export interface Resource<T> {
  data: Ref<T | undefined>;
  loading: Ref<boolean>;
  /** The refusal message when the last load failed. */
  error: Ref<string | null>;
  code: Ref<string | null>;
  reload(): Promise<void>;
}

/**
 * Loads what a page shows and keeps the last good value while reloading, so
 * a refresh does not blank the screen. With `sources` it reloads
 * whenever they change (a search box, a filter, the route id).
 */
export function useResource<T>(load: () => Promise<ApiResult<T>>, sources?: WatchSource[]): Resource<T> {
  const data = shallowRef<T>();
  const loading = ref(true);
  const error = ref<string | null>(null);
  const code = ref<string | null>(null);
  let ticket = 0;

  async function reload(): Promise<void> {
    const mine = ++ticket;
    loading.value = true;
    const result = await load();
    // A slower, older request must not overwrite a newer answer.
    if (mine !== ticket) return;
    loading.value = false;
    if (result.ok) {
      data.value = result.data;
      error.value = null;
      code.value = null;
    } else {
      error.value = result.message;
      code.value = result.code;
    }
  }

  if (sources && sources.length > 0) watch(sources, () => void reload());
  void reload();
  return { data: data as Ref<T | undefined>, loading, error, code, reload };
}
