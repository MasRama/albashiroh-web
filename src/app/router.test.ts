import { describe, expect, it } from 'vitest';
import router, { appRoutes, appScrollBehavior } from './router';
import { matchSitePath, sitePath, siteRouteName, SITE_PAGES } from './site-map';

describe('application browser routes', () => {
  it('keeps declared route paths and names unique before Vue Router normalization', () => {
    const paths = appRoutes.map((route) => route.path);
    const names = appRoutes.flatMap((route) => (typeof route.name === 'string' ? [route.name] : []));

    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('serves the admin panel under /admin, with /login kept for the sign-in page', () => {
    expect(router.resolve('/admin/masuk').name).toBe('login');
    expect(router.resolve('/login').name).toBe('login');
    expect(router.resolve('/admin').name).toBe('dashboard');
    expect(router.resolve('/register').name).toBe('not-found');
  });

  it('gives every public page the route the server describes, and nothing more', () => {
    for (const page of SITE_PAGES) {
      for (const portal of page.portals) {
        const path = sitePath(portal, page.path);
        const resolved = router.resolve(path);
        expect(resolved.name, path).toBe(siteRouteName(portal, page.key));
        expect(resolved.meta.site?.portal, path).toBe(portal);
        expect(matchSitePath(path)?.page.key, path).toBe(page.key);
        if ('detail' in page && page.detail) {
          expect(router.resolve(`${path}/contoh-judul-1`).name, path).toBe(siteRouteName(portal, page.key, true));
        }
      }
    }
    for (const path of ['/smp/alumni', '/smp/takhosus', '/sma/ppdb', '/tanya-jawab', '/profil/lebih']) {
      expect(router.resolve(path).name, path).toBe('not-found');
      expect(matchSitePath(path), path).toBeUndefined();
    }
  });

  it('resolves unknown browser paths to the canonical not-found route', () => {
    expect(router.resolve('/this-route-does-not-exist').name).toBe('not-found');
  });

  it('scrolls hash navigation to the requested section and restores browser positions', () => {
    const from = router.resolve('/admin') as unknown as Parameters<typeof appScrollBehavior>[1];
    const to = router.resolve('/admin/profil#keamanan') as unknown as Parameters<typeof appScrollBehavior>[0];

    expect(appScrollBehavior(to, from, null)).toEqual({ el: '#keamanan' });
    expect(appScrollBehavior(to, from, { left: 3, top: 7 })).toEqual({ left: 3, top: 7 });
  });
});
