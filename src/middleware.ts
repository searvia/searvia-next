import { NextResponse, type NextRequest } from 'next/server';

/** Request header that carries the current address to Server Components (App Router layouts do not know the path). */
export const PATH_HEADER = 'x-searvia-path';

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

export function middleware(request: NextRequest): NextResponse {
  return withSearviaPath(request);
}
