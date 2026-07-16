import { NextRequest, NextResponse } from 'next/server';
import db, { Guest } from '@/lib/db';
import Fuse from 'fuse.js';

export async function GET(request: NextRequest) {
  try {
    const staffUser = request.headers.get('x-staff-user') || request.cookies.get('guest_portal_session')?.value;
    if (!staffUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    // Fetch all guests
    const rows = await db.query('SELECT * FROM guests') as any[];

    const guests: Guest[] = rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      ticket_type: r.ticket_type,
      payment_status: r.payment_status,
      amount_paid: r.amount_paid,
      order_id: r.order_id,
      checked_in: r.checked_in === 1,
      checked_in_at: r.checked_in_at,
      checked_in_by: r.checked_in_by,
    }));

    if (!query.trim()) {
      // Sort alphabetically by full_name if no search query
      guests.sort((a, b) => a.full_name.localeCompare(b.full_name));
      return NextResponse.json({ guests: guests.slice(0, 100) }); // Limit to 100 for performance
    }

    const fuse = new Fuse(guests, {
      keys: ['full_name', 'email'],
      threshold: 0.4, // Good balance of fuzzy matching
    });

    const results = fuse.search(query).map((res) => res.item);

    return NextResponse.json({ guests: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
