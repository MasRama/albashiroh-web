import { History, Images, KeyRound, LayoutDashboard, UsersRound } from 'lucide-vue-next';
import { createRouter, createWebHistory, type RouteLocationNormalized, type RouteRecordRaw, type RouterScrollBehavior } from 'vue-router';
import { activityAccess } from '../features/activity/web';
import { rolesAccess, useAuthSession } from '../features/auth/web';
import { usersAccess } from '../features/users/web';
import { mediaAccess } from '../features/media/web';
import { contentAccess, PORTALS, type Portal } from '../features/content/web';
import { PORTAL_ICON, PORTAL_LABEL, portalRoute } from './content-admin';
import { canEnter } from './navigation';
import SiteNotFound from './pages/site/SiteNotFound.vue';
import { siteRoutes } from './site-routes';

// The admin loads on first visit, so a visitor to the public site never downloads it (nor the article editor).
const ActivityPage = () => import('./pages/admin/ActivityPage.vue');
const DashboardPage = () => import('./pages/admin/DashboardPage.vue');
const MediaPage = () => import('./pages/admin/MediaPage.vue');
const PasswordPage = () => import('./pages/admin/PasswordPage.vue');
const ProfilePage = () => import('./pages/admin/ProfilePage.vue');
const RolesPage = () => import('./pages/admin/RolesPage.vue');
const SecurityPage = () => import('./pages/admin/SecurityPage.vue');
const SignInPage = () => import('./pages/admin/SignInPage.vue');
const UsersPage = () => import('./pages/admin/UsersPage.vue');
const PortalPage = () => import('./pages/admin/PortalPage.vue');
const PortalSettingsPage = () => import('./pages/admin/PortalSettingsPage.vue');
const EntriesPage = () => import('./pages/admin/EntriesPage.vue');
const EntryPage = () => import('./pages/admin/EntryPage.vue');

/**
 * Each portal's content screens, under the permission that portal's API
 * enforces: its overview (the sidebar entry), settings, and its entries.
 */
function portalRoutes(portal: Portal): RouteRecordRaw[] {
  const names = portalRoute(portal);
  const meta = (extra: { label?: string; icon?: typeof PORTAL_ICON[Portal] } = {}) => ({
    requiresAuth: true,
    requiresAccess: contentAccess('content')[portal],
    admin: { group: 'content' as const, section: names.home, ...extra },
  });
  const type = (route: RouteLocationNormalized) => String(route.params.type);
  return [
    { path: `/admin/${portal}`, name: names.home, component: PortalPage, props: { portal }, meta: meta({ label: PORTAL_LABEL[portal], icon: PORTAL_ICON[portal] }) },
    { path: `/admin/${portal}/pengaturan`, name: names.settings, component: PortalSettingsPage, props: { portal }, meta: meta() },
    { path: `/admin/${portal}/:type`, name: names.entries, component: EntriesPage, props: (route) => ({ portal, type: type(route) }), meta: meta() },
    { path: `/admin/${portal}/:type/baru`, name: names.create, component: EntryPage, props: (route) => ({ portal, type: type(route), id: null }), meta: meta() },
    { path: `/admin/${portal}/:type/:id`, name: names.entry, component: EntryPage, props: (route) => ({ portal, type: type(route), id: String(route.params.id) }), meta: meta() },
  ];
}

export const appRoutes = [
  // The public site: the Yayasan at the root, each school under /smp and /sma.
  ...siteRoutes(),
  {
    path: '/admin/masuk',
    alias: '/login',
    name: 'login',
    component: SignInPage,
    meta: { guestOnly: true },
  },
  {
    // Outside the admin shell: a forced change must happen before anything else.
    path: '/admin/kata-sandi',
    name: 'change-password',
    component: PasswordPage,
    meta: { requiresAuth: true },
  },
  // The admin panel, in the admin shell. Routes with `admin.label` are listed
  // in its sidebar in this order, under the rule their API enforces.
  {
    path: '/admin',
    name: 'dashboard',
    component: DashboardPage,
    meta: { requiresAuth: true, admin: { group: 'main', label: 'Beranda', icon: LayoutDashboard } },
  },
  ...PORTALS.flatMap(portalRoutes),
  {
    path: '/admin/media',
    name: 'media',
    component: MediaPage,
    meta: { requiresAuth: true, requiresAccess: mediaAccess('media').view, admin: { group: 'content', label: 'Media', icon: Images } },
  },
  {
    path: '/admin/pengguna',
    name: 'users',
    component: UsersPage,
    meta: { requiresAuth: true, requiresAccess: usersAccess('users').manage('view'), admin: { group: 'system', label: 'Pengguna', icon: UsersRound } },
  },
  {
    path: '/admin/peran',
    name: 'roles',
    component: RolesPage,
    meta: { requiresAuth: true, requiresAccess: rolesAccess('view'), admin: { group: 'system', label: 'Peran & izin', icon: KeyRound } },
  },
  {
    path: '/admin/aktivitas',
    name: 'activity',
    component: ActivityPage,
    meta: { requiresAuth: true, requiresAccess: activityAccess('activity').view, admin: { group: 'system', label: 'Aktivitas', icon: History } },
  },
  {
    path: '/admin/profil',
    name: 'profile',
    component: ProfilePage,
    meta: { requiresAuth: true, admin: { group: 'system' } },
  },
  {
    path: '/admin/keamanan',
    name: 'security',
    component: SecurityPage,
    meta: { requiresAuth: true, admin: { group: 'system' } },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: SiteNotFound,
    meta: { site: { portal: 'yayasan' } },
  },
] satisfies RouteRecordRaw[];

export const appScrollBehavior: RouterScrollBehavior = (to, _from, savedPosition) => {
  if (savedPosition) return savedPosition;
  if (to.hash) return { el: to.hash };
  return { top: 0 };
};

const router = createRouter({
  history: createWebHistory(),
  routes: appRoutes,
  scrollBehavior: appScrollBehavior,
});

const authSession = useAuthSession();

router.beforeEach(async (to) => {
  // The public site needs no session: visitors never wait on the auth check.
  if (to.meta.site) return true;
  try {
    // Protected and guest-only destinations need a fresh server decision so
    // revoked/expired sessions and permission changes take effect on the next
    // navigation. Public pages only need the one-time bootstrap.
    if (to.meta.requiresAuth || to.meta.guestOnly) await authSession.refresh();
    else await authSession.load();
  } catch {
    // A transient server/network failure must not erase a previously valid
    // browser session. If no authenticated state has ever been established,
    // cancel protected navigation rather than converting uncertainty into a
    // logout redirect.
    if (to.meta.requiresAuth && !authSession.isAuthenticated.value) return false;
  }

  if (to.meta.requiresAuth && !authSession.isAuthenticated.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (
    authSession.isAuthenticated.value &&
    authSession.user.value?.mustChangePassword === true &&
    to.name !== 'change-password'
  ) {
    return { name: 'change-password' };
  }
  if (!canEnter(to.meta, authSession.allows)) {
    return { name: 'dashboard' };
  }

  if (to.meta.guestOnly && authSession.isAuthenticated.value) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
