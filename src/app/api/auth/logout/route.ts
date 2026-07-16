import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('guest_portal_session', '', { path: '/', maxAge: 0 });
  response.cookies.set('guest_portal_user', '', { path: '/', maxAge: 0 });
  response.cookies.set('guest_portal_role', '', { path: '/', maxAge: 0 });
  return response;
}
