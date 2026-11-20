import type { RouteComponent, RouteRecordRaw } from 'vue-router';
import SchoolHome from './pages/site/SchoolHome.vue';
import YayasanHome from './pages/site/YayasanHome.vue';
import { sitePath, siteRouteName, SITE_PAGES, type SitePage, type SitePortal } from './site-map';

/**
 * The public site's browser routes, made from the same page list the server
 * reads for titles, status codes and the sitemap, so the two never disagree.
 * Home pages ship in the first download; the inner pages load on first visit.
 */
const ListPage = () => import('./pages/site/ListPage.vue');
const EntryPage = () => import('./pages/site/EntryPage.vue');
const ProfilPage = () => import('./pages/site/ProfilPage.vue');
const ProgramPage = () => import('./pages/site/ProgramPage.vue');
const KontakPage = () => import('./pages/site/KontakPage.vue');
const PpdbPage = () => import('./pages/site/PpdbPage.vue');

type Lazy = () => Promise<{ default: RouteComponent }>;

function pageComponent(portal: SitePortal, page: SitePage): { component: RouteComponent | Lazy; props: Record<string, unknown> } {
  if (page.key === 'home') return portal === 'yayasan' ? { component: YayasanHome, props: {} } : { component: SchoolHome, props: { portal } };
  if (page.key === 'profil') return { component: ProfilPage, props: { portal } };
  if (page.key === 'takhosus' || page.key === 'keasramaan') return { component: ProgramPage, props: { pageKey: page.key } };
  if (page.key === 'kontak') return { component: KontakPage, props: { portal } };
  if (page.key === 'ppdb') return { component: PpdbPage, props: {} };
  return { component: ListPage, props: { portal, pageKey: page.key } };
}

export function siteRoutes(): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = [];
  for (const portal of ['yayasan', 'smp', 'sma'] as const) {
    for (const page of SITE_PAGES as readonly SitePage[]) {
      if (!page.portals.includes(portal)) continue;
      const { component, props } = pageComponent(portal, page);
      const meta = { site: { portal } };
      routes.push({ path: sitePath(portal, page.path), name: siteRouteName(portal, page.key), component, props, meta });
      if (page.detail) {
        routes.push({
          path: `${sitePath(portal, page.path)}/:slug([a-z0-9][a-z0-9-]*)`,
          name: siteRouteName(portal, page.key, true),
          component: EntryPage,
          props: (route) => ({ portal, pageKey: page.key, slug: String(route.params.slug) }),
          meta,
        });
      }
    }
  }
  return routes;
}
