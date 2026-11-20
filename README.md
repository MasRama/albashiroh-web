# Al Bashiroh Web

The website and content management system of **Yayasan Bashiroh Robbaniyah**
in Turen, Malang, and its two schools, **SMP IT Al Bashiroh** and
**SMA IT Al Bashiroh**. One domain serves three things:

- the Yayasan site (profil, Takhosus Al-Qur'an 30 juz, keasramaan, fasilitas,
  guru & staf, berita, galeri, prestasi, kontak, dokumen);
- a portal for each school (beranda, akademik, ekstrakurikuler, prestasi,
  Q&A, and alumni for SMA);
- one PPDB registration form where applicants choose SMP or SMA.

Everything on the site is edited by the school from the admin panel. The
public copy is in Indonesian.

The application is built on [Nara](https://github.com/MasRama/nara) 3.5:
Hono and Node.js on the server, a Vue 3 single-page app in the browser, and
one SQLite database.

## Quick start

Node.js 22 or newer is required.

```bash
git clone https://github.com/MasRama/albashiroh-web.git
cd albashiroh-web
npm ci
cp .env.example .env
npm run setup
npm run dev
```

Open <http://localhost:5555>. `npm run setup` applies the migrations and
creates the first administrator, `admin@nara.local` with the temporary
password `admin12345`, which must be changed at first sign-in. Set
`NARA_ADMIN_NAME`, `NARA_ADMIN_EMAIL` and `NARA_ADMIN_PASSWORD` before setup
to choose your own.

## Checks

```bash
npm run verify      # the pull-request gate: typecheck, tests, build, architecture
npm run check       # the full suite, run on main
```

Enable the pre-push hook once per clone, so `verify` runs before every push:

```bash
git config core.hooksPath .githooks
```

## Production

Production is one Node process behind a reverse proxy that holds the TLS
certificate, with the SQLite database and uploaded files on the same host:

```bash
cp .env.production.example .env.production
npm ci
npm run build
npm run setup
npm start
```

Behind the proxy set `HOST=127.0.0.1` and `TRUST_PROXY=true`. The database is
backed up every 24 hours into `database/backups/` (the newest 7 are kept);
copy that directory and `storage/` off the host as well.
[`docs/deployment.md`](./docs/deployment.md) walks through a deployment with
Caddy.

## Documentation

- [`CONTRIBUTING.md`](./CONTRIBUTING.md): branches, pull requests, checks and releases
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): Nara's feature model, which this code follows
- [`docs/feature-model.md`](./docs/feature-model.md): Feature ownership and boundaries
- [`docs/auth.md`](./docs/auth.md): sign-in, roles and permissions
- [`docs/database-lifecycle.md`](./docs/database-lifecycle.md): migrations, seeds, backups and restore
- [`docs/deployment.md`](./docs/deployment.md): production behind Caddy or nginx
- [`SECURITY.md`](./SECURITY.md): reporting a vulnerability and the security model
- [`CHANGELOG.md`](./CHANGELOG.md): what changed in each release

## License

[MIT](./LICENSE)
