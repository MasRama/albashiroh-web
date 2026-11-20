import type { Component } from 'vue';
import type { RouteMeta, RouteRecordRaw } from 'vue-router';
import type { AccessRule } from '../shared/security/access';

/** The admin sidebar's groups, in the order they show. */
export const ADMIN_GROUPS = [
  { key: 'main', label: null },
  { key: 'system', label: 'Sistem' },
] as const;
export type AdminGroup = (typeof ADMIN_GROUPS)[number]['key'];

declare module 'vue-router' {
  interface RouteMeta {
    /** The rule the session must meet, the one the page's API enforces; the router guard and navigation both read it. */
    requiresAccess?: AccessRule;
    /** An admin screen: rendered in the admin shell. With `label` it is listed in the sidebar under `group`. */
    admin?: { group: AdminGroup; label?: string; icon?: Component; section?: string };
  }
}

export interface AdminLink {
  name: string;
  label: string;
  icon?: Component;
  /** The sidebar entry this route lights; screens below an entry share it. */
  section: string;
}

type Allows = (rule: AccessRule) => boolean;

/** The sidebar entry a route lights: its own, or the one named in `admin.section`. */
export function sectionOf(route: { name?: unknown; meta: RouteMeta }): string | undefined {
  return route.meta.admin?.section ?? (typeof route.name === 'string' ? route.name : undefined);
}

export function canEnter(meta: RouteMeta, allows: Allows): boolean {
  return meta.requiresAccess === undefined || allows(meta.requiresAccess);
}

/**
 * The sidebar comes from the routes: each admin route with a label is an
 * entry under its group, in route order, shown when the session meets the
 * rule its API enforces. Groups with no entry the session may open are left
 * out.
 */
export function adminNavigation(routes: readonly RouteRecordRaw[], allows: Allows): { key: AdminGroup; label: string | null; links: AdminLink[] }[] {
  return ADMIN_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    links: routes.flatMap((route) => {
      const admin = route.meta?.admin;
      if (!admin?.label || admin.group !== group.key || typeof route.name !== 'string' || !canEnter(route.meta!, allows)) return [];
      return [{ name: route.name, label: admin.label, icon: admin.icon, section: sectionOf({ name: route.name, meta: route.meta! })! }];
    }),
  })).filter((group) => group.links.length > 0);
}
