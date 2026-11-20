import { shallowRef, type Component } from 'vue';

/**
 * The admin frame (sidebar, top bar, toasts), fetched with the first admin
 * page so a visitor to the public site never downloads it. The router waits
 * for it before an admin page shows, so the frame and the page appear together.
 */
export const adminShell = shallowRef<Component | null>(null);

export async function loadAdminShell(): Promise<void> {
  adminShell.value ??= (await import('./layouts/AdminShell.vue')).default;
}
