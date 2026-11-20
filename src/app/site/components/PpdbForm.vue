<script setup lang="ts">
import { ArrowRight, CheckCircle2, Copy, LoaderCircle, MessageCircle, Users } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw } from 'vue';
import {
  applicationInputSchema,
  BOARDING,
  BOARDING_LABEL,
  EDUCATION,
  GENDER_LABEL,
  GENDERS,
  INCOMES,
  JOBS,
  LEVEL_LABEL,
  MIN_FILL_MS,
  PAYMENT_LABEL,
  PAYMENTS,
  type ApplicationInput,
  type Level,
  type PpdbForm,
  type PpdbFormClient,
  type Receipt,
} from '../../../features/ppdb/web';

/**
 * The online registration, in the order of the school's paper form: the
 * student, father, mother, address and the two choices. The browser checks
 * it with the same rules as the server, so mistakes show before sending; a
 * refused send keeps everything the family typed.
 */
const props = defineProps<{
  level: Level;
  form: PpdbForm;
  client: PpdbFormClient;
  /** Fetches a fresh form token; null when the form could not be opened. */
  refresh: () => Promise<PpdbForm | null>;
  whatsapp: string | null;
}>();
const emit = defineEmits<{ level: [level: Level] }>();

type Parent = { name: string; nik: string; birthYear: string; education: string; job: string; income: string };
const blankParent = (): Parent => ({ name: '', nik: '', birthYear: '', education: '', job: '', income: '' });
const blankStudent = () => ({ name: '', birthPlace: '', birthDate: '', gender: '', nisn: '', previousSchool: '' });
const values = reactive({
  student: blankStudent(),
  father: blankParent(),
  mother: blankParent(),
  address: '',
  postalCode: '',
  phone: '',
  boarding: '',
  payment: '',
});
// People never see this field; form-filling scripts do, and fill it.
const website = ref('');
const errors = ref<Record<string, string>>({});
const notice = ref<string | null>(null);
const sending = ref(false);
const receipt = ref<Receipt | null>(null);
const touched = ref(false);
const root = ref<HTMLElement | null>(null);

const PARENTS = [
  { key: 'father', title: 'Data ayah', label: 'ayah' },
  { key: 'mother', title: 'Data ibu', label: 'ibu' },
] as const;
const id = (path: string) => `pf-${path.replace(/\./g, '-')}`;
const err = (path: string) => errors.value[path];

function clear(path: string): void {
  touched.value = true;
  if (errors.value[path]) {
    const next = { ...errors.value };
    delete next[path];
    errors.value = next;
  }
}

function input(): ApplicationInput {
  // The plain values under the form's proxy: the browser cannot clone a reactive object.
  return { ...structuredClone(toRaw(values)), level: props.level, website: website.value, token: props.form.token } as unknown as ApplicationInput;
}

async function showFirstError(): Promise<void> {
  await nextTick();
  const first = Object.keys(errors.value)
    .map((path) => document.getElementById(id(path)))
    .filter((element): element is HTMLElement => element !== null)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
  first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  first?.focus({ preventScroll: true });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(token: string, retried = false): Promise<void> {
  const result = await props.client.submit({ ...input(), token });
  if (result.ok) {
    receipt.value = result.receipt;
    touched.value = false;
    await nextTick();
    root.value?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  if (result.code === 'FORM_EXPIRED' && !retried) {
    // The page stayed open for hours: take a fresh form and send again once it is old enough to be accepted.
    const fresh = await props.refresh();
    if (fresh?.open) {
      await wait(MIN_FILL_MS + 500);
      return send(fresh.token, true);
    }
  }
  if (result.code === 'VALIDATION_ERROR') {
    errors.value = Object.fromEntries(Object.entries(result.errors).map(([path, messages]) => [path, messages[0] ?? 'Periksa isian ini']));
    notice.value = 'Ada isian yang perlu diperbaiki. Lihat tanda merah di formulir.';
    return showFirstError();
  }
  if (result.code === 'ALREADY_REGISTERED') {
    errors.value = { 'student.nisn': `NISN ini sudah terdaftar di ${LEVEL_LABEL[props.level]} tahun ajaran ini.` };
    notice.value = 'Calon siswa dengan NISN ini sudah terdaftar. Bila ada data yang salah, hubungi panitia lewat WhatsApp.';
    return showFirstError();
  }
  if (result.code === 'PPDB_CLOSED') {
    await props.refresh();
    notice.value = 'Pendaftaran online baru saja ditutup panitia. Hubungi panitia lewat WhatsApp.';
    return;
  }
  if (result.status === 429) {
    notice.value = 'Terlalu banyak pendaftaran dari jaringan ini dalam satu jam. Coba lagi nanti, atau hubungi panitia.';
    return;
  }
  if (result.code === 'NETWORK') {
    notice.value = 'Koneksi terputus. Isian Anda masih ada; periksa internet lalu tekan Kirim lagi.';
    return;
  }
  // A refused or broken send: take a fresh form so the next press can go through.
  await props.refresh();
  notice.value = 'Pendaftaran belum terkirim. Isian Anda masih ada; tunggu sebentar lalu tekan Kirim lagi.';
}

async function submit(): Promise<void> {
  if (sending.value) return;
  notice.value = null;
  const parsed = applicationInputSchema.safeParse(input());
  if (!parsed.success) {
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      next[path] ??= issue.message;
    }
    errors.value = next;
    notice.value = 'Ada isian yang perlu diperbaiki. Lihat tanda merah di formulir.';
    return showFirstError();
  }
  errors.value = {};
  sending.value = true;
  try {
    await send(props.form.token);
  } finally {
    sending.value = false;
  }
}

/** Another child of the same family: the parents, address and choices stay. */
async function again(): Promise<void> {
  Object.assign(values.student, blankStudent());
  receipt.value = null;
  errors.value = {};
  notice.value = null;
  await props.refresh();
  await nextTick();
  document.getElementById(id('student.name'))?.focus();
}

const copied = ref(false);
async function copyCode(): Promise<void> {
  if (!receipt.value) return;
  try {
    await navigator.clipboard.writeText(receipt.value.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Without clipboard access the code is still on screen to write down.
  }
}

const registeredAt = computed(() =>
  receipt.value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(receipt.value.createdAt) + ' WIB' : '',
);
const thisYear = new Date().getFullYear();

const beforeUnload = (event: BeforeUnloadEvent) => {
  if (touched.value && !receipt.value) event.preventDefault();
};
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>

<template>
  <div ref="root" class="pf" :class="`pf--${level}`">
    <div v-if="receipt" class="pf-done" role="status" aria-live="polite">
      <CheckCircle2 :size="44" aria-hidden="true" class="pf-done-icon" />
      <h3>Pendaftaran terkirim.</h3>
      <p class="pf-done-lead">{{ receipt.name }} terdaftar sebagai calon siswa {{ LEVEL_LABEL[receipt.level] }} IT Al Bashiroh, {{ registeredAt }}.</p>
      <div class="pf-code">
        <span>Nomor pendaftaran</span>
        <b>{{ receipt.code }}</b>
        <button type="button" class="pf-copy" @click="copyCode"><Copy :size="16" aria-hidden="true" />{{ copied ? 'Tersalin' : 'Salin' }}</button>
      </div>
      <p class="pf-keep">Simpan atau screenshot nomor ini. Panitia memakainya untuk mencari data pendaftaran.</p>
      <section v-if="receipt.nextSteps" class="pf-next">
        <h4>Langkah berikutnya</h4>
        <p>{{ receipt.nextSteps }}</p>
      </section>
      <div class="pf-done-actions">
        <a v-if="receipt.groupLink" :href="receipt.groupLink" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--acc"><Users :size="18" aria-hidden="true" />Gabung grup WhatsApp wali</a>
        <a v-if="whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--line"><MessageCircle :size="18" aria-hidden="true" />Hubungi panitia</a>
      </div>
      <button type="button" class="pf-again" @click="again">Daftarkan anak lain <ArrowRight :size="16" aria-hidden="true" /></button>
    </div>

    <form v-else class="pf-form" novalidate @submit.prevent="submit">
      <div class="pf-levels" role="radiogroup" aria-label="Jenjang yang dituju">
        <button
          v-for="option in (['smp', 'sma'] as const)"
          :key="option"
          type="button"
          role="radio"
          class="pf-level"
          :class="[`pf-level--${option}`, { 'is-on': level === option }]"
          :aria-checked="level === option"
          @click="emit('level', option)"
        >
          {{ LEVEL_LABEL[option] }} IT Al Bashiroh
        </button>
      </div>

      <fieldset class="pf-part">
        <legend><span class="pf-step">1</span>Data calon siswa</legend>
        <div class="pf-grid">
          <label class="pf-field pf-wide" :class="{ 'is-bad': err('student.name') }">
            <span>Nama lengkap</span>
            <input :id="id('student.name')" v-model="values.student.name" autocomplete="off" maxlength="120" :aria-invalid="Boolean(err('student.name'))" @input="clear('student.name')" />
            <small v-if="err('student.name')" class="pf-error">{{ err('student.name') }}</small>
            <small v-else class="pf-hint">Sesuai akta kelahiran atau ijazah.</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err('student.birthPlace') }">
            <span>Tempat lahir</span>
            <input :id="id('student.birthPlace')" v-model="values.student.birthPlace" maxlength="80" :aria-invalid="Boolean(err('student.birthPlace'))" @input="clear('student.birthPlace')" />
            <small v-if="err('student.birthPlace')" class="pf-error">{{ err('student.birthPlace') }}</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err('student.birthDate') }">
            <span>Tanggal lahir</span>
            <input :id="id('student.birthDate')" v-model="values.student.birthDate" type="date" :max="`${thisYear - 8}-12-31`" :min="`${thisYear - 22}-01-01`" :aria-invalid="Boolean(err('student.birthDate'))" @input="clear('student.birthDate')" />
            <small v-if="err('student.birthDate')" class="pf-error">{{ err('student.birthDate') }}</small>
          </label>
          <div class="pf-field" :class="{ 'is-bad': err('student.gender') }">
            <span :id="id('student.gender-label')">Jenis kelamin</span>
            <div :id="id('student.gender')" class="pf-choices" role="radiogroup" :aria-labelledby="id('student.gender-label')" tabindex="-1">
              <label v-for="option in GENDERS" :key="option" class="pf-choice">
                <input v-model="values.student.gender" type="radio" name="gender" :value="option" @change="clear('student.gender')" />
                <span>{{ GENDER_LABEL[option] }}</span>
              </label>
            </div>
            <small v-if="err('student.gender')" class="pf-error">{{ err('student.gender') }}</small>
          </div>
          <label class="pf-field" :class="{ 'is-bad': err('student.nisn') }">
            <span>NISN</span>
            <input :id="id('student.nisn')" v-model="values.student.nisn" inputmode="numeric" maxlength="10" autocomplete="off" :aria-invalid="Boolean(err('student.nisn'))" @input="clear('student.nisn')" />
            <small v-if="err('student.nisn')" class="pf-error">{{ err('student.nisn') }}</small>
            <small v-else class="pf-hint">10 angka, ada di rapor atau ijazah.</small>
          </label>
          <label class="pf-field pf-wide" :class="{ 'is-bad': err('student.previousSchool') }">
            <span>Asal sekolah</span>
            <input :id="id('student.previousSchool')" v-model="values.student.previousSchool" maxlength="120" :placeholder="level === 'smp' ? 'SD / MI …' : 'SMP / MTs …'" :aria-invalid="Boolean(err('student.previousSchool'))" @input="clear('student.previousSchool')" />
            <small v-if="err('student.previousSchool')" class="pf-error">{{ err('student.previousSchool') }}</small>
          </label>
        </div>
      </fieldset>

      <fieldset v-for="(parent, index) in PARENTS" :key="parent.key" class="pf-part">
        <legend><span class="pf-step">{{ index + 2 }}</span>{{ parent.title }}</legend>
        <div class="pf-grid">
          <label class="pf-field pf-wide" :class="{ 'is-bad': err(`${parent.key}.name`) }">
            <span>Nama {{ parent.label }}</span>
            <input :id="id(`${parent.key}.name`)" v-model="values[parent.key].name" maxlength="120" :aria-invalid="Boolean(err(`${parent.key}.name`))" @input="clear(`${parent.key}.name`)" />
            <small v-if="err(`${parent.key}.name`)" class="pf-error">{{ err(`${parent.key}.name`) }}</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err(`${parent.key}.nik`) }">
            <span>NIK {{ parent.label }}</span>
            <input :id="id(`${parent.key}.nik`)" v-model="values[parent.key].nik" inputmode="numeric" maxlength="16" autocomplete="off" :aria-invalid="Boolean(err(`${parent.key}.nik`))" @input="clear(`${parent.key}.nik`)" />
            <small v-if="err(`${parent.key}.nik`)" class="pf-error">{{ err(`${parent.key}.nik`) }}</small>
            <small v-else class="pf-hint">16 angka, ada di KTP atau KK.</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err(`${parent.key}.birthYear`) }">
            <span>Tahun lahir {{ parent.label }}</span>
            <input :id="id(`${parent.key}.birthYear`)" v-model="values[parent.key].birthYear" inputmode="numeric" maxlength="4" placeholder="1980" :aria-invalid="Boolean(err(`${parent.key}.birthYear`))" @input="clear(`${parent.key}.birthYear`)" />
            <small v-if="err(`${parent.key}.birthYear`)" class="pf-error">{{ err(`${parent.key}.birthYear`) }}</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err(`${parent.key}.education`) }">
            <span>Pendidikan terakhir</span>
            <select :id="id(`${parent.key}.education`)" v-model="values[parent.key].education" :aria-invalid="Boolean(err(`${parent.key}.education`))" @change="clear(`${parent.key}.education`)">
              <option value="" disabled>Pilih</option>
              <option v-for="option in EDUCATION" :key="option" :value="option">{{ option }}</option>
            </select>
            <small v-if="err(`${parent.key}.education`)" class="pf-error">{{ err(`${parent.key}.education`) }}</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err(`${parent.key}.job`) }">
            <span>Pekerjaan</span>
            <select :id="id(`${parent.key}.job`)" v-model="values[parent.key].job" :aria-invalid="Boolean(err(`${parent.key}.job`))" @change="clear(`${parent.key}.job`)">
              <option value="" disabled>Pilih</option>
              <option v-for="option in JOBS" :key="option" :value="option">{{ option }}</option>
            </select>
            <small v-if="err(`${parent.key}.job`)" class="pf-error">{{ err(`${parent.key}.job`) }}</small>
          </label>
          <label class="pf-field pf-wide" :class="{ 'is-bad': err(`${parent.key}.income`) }">
            <span>Penghasilan per bulan</span>
            <select :id="id(`${parent.key}.income`)" v-model="values[parent.key].income" :aria-invalid="Boolean(err(`${parent.key}.income`))" @change="clear(`${parent.key}.income`)">
              <option value="" disabled>Pilih</option>
              <option v-for="option in INCOMES" :key="option" :value="option">{{ option }}</option>
            </select>
            <small v-if="err(`${parent.key}.income`)" class="pf-error">{{ err(`${parent.key}.income`) }}</small>
          </label>
        </div>
      </fieldset>

      <fieldset class="pf-part">
        <legend><span class="pf-step">4</span>Alamat dan kontak</legend>
        <div class="pf-grid">
          <label class="pf-field pf-wide" :class="{ 'is-bad': err('address') }">
            <span>Alamat rumah</span>
            <textarea :id="id('address')" v-model="values.address" rows="3" maxlength="400" autocomplete="street-address" :aria-invalid="Boolean(err('address'))" @input="clear('address')" />
            <small v-if="err('address')" class="pf-error">{{ err('address') }}</small>
            <small v-else class="pf-hint">Jalan, RT/RW, desa, kecamatan, kabupaten.</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err('postalCode') }">
            <span>Kode pos</span>
            <input :id="id('postalCode')" v-model="values.postalCode" inputmode="numeric" maxlength="5" autocomplete="postal-code" :aria-invalid="Boolean(err('postalCode'))" @input="clear('postalCode')" />
            <small v-if="err('postalCode')" class="pf-error">{{ err('postalCode') }}</small>
          </label>
          <label class="pf-field" :class="{ 'is-bad': err('phone') }">
            <span>Nomor HP / WhatsApp orang tua</span>
            <input :id="id('phone')" v-model="values.phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="0812 3456 7890" :aria-invalid="Boolean(err('phone'))" @input="clear('phone')" />
            <small v-if="err('phone')" class="pf-error">{{ err('phone') }}</small>
            <small v-else class="pf-hint">Panitia menghubungi lewat nomor ini.</small>
          </label>
        </div>
      </fieldset>

      <fieldset class="pf-part">
        <legend><span class="pf-step">5</span>Pilihan</legend>
        <div class="pf-grid">
          <div class="pf-field" :class="{ 'is-bad': err('boarding') }">
            <span :id="id('boarding-label')">Bersedia tinggal di asrama?</span>
            <div :id="id('boarding')" class="pf-choices" role="radiogroup" :aria-labelledby="id('boarding-label')" tabindex="-1">
              <label v-for="option in BOARDING" :key="option" class="pf-choice">
                <input v-model="values.boarding" type="radio" name="boarding" :value="option" @change="clear('boarding')" />
                <span>{{ BOARDING_LABEL[option] }}</span>
              </label>
            </div>
            <small v-if="err('boarding')" class="pf-error">{{ err('boarding') }}</small>
          </div>
          <div class="pf-field" :class="{ 'is-bad': err('payment') }">
            <span :id="id('payment-label')">Infaq pendaftaran dibayar</span>
            <div :id="id('payment')" class="pf-choices" role="radiogroup" :aria-labelledby="id('payment-label')" tabindex="-1">
              <label v-for="option in PAYMENTS" :key="option" class="pf-choice">
                <input v-model="values.payment" type="radio" name="payment" :value="option" @change="clear('payment')" />
                <span>{{ PAYMENT_LABEL[option] }}</span>
              </label>
            </div>
            <small v-if="err('payment')" class="pf-error">{{ err('payment') }}</small>
            <small v-else class="pf-hint">Cara dan nomor rekening tampil setelah formulir terkirim.</small>
          </div>
        </div>
      </fieldset>

      <div class="pf-trap" aria-hidden="true">
        <label>Website <input v-model="website" name="website" tabindex="-1" autocomplete="off" /></label>
      </div>

      <p v-if="notice" class="pf-notice" role="alert">{{ notice }}</p>
      <div class="pf-send">
        <button type="submit" class="s-btn s-btn--acc pf-submit" :disabled="sending">
          <LoaderCircle v-if="sending" :size="18" class="pf-spin" aria-hidden="true" />
          {{ sending ? 'Mengirim…' : `Kirim pendaftaran ${LEVEL_LABEL[level]}` }}
        </button>
        <p>Data hanya dipakai panitia PPDB Al Bashiroh untuk seleksi dan pendataan siswa.</p>
      </div>
    </form>
  </div>
</template>

<style scoped>
.pf { --pf-acc: var(--ab-smp); --pf-acc-deep: var(--ab-smp-deep); --pf-soft: var(--ab-green-soft); scroll-margin-top: 110px; }
.pf--sma { --pf-acc: var(--ab-sma); --pf-acc-deep: var(--ab-sma-deep); --pf-soft: #FFF1E6; }
.pf .s-btn--acc { background: var(--pf-acc); }
.pf .s-btn--acc:hover { background: var(--pf-acc-deep); }
.pf-form { display: grid; gap: 14px; }

.pf-levels { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 6px; border: 1px solid var(--ab-line); border-radius: 18px; background: #fff; }
.pf-level { height: 50px; border-radius: 13px; color: var(--ab-ink-2); font-size: 15px; font-weight: 800; }
.pf-level.is-on { color: #fff; }
.pf-level--smp.is-on { background: var(--ab-smp); }
.pf-level--sma.is-on { background: var(--ab-sma); }

.pf-part { margin: 0; padding: 30px 32px 32px; border: 1px solid var(--ab-line); border-radius: 24px; background: #fff; }
.pf-part legend { float: left; display: flex; width: 100%; align-items: center; gap: 12px; margin-bottom: 20px; padding: 0; font-family: var(--ab-display); font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.pf-part legend + * { clear: both; }
.pf-step { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 10px; background: var(--pf-acc); color: #fff; font-family: var(--ab-font); font-size: 15px; }
.pf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 16px; }
.pf-wide { grid-column: 1 / -1; }

.pf-field { display: grid; align-content: start; gap: 7px; min-width: 0; }
.pf-field > span { font-size: 14.5px; font-weight: 700; }
.pf-field input:not([type='radio']), .pf-field select, .pf-field textarea {
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  border: 1.5px solid var(--ab-line-strong);
  border-radius: 14px;
  background: #fff;
  font-size: 16px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.pf-field textarea { padding: 14px 16px; line-height: 1.5; resize: vertical; }
.pf-field select { appearance: none; padding-right: 44px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2313211A' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-position: right 14px center; background-repeat: no-repeat; }
.pf-field select:has(option[value='']:checked) { color: var(--ab-mute); }
.pf-field select option { color: var(--ab-ink); }
.pf-field input:focus, .pf-field select:focus, .pf-field textarea:focus { border-color: var(--pf-acc); box-shadow: 0 0 0 3px var(--pf-soft); }
.pf-field.is-bad input:not([type='radio']), .pf-field.is-bad select, .pf-field.is-bad textarea { border-color: var(--ab-red); }
.pf-hint { color: var(--ab-mute); font-size: 13px; }
.pf-error { color: var(--ab-red); font-size: 13px; font-weight: 700; }

.pf-choices { display: flex; flex-wrap: wrap; gap: 8px; outline: none; }
.pf-choice { position: relative; flex: 1 1 140px; }
.pf-choice input { position: absolute; opacity: 0; pointer-events: none; }
.pf-choice span { display: flex; min-height: 52px; align-items: center; justify-content: center; padding: 8px 14px; border: 1.5px solid var(--ab-line-strong); border-radius: 14px; font-size: 15px; font-weight: 700; text-align: center; cursor: pointer; transition: border-color .15s, background-color .15s; }
.pf-choice span:hover { border-color: var(--pf-acc); }
.pf-choice input:checked + span { border-color: var(--pf-acc); background: var(--pf-acc); color: #fff; }
.pf-choice input:focus-visible + span { box-shadow: 0 0 0 3px var(--pf-soft); }
.pf-field.is-bad .pf-choice span { border-color: var(--ab-red); }

.pf-trap { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pf-notice { margin: 0; padding: 14px 18px; border-radius: 14px; background: var(--ab-red-soft); color: var(--ab-red); font-size: 15px; font-weight: 700; }
.pf-send { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 20px; margin-top: 6px; }
.pf-send p { flex: 1 1 240px; margin: 0; color: var(--ab-mute); font-size: 13.5px; }
.pf-submit { min-width: 260px; height: 58px; font-size: 16px; }
.pf-submit:disabled { opacity: .75; cursor: progress; }
.pf-spin { animation: pf-spin 1s linear infinite; }
@keyframes pf-spin { to { transform: rotate(360deg); } }

.pf-done { padding: 40px 44px; border-radius: 28px; background: #fff; border: 1px solid var(--ab-line); }
.pf-done-icon { color: var(--pf-acc); }
.pf-done h3 { margin: 14px 0 0; font-family: var(--ab-display); font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
.pf-done-lead { margin: 10px 0 0; color: var(--ab-ink-2); font-size: 16.5px; }
.pf-code { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin-top: 24px; padding: 20px 22px; border-radius: 20px; background: var(--pf-acc); color: #fff; }
.pf-code span { flex-basis: 100%; font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .85; }
.pf-code b { font-family: var(--ab-display); font-size: 36px; font-weight: 800; letter-spacing: -.01em; line-height: 1.1; }
.pf-copy { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; padding: 9px 14px; border-radius: 11px; background: #fff; color: var(--ab-ink); font-size: 14px; font-weight: 800; }
.pf-keep { margin: 12px 0 0; color: var(--ab-mute); font-size: 14px; }
.pf-next { margin-top: 24px; padding: 22px 24px; border-radius: 20px; background: var(--ab-paper); }
.pf-next h4 { margin: 0; font-size: 16px; font-weight: 800; }
.pf-next p { margin: 8px 0 0; overflow-wrap: anywhere; font-size: 15.5px; white-space: pre-line; }
.pf-done-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.pf-again { display: inline-flex; align-items: center; gap: 6px; margin-top: 22px; color: var(--ab-ink); font-size: 15px; font-weight: 800; text-decoration: underline; text-underline-offset: 4px; }

@media (max-width: 640px) {
  .pf-part { padding: 22px 18px 24px; border-radius: 20px; }
  .pf-part legend { font-size: 19px; }
  .pf-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .pf-level { font-size: 13.5px; }
  .pf-submit { width: 100%; min-width: 0; }
  .pf-done { padding: 28px 20px; border-radius: 22px; }
  .pf-done h3 { font-size: 28px; }
  .pf-code b { font-size: 28px; }
  .pf-done-actions .s-btn { width: 100%; }
}
</style>
