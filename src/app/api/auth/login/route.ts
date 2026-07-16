import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const expectedAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const expectedStaffPassword = process.env.STAFF_PASSWORD || 'staff123';

    let role = '';
    if (password === expectedAdminPassword) {
      role = 'Admin';
    } else if (password === expectedStaffPassword) {
      role = 'Staff';
    }

    if (role) {
      const response = NextResponse.json({ success: true, role });
      const isHttps = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https:');
      
      // Store the staff username inside the secure httpOnly session cookie
      response.cookies.set('guest_portal_session', username || 'Staff', {
        httpOnly: true,
        path: '/',
        secure: isHttps,
        sameSite: 'lax',
      });

      // Store the client-readable username cookie (for localStorage fallback)
      response.cookies.set('guest_portal_user', username || 'Staff', {
        httpOnly: false,
        path: '/',
        secure: isHttps,
        sameSite: 'lax',
      });

      // Store the user role inside a client-readable cookie
      response.cookies.set('guest_portal_role', role, {
        httpOnly: false,
        path: '/',
        secure: isHttps,
        sameSite: 'lax',
      });

      return response;
    }

    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
