import { NextRequest, NextResponse } from 'next/server';
import db, { Guest } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const staffUser = request.headers.get('x-staff-user') || request.cookies.get('guest_portal_session')?.value;
    if (!staffUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticketType = searchParams.get('ticketType') || '';
    const status = searchParams.get('status') || ''; // 'checked_in', 'not_checked_in', or '' (all)
    const sortBy = searchParams.get('sortBy') || 'name'; // 'name' or 'checkin_time'
    const sortOrder = searchParams.get('sortOrder') || 'asc'; // 'asc' or 'desc'

    let queryStr = 'SELECT * FROM guests WHERE 1=1';
    const params: any[] = [];
    let paramCounter = 1;

    // Filter by ticket type
    if (ticketType) {
      queryStr += ` AND ticket_type = $${paramCounter++}`;
      params.push(ticketType);
    }

    // Filter by check-in status
    if (status === 'checked_in') {
      queryStr += ' AND checked_in = 1';
    } else if (status === 'not_checked_in') {
      queryStr += ' AND checked_in = 0';
    }

    // Sorting
    if (sortBy === 'checkin_time') {
      queryStr += ` ORDER BY checked_in_at ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      // default sortBy name
      queryStr += ` ORDER BY full_name ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    }

    const rows = await db.query(queryStr, params) as any[];

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

    return NextResponse.json({ guests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
