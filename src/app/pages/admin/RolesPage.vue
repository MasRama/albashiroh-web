<script setup lang="ts">
import { KeyRound, Plus } from 'lucide-vue-next';
import { computed, onUnmounted, reactive, ref } from 'vue';
import { ADMIN_ROLE_SLUG, AUTH_ROLES_CHANGED_EVENT, useAuthSession } from '../../../features/auth/web';
import { onServerEvent } from '../../../shared/realtime/browser';
import { AbButton, AbCard, AbDialog, AbEmpty, AbField, AbPage, AbSpinner, AbSwitch, showToast, useResource } from '../../../shared/ui';
import { accountClient, refusalText, roleLabel, roleNote, sortRoles, type Permission, type Role } from '../../account';

/**
 * Peran & izin: what each role may do, one switch per permission, grouped
 * by area. The administrator role holds every permission and stays as it
 * is; the Roles routes refuse to change it.
 */
const session = useAuthSession();
const can = (action: string) => session.can(`roles.${action}`);

/** Areas in the order the sidebar shows them; areas not named here follow by name. */
const RESOURCES: [string, string][] = [
  ['users', 'Pengguna'],
  ['roles', 'Peran & izin'],
  ['activity', 'Aktivitas'],
];

const PERMISSION_LABEL: Record<string, string> = {
  'users.view': 'Lihat pengguna',
  'users.create': 'Tambah pengguna',
  'users.edit': 'Ubah nama dan email pengguna',
  'users.reset-password': 'Atur ulang kata sandi pengguna',
  'users.delete': 'Hapus pengguna',
  'roles.view': 'Lihat peran',
  'roles.create': 'Tambah peran',
  'roles.edit': 'Ubah peran dan izinnya',
  'roles.delete': 'Hapus peran',
  'activity.view': 'Lihat riwayat aktivitas',
};
const permissionLabel = (permission: Permission) => PERMISSION_LABEL[permission.slug] ?? permission.description ?? permission.name;

const state = useResource(() => accountClient.roles());
// Roles another administrator adds or changes show without a reload; an open
// form keeps its draft, and a save against an older version is merged.
onUnmounted(onServerEvent(AUTH_ROLES_CHANGED_EVENT, () => void state.reload()));
const catalog = useResource(() => accountClient.permissions());
const roles = computed(() => sortRoles(state.data.value?.roles ?? []));
const groups = computed(() => {
  const byResource = catalog.data.value ?? {};
  const known = RESOURCES.filter(([resource]) => byResource[resource]?.length).map(([resource, label]) => ({ resource, label, permissions: byResource[resource]! }));
  const others = Object.keys(byResource)
    .filter((resource) => !RESOURCES.some(([name]) => name === resource))
    .sort()
    .map((resource) => ({ resource, label: resource, permissions: byResource[resource]! }));
  return [...known, ...others];
});

// One role, new or changed.
const open = ref(false);
const editing = ref<Role | null>(null);
const draft = reactive({ name: '', description: '', permissions: [] as string[] });
const errors = ref<{ name?: string }>({});
const busy = ref(false);
const editable = computed(() => (editing.value ? can('edit') : can('create')));

function openRole(role: Role | null): void {
  if (role?.slug === ADMIN_ROLE_SLUG) return;
  editing.value = role;
  Object.assign(draft, { name: role?.name ?? '', description: role?.description ?? '', permissions: [...(role?.permissions ?? [])] });
  errors.value = {};
  open.value = true;
}

function toggle(slug: string, on: boolean): void {
  draft.permissions = on ? [...new Set([...draft.permissions, slug])] : draft.permissions.filter((item) => item !== slug);
}

function toggleGroup(permissions: Permission[]): void {
  const all = permissions.every((permission) => draft.permissions.includes(permission.slug));
  for (const permission of permissions) toggle(permission.slug, !all);
}

// The role's fixed key, from its first name: accents dropped, anything else a dash.
// A name with no Latin letters (Arabic, say) still gets a key of its own.
const slugOf = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) ||
  `peran-${Date.now().toString(36)}`;

async function save(): Promise<void> {
  if (busy.value || !editable.value) return;
  const name = draft.name.trim();
  errors.value = { name: name.length >= 2 ? undefined : 'Isi nama peran, minimal 2 huruf.' };
  if (!editing.value && slugOf(name).length < 2) errors.value = { name: 'Gunakan huruf atau angka untuk nama peran.' };
  if (errors.value.name) return;
  busy.value = true;
  const description = draft.description.trim() || null;
  const saved = editing.value
    ? await accountClient.saveRole(editing.value.id, { revision: editing.value.revision, name, description, permissions: draft.permissions })
    : await accountClient.createRole({ name, slug: slugOf(name), description, permissions: draft.permissions });
  busy.value = false;
  if (saved.ok) {
    open.value = false;
    showToast(`Peran ${roleLabel(saved.data.role)} disimpan`, 'good');
    await state.reload();
    await session.refresh();
  } else if (saved.code === 'STALE_REVISION') {
    showToast('Peran ini baru saja diubah dari perangkat lain. Periksa, lalu simpan lagi.', 'warn');
    await state.reload();
    editing.value = state.data.value?.roles.find((role) => role.id === editing.value?.id) ?? null;
  } else if (saved.code === 'DUPLICATE_SLUG') errors.value = { name: refusalText(saved) };
  else showToast(refusalText(saved), 'bad');
}

const removing = ref<Role | null>(null);
function openRemove(): void {
  removing.value = editing.value;
  open.value = false;
}

async function remove(): Promise<void> {
  const role = removing.value;
  if (!role || busy.value) return;
  busy.value = true;
  const done = await accountClient.deleteRole(role.id);
  busy.value = false;
  removing.value = null;
  if (done.ok) {
    showToast(`Peran ${roleLabel(role)} dihapus`, 'good');
    await state.reload();
    await session.refresh();
  } else showToast(refusalText(done), 'bad');
}
</script>

<template>
  <AbPage title="Peran & izin" description="Peran menentukan halaman dan tombol yang bisa dipakai seseorang. Berikan peran dari halaman Pengguna." data-testid="roles-page">
    <template #actions>
      <AbButton v-if="can('create')" @click="openRole(null)"><Plus />Peran baru</AbButton>
    </template>

    <AbCard flush>
      <div v-if="!state.data.value && state.loading.value" class="rl-center"><AbSpinner /></div>
      <AbEmpty v-else-if="!state.data.value" title="Peran belum bisa dimuat" :text="state.error.value ?? undefined" :icon="KeyRound">
        <AbButton variant="outline" @click="state.reload()">Coba lagi</AbButton>
      </AbEmpty>
      <table v-else class="ab-table">
        <thead>
          <tr><th>Peran</th><th>Izin</th><th>Pengguna</th><th class="ab-table-end"><span class="ab-visually-hidden">Tindakan</span></th></tr>
        </thead>
        <tbody>
          <tr
            v-for="role in roles"
            :key="role.id"
            :data-role-slug="role.slug"
            :data-clickable="role.slug !== 'admin' || undefined"
            @click="openRole(role)"
          >
            <td><b>{{ roleLabel(role) }}</b><span v-if="roleNote(role)" class="ab-table-sub">{{ roleNote(role) }}</span></td>
            <td class="num">{{ role.slug === 'admin' ? 'Semua izin' : `${role.permissions.length} izin` }}</td>
            <td class="num">{{ role.userCount }} pengguna</td>
            <td class="ab-table-end">
              <AbButton v-if="role.slug !== 'admin'" variant="outline" size="sm" :aria-label="`Buka ${roleLabel(role)}`" @click.stop="openRole(role)">{{ can('edit') ? 'Ubah' : 'Lihat' }}</AbButton>
            </td>
          </tr>
        </tbody>
      </table>
    </AbCard>

    <AbDialog :open="open" :title="editing ? roleLabel(editing) : 'Peran baru'" size="lg" :persistent="busy" @close="open = false">
      <form id="rl-form" class="rl-form" novalidate @submit.prevent="save">
        <div class="rl-fields">
          <AbField v-model="draft.name" label="Nama peran" autocomplete="off" placeholder="Misal: Operator TU" :error="errors.name" :disabled="!editable" />
          <AbField v-model="draft.description" label="Keterangan" autocomplete="off" placeholder="Untuk siapa peran ini" :maxlength="500" :disabled="!editable" />
        </div>
        <div v-if="!catalog.data.value" class="rl-center"><AbSpinner /></div>
        <section v-for="group in groups" :key="group.resource" class="rl-group">
          <header class="rl-group-head">
            <h3>{{ group.label }}</h3>
            <button v-if="editable" type="button" class="rl-group-all" @click="toggleGroup(group.permissions)">
              {{ group.permissions.every((permission) => draft.permissions.includes(permission.slug)) ? 'Kosongkan' : 'Pilih semua' }}
            </button>
          </header>
          <div v-for="permission in group.permissions" :key="permission.id" class="rl-permission" :data-permission-slug="permission.slug">
            <span>{{ permissionLabel(permission) }}</span>
            <AbSwitch
              :label="permissionLabel(permission)"
              :model-value="draft.permissions.includes(permission.slug)"
              :disabled="!editable"
              @update:model-value="toggle(permission.slug, $event)"
            />
          </div>
        </section>
        <div v-if="editing && can('delete')" class="rl-danger">
          <AbButton variant="danger" @click="openRemove">Hapus peran</AbButton>
        </div>
      </form>
      <template #footer>
        <AbButton variant="outline" :disabled="busy" @click="open = false">{{ editable ? 'Batal' : 'Tutup' }}</AbButton>
        <AbButton v-if="editable" type="submit" form="rl-form" :loading="busy">Simpan</AbButton>
      </template>
    </AbDialog>

    <AbDialog :open="removing !== null" :title="`Hapus ${removing ? roleLabel(removing) : ''}?`" size="sm" :persistent="busy" @close="removing = null">
      <p class="rl-text">{{ removing?.userCount ? `${removing.userCount} pengguna akan kehilangan peran ini beserta izinnya.` : 'Belum ada pengguna dengan peran ini.' }}</p>
      <template #footer>
        <AbButton variant="outline" :disabled="busy" @click="removing = null">Batal</AbButton>
        <AbButton variant="danger" :loading="busy" @click="remove">Hapus</AbButton>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.rl-center { display: grid; padding: 40px 0; place-items: center; }
.rl-form { display: grid; gap: 22px; }
.rl-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rl-group { border: 1px solid var(--ab-line); border-radius: 16px; }
.rl-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--ab-line); background: #FBF9F4; border-radius: 16px 16px 0 0; }
.rl-group-head h3 { margin: 0; font-size: 15px; font-weight: 800; }
.rl-group-all { padding: 4px 8px; border-radius: 8px; color: var(--ab-forest); font-size: 13.5px; font-weight: 800; }
.rl-group-all:hover { background: var(--ab-paper-2); }
.rl-permission { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 16px; border-top: 1px solid var(--ab-line); font-size: 14.5px; }
.rl-group-head + .rl-permission { border-top: 0; }
.rl-danger { padding-top: 4px; }
.rl-text { margin: 0; color: var(--ab-ink-2); }
@media (max-width: 719px) { .rl-fields { grid-template-columns: 1fr; } }
</style>
