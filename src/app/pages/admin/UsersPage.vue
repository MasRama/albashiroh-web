<script setup lang="ts">
import { Plus, UsersRound } from '@lucide/vue';
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { ADMIN_ROLE_SLUG, AUTH_ROLES_CHANGED_EVENT, useAuthSession } from '../../../features/auth/web';
import { USERS_CHANGED_EVENT } from '../../../features/users/web';
import { onServerEvent } from '../../../shared/realtime/browser';
import {
  AbAvatar,
  AbButton,
  AbCard,
  AbCopy,
  AbDialog,
  AbEmpty,
  AbField,
  AbNotice,
  AbPage,
  AbSearch,
  AbSpinner,
  AbSwitch,
  showToast,
  skipped,
  useResource,
} from '../../../shared/ui';
import { accountClient, mergeStale, refusalText, roleLabel, roleNote, sortRoles, type ManagedUser } from '../../account';

/**
 * Pengguna: the staff accounts. Anyone with `users.*` sees and edits them;
 * only an administrator chooses roles, as the Users routes enforce.
 */
const session = useAuthSession();
const me = computed(() => session.user.value?.id);
const isAdmin = computed(() => session.user.value?.roles.includes(ADMIN_ROLE_SLUG) === true);
const can = (action: string) => session.can(`users.${action}`);
const manages = computed(() => can('edit') || can('reset-password') || can('delete'));

const query = ref('');
const term = ref('');
let pause: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(pause);
  pause = setTimeout(() => (term.value = value.trim()), 250);
});

const list = useResource(() => accountClient.users({ limit: 100, search: term.value }), [term]);
const users = computed(() => list.data.value?.users ?? []);
const rolesState = useResource(() => (isAdmin.value ? accountClient.roles() : skipped()));
const roles = computed(() => sortRoles(rolesState.data.value?.roles ?? []));
// Accounts and roles changed elsewhere show without a reload; an open form
// keeps its draft, and a save against an older version is merged.
onUnmounted(onServerEvent(USERS_CHANGED_EVENT, () => void list.reload()));
onUnmounted(onServerEvent(AUTH_ROLES_CHANGED_EVENT, () => void rolesState.reload()));
const rolesOf = (user: ManagedUser) =>
  user.roles.map((slug) => roleLabel(roles.value.find((role) => role.slug === slug) ?? { slug, name: slug })).join(', ') || 'Tanpa peran';

const randomPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => 'abcdefghjkmnpqrstuvwxyz23456789'[byte % 31]).join('').replace(/(.{4})(?!$)/g, '$1-');

function pick(current: string[], slug: string, on: boolean): string[] {
  return on ? [...new Set([...current, slug])] : current.filter((item) => item !== slug);
}

function check(name: string, email: string, password?: string) {
  return {
    name: name.trim() ? undefined : 'Isi nama.',
    email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : 'Isi email yang benar.',
    password: password === undefined || password.length >= 8 ? undefined : 'Minimal 8 karakter.',
  };
}

const busy = ref(false);

// A new account, then its sign-in details to send.
const adding = ref(false);
const created = ref<{ name: string; email: string; password: string } | null>(null);
const fresh = reactive({ name: '', email: '', password: '', roles: [] as string[] });
const freshErrors = ref<{ name?: string; email?: string; password?: string }>({});

function openNew(): void {
  Object.assign(fresh, { name: '', email: '', password: randomPassword(), roles: [] });
  freshErrors.value = {};
  created.value = null;
  adding.value = true;
}

async function create(): Promise<void> {
  if (busy.value) return;
  // Without the roles an administrator would create an account with none, unnoticed.
  if (isAdmin.value && rolesState.error.value) return;
  freshErrors.value = check(fresh.name, fresh.email, fresh.password);
  if (Object.values(freshErrors.value).some(Boolean)) return;
  busy.value = true;
  const saved = await accountClient.createUser({ name: fresh.name.trim(), email: fresh.email.trim(), password: fresh.password, roles: isAdmin.value ? fresh.roles : [] });
  busy.value = false;
  if (saved.ok) {
    created.value = { name: saved.data.user.name, email: saved.data.user.email, password: fresh.password };
    await list.reload();
  } else if (saved.code === 'DUPLICATE_EMAIL') freshErrors.value = { email: refusalText(saved) };
  else showToast(refusalText(saved), 'bad');
}

const welcome = computed(() =>
  created.value
    ? `Assalamu'alaikum ${created.value.name}, ini akun panel admin Al Bashiroh.\nAlamat: ${location.origin}/admin/masuk\nEmail: ${created.value.email}\nKata sandi sementara: ${created.value.password}\nSetelah masuk, Anda akan diminta membuat kata sandi sendiri.`
    : '',
);

// One account: details, roles, a new password, or removal.
const editing = ref<ManagedUser | null>(null);
const draft = reactive({ name: '', email: '', roles: [] as string[] });
const draftErrors = ref<{ name?: string; email?: string }>({});
const fields = (user: ManagedUser) => ({ name: user.name, email: user.email, roles: [...user.roles] });

function openUser(user: ManagedUser): void {
  if (!manages.value) return;
  editing.value = user;
  Object.assign(draft, fields(user));
  draftErrors.value = {};
}

async function save(): Promise<void> {
  const user = editing.value;
  if (!user || busy.value) return;
  draftErrors.value = check(draft.name, draft.email);
  if (draftErrors.value.name || draftErrors.value.email) return;
  busy.value = true;
  const saved = await accountClient.saveUser(user.id, {
    revision: user.revision,
    name: draft.name.trim(),
    email: draft.email.trim(),
    ...(isAdmin.value ? { roles: draft.roles } : {}),
  });
  busy.value = false;
  if (saved.ok) {
    editing.value = null;
    showToast('Pengguna disimpan', 'good');
    await list.reload();
    if (user.id === me.value) await session.refresh();
  } else if (saved.code === 'STALE_REVISION' && saved.current) {
    const current = saved.current as ManagedUser;
    showToast('Akun ini baru saja diubah orang lain. Perubahan Anda digabung; periksa, lalu simpan lagi.', 'warn');
    Object.assign(draft, mergeStale(fields(user), { ...draft, roles: [...draft.roles] }, fields(current)));
    editing.value = current;
    await list.reload();
  } else if (saved.code === 'DUPLICATE_EMAIL') draftErrors.value = { email: refusalText(saved) };
  else showToast(refusalText(saved), 'bad');
}

const resetting = ref<ManagedUser | null>(null);
const resetPassword = ref('');
const resetError = ref<string>();
const resetDone = ref(false);

function openReset(): void {
  resetting.value = editing.value;
  editing.value = null;
  resetPassword.value = randomPassword();
  resetError.value = undefined;
  resetDone.value = false;
}

async function reset(): Promise<void> {
  const user = resetting.value;
  if (!user || busy.value) return;
  resetError.value = resetPassword.value.length >= 8 ? undefined : 'Minimal 8 karakter.';
  if (resetError.value) return;
  busy.value = true;
  const saved = await accountClient.resetPassword(user.id, resetPassword.value);
  busy.value = false;
  if (saved.ok) resetDone.value = true;
  else showToast(refusalText(saved), 'bad');
}

const removing = ref<ManagedUser | null>(null);
function openRemove(): void {
  removing.value = editing.value;
  editing.value = null;
}

async function remove(): Promise<void> {
  const user = removing.value;
  if (!user || busy.value) return;
  busy.value = true;
  const done = await accountClient.deleteUser(user.id);
  busy.value = false;
  removing.value = null;
  if (done.ok) {
    showToast(`${user.name} dihapus`, 'good');
    await list.reload();
  } else showToast(refusalText(done), 'bad');
}
</script>

<template>
  <AbPage title="Pengguna" description="Akun staf yang bisa masuk ke panel admin." data-testid="users-page">
    <template #actions>
      <AbButton v-if="can('create')" @click="openNew"><Plus />Pengguna baru</AbButton>
    </template>

    <AbCard flush>
      <div class="us-tools"><AbSearch v-model="query" placeholder="Cari nama atau email" label="Cari pengguna" /></div>
      <div v-if="!list.data.value && list.loading.value" class="us-center"><AbSpinner /></div>
      <AbEmpty v-else-if="list.error.value && !list.data.value" title="Pengguna belum bisa dimuat" :text="list.error.value" :icon="UsersRound">
        <AbButton variant="outline" @click="list.reload()">Coba lagi</AbButton>
      </AbEmpty>
      <AbEmpty v-else-if="!users.length" :title="term ? 'Tidak ada yang cocok' : 'Belum ada pengguna'" :icon="UsersRound" />
      <table v-else class="ab-table">
        <thead>
          <tr><th>Nama</th><th>Peran</th><th class="ab-table-end"><span class="ab-visually-hidden">Tindakan</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" :data-user-id="user.id" :data-clickable="manages || undefined" @click="openUser(user)">
            <td>
              <div class="us-person">
                <AbAvatar :name="user.name" :size="38" />
                <div class="us-person-text">
                  <b>{{ user.name }}<span v-if="user.id === me" class="us-me"> (Anda)</span></b>
                  <span class="ab-table-sub">{{ user.email }}</span>
                </div>
              </div>
            </td>
            <td class="us-roles">{{ rolesOf(user) }}</td>
            <td class="ab-table-end">
              <AbButton v-if="manages" variant="outline" size="sm" :aria-label="`Ubah ${user.name}`" @click.stop="openUser(user)">Ubah</AbButton>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="list.data.value && list.data.value.total > users.length" class="us-more">
        Menampilkan {{ users.length }} dari {{ list.data.value.total }}. Cari untuk mempersempit.
      </p>
    </AbCard>

    <AbDialog :open="adding" :title="created ? 'Akun dibuat' : 'Pengguna baru'" :persistent="busy" @close="adding = false">
      <template v-if="created">
        <AbNotice tone="good">Kirim detail ini ke {{ created.name }}. Ia akan diminta membuat kata sandi sendiri saat pertama masuk.</AbNotice>
        <dl class="us-details">
          <div><dt>Email</dt><dd>{{ created.email }}</dd></div>
          <div><dt>Kata sandi sementara</dt><dd class="us-code">{{ created.password }}</dd></div>
        </dl>
        <AbCopy :text="welcome" label="Salin pesan untuk dikirim" block />
      </template>
      <form v-else id="us-new" class="us-form" novalidate @submit.prevent="create">
        <AbNotice v-if="isAdmin && rolesState.error.value" tone="bad">Daftar peran belum bisa dimuat, jadi akun belum bisa dibuat. Muat ulang halaman, lalu coba lagi.</AbNotice>
        <AbField v-model="fresh.name" label="Nama" autocomplete="off" :error="freshErrors.name" />
        <AbField v-model="fresh.email" label="Email" type="email" inputmode="email" autocomplete="off" :error="freshErrors.email" />
        <AbField v-model="fresh.password" label="Kata sandi sementara" autocomplete="off" :error="freshErrors.password" hint="Ia akan diminta menggantinya saat pertama masuk.">
          <template #trail><button type="button" class="us-link" @click="fresh.password = randomPassword()">Acak</button></template>
        </AbField>
        <fieldset v-if="isAdmin && roles.length" class="us-roles-set">
          <legend>Peran</legend>
          <div v-for="role in roles" :key="role.id" class="us-role">
            <div><b>{{ roleLabel(role) }}</b><span v-if="roleNote(role)">{{ roleNote(role) }}</span></div>
            <AbSwitch :label="roleLabel(role)" :model-value="fresh.roles.includes(role.slug)" @update:model-value="fresh.roles = pick(fresh.roles, role.slug, $event)" />
          </div>
        </fieldset>
        <AbNotice v-else-if="!isAdmin">Akun baru belum punya peran. Minta administrator memberi peran setelah akun dibuat.</AbNotice>
      </form>
      <template #footer>
        <AbButton v-if="created" @click="adding = false">Selesai</AbButton>
        <template v-else>
          <AbButton variant="outline" :disabled="busy" @click="adding = false">Batal</AbButton>
          <AbButton type="submit" form="us-new" :loading="busy">Buat akun</AbButton>
        </template>
      </template>
    </AbDialog>

    <AbDialog :open="editing !== null" :title="editing?.name ?? ''" :description="editing?.email" :persistent="busy" @close="editing = null">
      <template v-if="editing">
        <form id="us-edit" class="us-form" novalidate @submit.prevent="save">
          <template v-if="can('edit')">
            <AbField v-model="draft.name" label="Nama" autocomplete="off" :error="draftErrors.name" />
            <AbField v-model="draft.email" label="Email" type="email" inputmode="email" autocomplete="off" :error="draftErrors.email" />
          </template>
          <fieldset v-if="isAdmin && can('edit') && roles.length" class="us-roles-set">
            <legend>Peran</legend>
            <div v-for="role in roles" :key="role.id" class="us-role">
              <div><b>{{ roleLabel(role) }}</b><span v-if="roleNote(role)">{{ roleNote(role) }}</span></div>
              <AbSwitch :label="roleLabel(role)" :model-value="draft.roles.includes(role.slug)" @update:model-value="draft.roles = pick(draft.roles, role.slug, $event)" />
            </div>
          </fieldset>
          <div v-else class="us-static">
            <p class="us-static-label">Peran</p>
            <p>{{ rolesOf(editing) }}</p>
            <p v-if="!isAdmin" class="us-static-note">Hanya administrator yang bisa mengubah peran.</p>
          </div>
        </form>
        <div v-if="editing.id !== me && (can('reset-password') || can('delete'))" class="us-danger">
          <AbButton v-if="can('reset-password')" variant="outline" @click="openReset">Atur ulang kata sandi</AbButton>
          <AbButton v-if="can('delete')" variant="danger" @click="openRemove">Hapus pengguna</AbButton>
        </div>
      </template>
      <template #footer>
        <AbButton variant="outline" :disabled="busy" @click="editing = null">{{ can('edit') ? 'Batal' : 'Tutup' }}</AbButton>
        <AbButton v-if="can('edit')" type="submit" form="us-edit" :loading="busy">Simpan</AbButton>
      </template>
    </AbDialog>

    <AbDialog :open="resetting !== null" :title="resetDone ? 'Kata sandi diatur ulang' : 'Atur ulang kata sandi'" size="sm" :persistent="busy" @close="resetting = null">
      <template v-if="resetting && resetDone">
        <p class="us-text">{{ resetting.name }} sudah dikeluarkan dari semua perangkat dan harus membuat kata sandi baru saat masuk.</p>
        <dl class="us-details"><div><dt>Kata sandi sementara</dt><dd class="us-code">{{ resetPassword }}</dd></div></dl>
        <AbCopy :text="resetPassword" label="Salin kata sandi" block />
      </template>
      <form v-else-if="resetting" id="us-reset" class="us-form" novalidate @submit.prevent="reset">
        <p class="us-text">{{ resetting.name }} akan dikeluarkan dari semua perangkat dan diminta membuat kata sandi baru saat masuk.</p>
        <AbField v-model="resetPassword" label="Kata sandi sementara" autocomplete="off" :error="resetError">
          <template #trail><button type="button" class="us-link" @click="resetPassword = randomPassword()">Acak</button></template>
        </AbField>
      </form>
      <template #footer>
        <AbButton v-if="resetDone" @click="resetting = null">Selesai</AbButton>
        <template v-else>
          <AbButton variant="outline" :disabled="busy" @click="resetting = null">Batal</AbButton>
          <AbButton type="submit" form="us-reset" :loading="busy">Atur ulang</AbButton>
        </template>
      </template>
    </AbDialog>

    <AbDialog :open="removing !== null" :title="`Hapus ${removing?.name ?? ''}?`" size="sm" :persistent="busy" @close="removing = null">
      <p class="us-text">Akunnya tidak bisa masuk lagi. Isi situs yang pernah ia buat tetap tersimpan.</p>
      <template #footer>
        <AbButton variant="outline" :disabled="busy" @click="removing = null">Batal</AbButton>
        <AbButton variant="danger" :loading="busy" @click="remove">Hapus</AbButton>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.us-tools { padding: 0 24px 16px; }
.us-center { display: grid; padding: 48px 0; place-items: center; }
.us-person { display: flex; align-items: center; gap: 12px; }
.us-person-text { min-width: 0; }
.us-person-text b { font-weight: 700; }
.us-me { color: var(--ab-mute); font-weight: 600; }
.us-roles { color: var(--ab-ink-2); }
.us-more { margin: 0; padding: 14px 24px; border-top: 1px solid var(--ab-line); color: var(--ab-mute); font-size: 13.5px; }
.us-form { display: grid; gap: 16px; }
.us-link { padding: 6px 10px; border-radius: 8px; color: var(--ab-forest); font-size: 14px; font-weight: 800; }
.us-link:hover { background: var(--ab-paper-2); }
.us-roles-set { display: grid; gap: 0; margin: 0; padding: 0; border: 0; }
.us-roles-set legend { margin-bottom: 8px; padding: 0; font-size: 14px; font-weight: 700; }
.us-role { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--ab-line); }
.us-role b { display: block; font-size: 14.5px; }
.us-role span { display: block; color: var(--ab-mute); font-size: 13px; }
.us-static p { margin: 0; }
.us-static-label { font-size: 14px; font-weight: 700; }
.us-static-note { margin-top: 4px !important; color: var(--ab-mute); font-size: 13.5px; }
.us-danger { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 18px; border-top: 1px solid var(--ab-line); }
.us-details { display: grid; gap: 12px; margin: 0; }
.us-details div { padding: 12px 14px; border: 1px solid var(--ab-line); border-radius: 12px; }
.us-details dt { color: var(--ab-mute); font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.us-details dd { margin: 2px 0 0; font-weight: 700; overflow-wrap: anywhere; }
.us-code { font-family: var(--ab-mono); font-size: 16px; }
.us-text { margin: 0; color: var(--ab-ink-2); }
@media (max-width: 719px) {
  .us-tools { padding: 0 16px 12px; }
  .us-more { padding: 12px 16px; }
}
</style>
