import { reactive } from 'vue';

/** good: done. bad: refused or failed. warn: done, with something to look at. info: worth knowing. */
export type ToastTone = 'good' | 'bad' | 'warn' | 'info';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

const DURATION: Record<ToastTone, number> = { good: 2600, info: 3400, warn: 4500, bad: 4500 };

/** Short feedback after an action, drawn by the shell in the corner of the screen. */
export const toasts = reactive<Toast[]>([]);
let next = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const index = toasts.findIndex((item) => item.id === id);
  if (index >= 0) toasts.splice(index, 1);
}

export function showToast(text: string, tone: ToastTone = 'info', ms = DURATION[tone]): void {
  const id = next++;
  toasts.push({ id, text, tone });
  while (toasts.length > 2) dismissToast(toasts[0]!.id);
  timers.set(id, setTimeout(() => dismissToast(id), ms));
}
