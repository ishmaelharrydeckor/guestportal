import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Run middleware on all paths except some static files
  matcher: '/((?!api/static|_next/static|_next/image|favicon.ico).*)',
};
