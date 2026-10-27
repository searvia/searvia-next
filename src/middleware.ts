import { NextResponse, type NextRequest } from 'next/server';
import { config, same, sign, VERSION, type Feed } from './feed.js';

/** Request header that carries the current address to Server Components (App Router layouts do not know the path). */
export const PATH_HEADER = 'x-searvia-path';

const TTL = 300_000;
let cached: { feed: Feed | null; at: number } | null = null;

/** The fix list for redirects, kept in memory for five minutes (middleware fetches are not cached by Next.js). */
async function feed(): Promise<Feed | null> {
  const settings = config();

  if (!settings) return null;
  if (cached && Date.now() - cached.at < TTL) return cached.feed;

  try {
    const response = await fetch(`${settings.base}/fixes/${settings.channel}/feed`, { headers: { 'User-Agent': `SearviaNext/${VERSION} (middleware)` } });
    const body = response.ok ? await response.text() : '';
    const valid = body !== '' && same(await sign(body, settings.secret), response.headers.get('x-searvia-signature') ?? '');
    cached = { feed: valid ? (JSON.parse(body) as Feed) : (cached?.feed ?? null), at: Date.now() };
  } catch {
    cached = { feed: cached?.feed ?? null, at: Date.now() };
  }

  return cached.feed;
}

/**
 * A redirect approved in Searvia (a broken or merged page) for this request, or null. Call it from your own middleware:
 * `const redirect = await searviaRedirect(request); if (redirect) return redirect;`
 */
export async function searviaRedirect(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== 'GET') return null;

  const { pathname, search } = request.nextUrl;
  const list = (await feed())?.fixes;
  const fix = (list?.[pathname + search] ?? list?.[pathname] ?? []).find((item) => item.t === 'redirect');

  if (!fix || typeof fix.v.href !== 'string') return null;

  const target = new URL(fix.v.href, request.url);

  return target.href === request.nextUrl.href ? null : NextResponse.redirect(target, [301, 302, 308].includes(fix.v.status) ? fix.v.status : 301);
}

/**
 * Middleware that passes the path to `searviaMetadata()` and `<SearviaHead />`. Use it as your middleware, or call it from
 * your own: `return withSearviaPath(request, NextResponse.next(...))`.
 */
export function withSearviaPath(request: NextRequest, response?: NextResponse): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  const next = NextResponse.next({ request: { headers } });

  response?.headers.forEach((value, key) => next.headers.set(key, value));

  return next;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return (await searviaRedirect(request)) ?? withSearviaPath(request);
}
