import { History, Images, KeyRound, LayoutDashboard, UsersRound } from 'lucide-vue-next';
import { createRouter, createWebHistory, type RouteRecordRaw, type RouterScrollBehavior } from 'vue-router';
import { activityAccess } from '../features/activity/web';
import { rolesAccess, useAuthSession } from '../features/auth/web';
import { usersAccess } from '../features/users/web';
import { mediaAccess } from '../features/media/web';
import { canEnter } from './navigation';
import ActivityPage from './pages/admin/ActivityPage.vue';
import DashboardPage from './pages/admin/DashboardPage.vue';
import MediaPage from './pages/admin/MediaPage.vue';
import PasswordPage from './pages/admin/PasswordPage.vue';
import ProfilePage from './pages/admin/ProfilePage.vue';
import RolesPage from './pages/admin/RolesPage.vue';
import SecurityPage from './pages/admin/SecurityPage.vue';
import SignInPage from './pages/admin/SignInPage.vue';
import UsersPage from './pages/admin/UsersPage.vue';
import HomePage from './pages/HomePage.vue';
import NotFoundPage from './pages/NotFoundPage.vue';

export const appRoutes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
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
    component: NotFoundPage,
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
