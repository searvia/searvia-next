// Searvia fix feed: signed (HMAC-SHA256) list of approved fixes keyed by path. Works in the Node.js and Edge runtimes.

export const VERSION = '0.2.0';

export type Fix = { t: string; v: Record<string, any> };
export type Feed = { v: string; generated: string; fixes: Record<string, Fix[]> };

type Config = { channel: string; secret: string; base: string; site: string; webhook: string };

export function config(): Config | null {
  const [channel, secret] = (process.env.SEARVIA_SITE_KEY ?? '').split('.', 2);

  if (!channel || !secret || !/^[a-z0-9]{24}$/.test(channel)) {
    return null;
  }

  return {
    channel,
    secret,
    base: (process.env.SEARVIA_URL ?? 'https://searvia.com').replace(/\/$/, ''),
    site: process.env.SEARVIA_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '',
    webhook: process.env.SEARVIA_WEBHOOK_URL ?? '',
  };
}

export async function sign(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));

  return 'sha256=' + Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two signatures. */
export function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The fix list, cached by Next.js for five minutes (tag "searvia"). Returns null when the key is missing or the signature does not match. */
export async function getSearviaFeed(): Promise<Feed | null> {
  const settings = config();

  if (!settings) return null;

  try {
    const response = await fetch(`${settings.base}/fixes/${settings.channel}/feed`, {
      headers: { 'User-Agent': `SearviaNext/${VERSION}`, 'X-Searvia-Site': settings.site, 'X-Searvia-Version': VERSION, 'X-Searvia-Webhook': settings.webhook },
      next: { revalidate: 300, tags: ['searvia'] },
    } as RequestInit);

    if (!response.ok) return null;

    const body = await response.text();

    return same(await sign(body, settings.secret), response.headers.get('x-searvia-signature') ?? '') ? (JSON.parse(body) as Feed) : null;
  } catch {
    return null;
  }
}

/** Fixes for one address: path with query first, then the path alone. */
export async function getSearviaFixes(pathname: string, search = ''): Promise<Fix[]> {
  const feed = await getSearviaFeed();
  const query = search && !search.startsWith('?') ? `?${search}` : search;

  return feed?.fixes[pathname + query] ?? feed?.fixes[pathname] ?? [];
}
