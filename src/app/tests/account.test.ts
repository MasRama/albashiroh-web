import { describe, expect, it } from 'vitest';
import { mergeStale, redirectTarget, refusalText, roleLabel, sortRoles } from '../account';

describe('admin account helpers', () => {
  it('returns to a page on this site after sign-in, and to the admin panel otherwise', () => {
    expect(redirectTarget('/admin/pengguna?cari=a')).toBe('/admin/pengguna?cari=a');
    expect(redirectTarget(undefined)).toBe('/admin');
    expect(redirectTarget(['/admin/peran'])).toBe('/admin');
    // Never off-site: protocol-relative and backslash forms leave the origin in browsers.
    expect(redirectTarget('//evil.example')).toBe('/admin');
    expect(redirectTarget('/\\evil.example')).toBe('/admin');
    expect(redirectTarget('https://evil.example')).toBe('/admin');
  });

  it("explains a refusal in the admin's words, or passes the server's message on", () => {
    expect(refusalText({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })).toBe('Email atau kata sandi salah.');
    expect(refusalText({ code: 'SOMETHING_NEW', message: 'Server says no' })).toBe('Server says no');
  });

  it('names the school roles and lists them in a fixed order', () => {
    const roles = [
      { slug: 'user', name: 'User' },
      { slug: 'operator', name: 'Operator TU' },
      { slug: 'editor_sma', name: 'editor_sma' },
      { slug: 'admin', name: 'Admin' },
      { slug: 'bendahara', name: 'Bendahara' },
      { slug: 'editor_smp', name: 'editor_smp' },
    ];
    expect(sortRoles(roles).map(roleLabel)).toEqual(['Administrator', 'Editor SMP', 'Editor SMA', 'Staf', 'Bendahara', 'Operator TU']);
  });

  it('keeps what this admin changed and takes the rest from the newer save', () => {
    const base = { name: 'Lama', email: 'lama@example.com' };
    const mine = { name: 'Punyaku', email: 'lama@example.com' };
    const theirs = { name: 'Punya mereka', email: 'baru@example.com' };
    expect(mergeStale(base, mine, theirs)).toEqual({ name: 'Punyaku', email: 'baru@example.com' });
  });
});
