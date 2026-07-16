import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { guestId, action, force } = await request.json();
    const cookieStore = await cookies();
    const staffUser = request.headers.get('x-staff-user') || cookieStore.get('guest_portal_session')?.value || 'Staff';

    if (!guestId) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Use a transaction to ensure atomic operations
    const result = await db.transaction(async (tx) => {
      // 1. Get the current status
      const guest = await tx.queryOne('SELECT * FROM guests WHERE id = $1', [guestId]) as any;
      if (!guest) {
        throw new Error('Guest not found');
      }

      if (action === 'checkin') {
        // If already checked in and not forced, return check-in details
        const isCheckedIn = guest.checked_in === 1 || guest.checked_in === true || String(guest.checked_in) === 'true';
        if (isCheckedIn && !force) {
          return {
            status: 'ALREADY_CHECKED_IN',
            checked_in_at: guest.checked_in_at,
            checked_in_by: guest.checked_in_by,
          };
        }

        // Perform the atomic write
        await tx.execute(`
          UPDATE guests 
          SET checked_in = 1, checked_in_at = $1, checked_in_by = $2 
          WHERE id = $3
        `, [now, staffUser, guestId]);

        return { status: 'SUCCESS' };
      } else if (action === 'undo') {
        // Perform the undo operation
        await tx.execute(`
          UPDATE guests 
          SET checked_in = 0, checked_in_at = NULL, checked_in_by = NULL 
          WHERE id = $1
        `, [guestId]);

        return { status: 'SUCCESS' };
      } else {
        throw new Error('Invalid action');
      }
    });

    if (result.status === 'ALREADY_CHECKED_IN') {
      return NextResponse.json({
        success: false,
        code: 'ALREADY_CHECKED_IN',
        checked_in_at: result.checked_in_at,
        checked_in_by: result.checked_in_by,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
