/// <reference lib="dom" />
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AbDialog, AbField, AbSwitch } from '..';

let container: HTMLDivElement;
let unmount: (() => void) | undefined;

function mount(render: () => ReturnType<typeof h>): void {
  const app = createApp(defineComponent({ setup: () => render }));
  app.mount(container);
  unmount = () => app.unmount();
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  container.remove();
  // A dialog that was closing when the test ended is still leaving the page.
  for (const layer of document.querySelectorAll('.ab-dialog-layer')) layer.remove();
  delete document.body.dataset.abDialogs;
  document.body.classList.remove('ab-locked');
});

describe('AbField', () => {
  it('ties the label, hint and error to the input and reports what is typed', async () => {
    const value = ref('');
    const error = ref<string>();
    mount(() => h(AbField, { label: 'Email', modelValue: value.value, 'onUpdate:modelValue': (next: string) => (value.value = next), hint: 'Email kerja', error: error.value }));
    await nextTick();

    const input = container.querySelector('input')!;
    const label = container.querySelector('label')!;
    expect(label.getAttribute('for')).toBe(input.id);
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Email kerja');

    input.value = 'guru@example.com';
    input.dispatchEvent(new Event('input'));
    expect(value.value).toBe('guru@example.com');

    error.value = 'Isi email yang benar.';
    await nextTick();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(message?.textContent).toBe('Isi email yang benar.');
    expect(message?.getAttribute('role')).toBe('alert');
  });

  it('lets a password be shown and hidden again', async () => {
    mount(() => h(AbField, { label: 'Kata sandi', type: 'password', modelValue: 'rahasia' }));
    await nextTick();
    const input = container.querySelector('input')!;
    expect(input.type).toBe('password');

    container.querySelector<HTMLButtonElement>('button[aria-label="Tampilkan kata sandi"]')!.click();
    await nextTick();
    expect(input.type).toBe('text');

    const hide = container.querySelector<HTMLButtonElement>('button[aria-label="Sembunyikan kata sandi"]')!;
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    hide.click();
    await nextTick();
    expect(input.type).toBe('password');
  });
});

describe('AbSwitch', () => {
  it('is a labelled switch that flips its value', async () => {
    const on = ref(false);
    mount(() => h(AbSwitch, { label: 'Editor SMP', modelValue: on.value, 'onUpdate:modelValue': (next: boolean) => (on.value = next) }));
    await nextTick();
    const control = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(control.getAttribute('aria-label')).toBe('Editor SMP');
    expect(control.getAttribute('aria-checked')).toBe('false');

    control.click();
    await nextTick();
    expect(on.value).toBe(true);
    expect(control.getAttribute('aria-checked')).toBe('true');
  });
});

describe('AbDialog', () => {
  // The newest of its kind: a dialog that just closed may still be animating out.
  const latest = <T extends Element>(selector: string) => [...document.querySelectorAll<T>(selector)].at(-1)!;

  function mountDialog(persistent = false) {
    const open = ref(false);
    const closes = ref(0);
    mount(() =>
      h('div', [
        h('button', { id: 'opener', onClick: () => (open.value = true) }, 'Buka'),
        h(
          AbDialog,
          { open: open.value, title: 'Pengguna baru', persistent, onClose: () => { closes.value += 1; open.value = false; } },
          { default: () => h(AbField, { label: 'Nama', modelValue: '' }), footer: () => h('button', { id: 'save' }, 'Simpan') },
        ),
      ]),
    );
    return { open, closes };
  }

  it('opens over the page with focus on its first field, and gives focus back when it closes', async () => {
    const { open } = mountDialog();
    const opener = container.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.click();
    await nextTick();
    await nextTick();

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Pengguna baru');
    expect(document.activeElement).toBe(dialog.querySelector('input'));
    expect(document.body.classList.contains('ab-locked')).toBe(true);

    open.value = false;
    await nextTick();
    expect(document.activeElement).toBe(opener);
    expect(document.body.classList.contains('ab-locked')).toBe(false);
  });

  it('closes on Escape and on the close button, and keeps Tab inside', async () => {
    const { open, closes } = mountDialog();
    open.value = true;
    await nextTick();
    await nextTick();
    const layer = latest<HTMLElement>('.ab-dialog-layer');

    const save = document.querySelector<HTMLButtonElement>('#save')!;
    save.focus();
    layer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector('.ab-dialog-close'));

    layer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closes.value).toBe(1);

    open.value = true;
    await nextTick();
    latest<HTMLButtonElement>('button[aria-label="Tutup"]').click();
    expect(closes.value).toBe(2);
  });

  it('stays open while persistent, as while something is being saved', async () => {
    const { open, closes } = mountDialog(true);
    open.value = true;
    await nextTick();
    latest<HTMLElement>('.ab-dialog-layer').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    latest<HTMLElement>('.ab-dialog-scrim').click();
    expect(closes.value).toBe(0);
    expect(latest<HTMLButtonElement>('button[aria-label="Tutup"]').disabled).toBe(true);
  });
});
