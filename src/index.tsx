import type { Metadata } from 'next';
import { revalidateTag } from 'next/cache';
import { headers } from 'next/headers';
import { config, getSearviaFixes, same, sign, type Fix } from './feed';
import { PATH_HEADER } from './middleware';

export { getSearviaFeed, getSearviaFixes, type Fix, type Feed } from './feed';

/** Current address set by the Searvia middleware ("/" when the middleware is not installed). */
export async function currentPath(): Promise<{ pathname: string; search: string }> {
  const value = (await headers()).get(PATH_HEADER) ?? '/';
  const [pathname, search = ''] = value.split('?', 2);

  return { pathname, search: search ? `?${search}` : '' };
}

function first(fixes: Fix[], type: string): Record<string, any> | undefined {
  return fixes.find((fix) => fix.t === type)?.v;
}

/**
 * Merges approved fixes into your page metadata: title, description, canonical, robots and hreflang alternates.
 * Use it in `generateMetadata` of the root layout (or a page): `return searviaMetadata({ title: 'My site' })`.
 */
export async function searviaMetadata(base: Metadata = {}, path?: { pathname: string; search?: string }): Promise<Metadata> {
  const { pathname, search } = path ?? (await currentPath());
  const fixes = await getSearviaFixes(pathname, search ?? '');
  const title = first(fixes, 'title');
  const description = first(fixes, 'meta_description');
  const canonical = first(fixes, 'canonical');
  const robots = first(fixes, 'robots');
  const hreflang = first(fixes, 'hreflang');

  return {
    ...base,
    ...(title ? { title: { absolute: title.text } } : {}),
    ...(description ? { description: description.text } : {}),
    ...(robots ? { robots: robots.content } : {}),
    alternates: {
      ...(base.alternates ?? {}),
      ...(canonical ? { canonical: canonical.href } : {}),
      ...(hreflang ? { languages: Object.fromEntries((hreflang.links as Array<{ hreflang: string; href: string }>).map((link) => [link.hreflang, link.href])) } : {}),
    },
  };
}

/** Structured data fixes as JSON-LD script tags. Put it once in the root layout's <body>. */
export async function SearviaHead({ pathname, search }: { pathname?: string; search?: string } = {}) {
  const path = pathname ? { pathname, search: search ?? '' } : await currentPath();
  const fixes = (await getSearviaFixes(path.pathname, path.search)).filter((fix) => fix.t === 'json_ld');

  return (
    <>
      {fixes.map((fix, index) => (
        <script key={index} type="application/ld+json" data-searvia="fix" dangerouslySetInnerHTML={{ __html: JSON.stringify(fix.v.data).replace(/</g, '\\u003c') }} />
      ))}
    </>
  );
}

/**
 * Route handler for Searvia's change notice: when you approve or roll back a fix, Searvia calls it and the fix list is
 * refreshed at once. In app/api/searvia/route.ts: `export { searviaWebhook as POST } from 'searvia-next'`, and set
 * SEARVIA_WEBHOOK_URL to that address on your own domain.
 */
export async function searviaWebhook(request: Request): Promise<Response> {
  const settings = config();
  const body = await request.text();

  if (!settings || !same(await sign(body, settings.secret), request.headers.get('x-searvia-signature') ?? '')) {
    return new Response(null, { status: 401 });
  }

  revalidateTag('searvia');

  return Response.json({ ok: true });
}
