# searvia-next

Apply the SEO fixes you approve in [Searvia](https://searvia.com) to a Next.js (App Router) site: titles, meta
descriptions, canonical tags, robots, hreflang alternates and JSON-LD are rendered on the server, so Google and AI
crawlers see them; image alt text and internal links are applied in the browser.

The fix list is signed by Searvia (HMAC-SHA256) and cached by Next.js for five minutes. If Searvia cannot be reached or
the signature does not match, your pages render as they are.

## Install

```bash
npm install searvia-next
```

In Searvia open **SEO › Site fixes**, choose **Next.js** and copy the site key. Then set:

```bash
SEARVIA_SITE_KEY=xxxxxxxxxxxxxxxxxxxxxxxx.yyyyyyyy   # the site key from Searvia
SEARVIA_SITE_URL=https://www.example.com             # optional, shown in Searvia
SEARVIA_WEBHOOK_URL=https://www.example.com/api/searvia  # optional, instant refresh (see below)
```

## Use

**1. Middleware** (passes the current path to your layout). `middleware.ts`:

```ts
export { middleware } from 'searvia-next/middleware';
```

Already have a middleware? Wrap your response: `return withSearviaPath(request, response)`.

**2. Root layout** (`app/layout.tsx`):

```tsx
import { SearviaHead, searviaMetadata, getSearviaFixes, currentPath } from 'searvia-next';
import { SearviaClientFixes } from 'searvia-next/client';

export async function generateMetadata() {
  return searviaMetadata({ title: 'My site', description: 'Default description' });
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { pathname, search } = await currentPath();
  const fixes = await getSearviaFixes(pathname, search);

  return (
    <html lang="en">
      <body>
        {children}
        <SearviaHead pathname={pathname} search={search} />
        <SearviaClientFixes fixes={fixes} />
      </body>
    </html>
  );
}
```

Pages that set their own `generateMetadata` can wrap it the same way: `return searviaMetadata(myMetadata)`.

The connection turns active in Searvia on the first page your site renders.

**3. Instant refresh (optional).** `app/api/searvia/route.ts`:

```ts
export { searviaWebhook as POST } from 'searvia-next';
```

Set `SEARVIA_WEBHOOK_URL` to that address on your own domain. Searvia calls it (signed) whenever you approve or roll
back a fix, and the list refreshes at once instead of within five minutes.

## License

MIT
