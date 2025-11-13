import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { err } from '@/lib/http';

const PUBLIC_API_PREFIXES = ['/api/auth'];
const PROTECTED_PAGES = ['/', '/calendar'];

function isProtectedPage(pathname: string) {
  return PROTECTED_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

function isProtectedApi(pathname: string) {
  if (!pathname.startsWith('/api')) return false;
  return !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/images')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const protectedApi = isProtectedApi(pathname);
  const protectedPage = isProtectedPage(pathname);

  if (!session && (protectedApi || protectedPage)) {
    if (protectedApi) {
      return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/calendar', '/api/:path*'],
};
