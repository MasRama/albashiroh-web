import type { ApplicationInput, PpdbForm, Receipt } from '../contract';

/** What sending the form gives: the receipt, or why it was refused, with any field messages. */
export type SubmitResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; status: number; code: string; errors: Record<string, string[]> };

export interface PpdbFormClient {
  open(): Promise<{ ok: true; form: PpdbForm } | { ok: false }>;
  submit(input: ApplicationInput): Promise<SubmitResult>;
}

function csrfCookie(): string {
  const match = /(?:^|;\s*)csrf_token=([^;]+)/.exec(typeof document === 'undefined' ? '' : document.cookie);
  return match ? decodeURIComponent(match[1]!) : '';
}

/**
 * The public registration form's requests, with no session and none of the
 * admin's helpers. Opening the form also sets the CSRF cookie the post echoes.
 */
export function createPpdbFormClient(base = '/api/ppdb', fetcher: typeof fetch = (...args) => fetch(...args)): PpdbFormClient {
  return {
    async open() {
      try {
        const response = await fetcher(`${base}/form`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!response.ok) return { ok: false };
        const body = (await response.json()) as { data: PpdbForm };
        return { ok: true, form: body.data };
      } catch {
        return { ok: false };
      }
    },
    async submit(input) {
      try {
        const response = await fetcher(`${base}/applications`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfCookie() },
          body: JSON.stringify(input),
        });
        const body = (await response.json().catch(() => ({}))) as { data?: { receipt: Receipt }; code?: string; errors?: Record<string, string[]> };
        if (response.ok && body.data) return { ok: true, receipt: body.data.receipt };
        return { ok: false, status: response.status, code: body.code ?? 'UNKNOWN', errors: body.errors ?? {} };
      } catch {
        return { ok: false, status: 0, code: 'NETWORK', errors: {} };
      }
    },
  };
}
