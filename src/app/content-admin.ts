import {
  Award,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  HelpCircle,
  Images,
  Landmark,
  MessageSquareQuote,
  Newspaper,
  School,
  Sparkles,
  UserRound,
  Building,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import { CONTENT_TYPES, PORTAL_INFO, type ContentEntry, type ContentType, type Portal } from '../features/content/web';
import { dateShort } from '../shared/ui';

/** What the admin's content screens share: icons, route names and the one-line facts under an entry. */
export const PORTAL_ICON: Record<Portal, Component> = { yayasan: Landmark, smp: School, sma: GraduationCap };

export const PORTAL_LABEL: Record<Portal, string> = { yayasan: 'Situs Yayasan', smp: 'Portal SMP', sma: 'Portal SMA' };

export const TYPE_ICON: Record<ContentType, Component> = {
  berita: Newspaper,
  agenda: CalendarDays,
  galeri: Images,
  prestasi: Award,
  fasilitas: Building,
  guru: UserRound,
  dokumen: FileText,
  ekskul: Sparkles,
  akademik: BookOpen,
  faq: HelpCircle,
  alumni: GraduationCap,
  testimoni: MessageSquareQuote,
};

/** Route names under one portal's admin. */
export function portalRoute(portal: Portal) {
  const base = `portal-${portal}`;
  return { home: base, settings: `${base}-settings`, entries: `${base}-entries`, create: `${base}-new`, entry: `${base}-entry` };
}

/** The facts shown under an entry in a list: its date and the fields that identify it. */
export function entryFacts(entry: Pick<ContentEntry, 'type' | 'date' | 'fields'>): string {
  const def = CONTENT_TYPES[entry.type];
  const parts: string[] = [];
  if ('date' in def) parts.push(entry.date ? dateShort(entry.date) : entry.type === 'agenda' ? 'Tanggal segera' : 'Tanpa tanggal');
  for (const field of def.fields) {
    const value = entry.fields[field.key];
    if (value && field.key !== 'video') parts.push(value);
  }
  return parts.join(' · ');
}

export const portalName = (portal: Portal) => PORTAL_INFO[portal].name;
