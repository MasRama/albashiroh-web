import { describe, expect, it } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { adminNavigation, canEnter, sectionOf } from '../navigation';
import { ADMINISTRATOR, type AccessRule } from '../../shared/security/access';

const Page = { render: () => null };

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Page },
  { path: '/admin', name: 'dashboard', component: Page, meta: { requiresAuth: true, admin: { group: 'main', label: 'Beranda' } } },
  { path: '/admin/pengguna', name: 'users', component: Page, meta: { requiresAuth: true, requiresAccess: { permission: 'users.view' }, admin: { group: 'system', label: 'Pengguna' } } },
  { path: '/admin/peran', name: 'roles', component: Page, meta: { requiresAuth: true, requiresAccess: { permission: 'roles.view' }, admin: { group: 'system', label: 'Peran & izin' } } },
  { path: '/admin/profil', name: 'profile', component: Page, meta: { requiresAuth: true, admin: { group: 'system' } } },
  { path: '/admin/pengguna/baru', name: 'user-new', component: Page, meta: { requiresAuth: true, admin: { group: 'system', section: 'users' } } },
];

describe('admin navigation', () => {
  it('lists labelled admin routes under their group, in route order', () => {
    expect(adminNavigation(routes, () => true).map((group) => [group.label, group.links.map((link) => link.name)])).toEqual([
      [null, ['dashboard']],
      ['Sistem', ['users', 'roles']],
    ]);
  });

  it('skips routes whose rule the session does not meet, and groups left empty', () => {
    const granted = new Set(['roles.view']);
    const allows = (rule: AccessRule) => 'permission' in rule && granted.has(rule.permission);
    expect(adminNavigation(routes, allows).flatMap((group) => group.links.map((link) => link.name))).toEqual(['dashboard', 'roles']);
    expect(adminNavigation(routes.slice(0, 2), allows).map((group) => group.key)).toEqual(['main']);
  });

  it('lets a screen light the entry it sits under', () => {
    const meta = (name: string) => routes.find((route) => route.name === name)!.meta!;
    expect(sectionOf({ name: 'user-new', meta: meta('user-new') })).toBe('users');
    expect(sectionOf({ name: 'users', meta: meta('users') })).toBe('users');
  });

  it('canEnter allows routes without a rule and checks the one they require', () => {
    expect(canEnter({}, () => false)).toBe(true);
    expect(canEnter({ requiresAccess: { permission: 'reports.view' } }, () => false)).toBe(false);
    expect(canEnter({ requiresAccess: ADMINISTRATOR }, (rule) => rule === ADMINISTRATOR)).toBe(true);
  });
});
