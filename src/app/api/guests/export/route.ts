import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryRole = searchParams.get('role');
    const staffRole = queryRole || request.headers.get('x-staff-role') || request.cookies.get('guest_portal_role')?.value || 'Staff';
    if (staffRole === 'Staff') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const guests = await db.query('SELECT * FROM guests ORDER BY full_name ASC') as any[];

    // CSV Headers with UTF-8 BOM to ensure Excel opens special characters correctly
    let csvContent = '\uFEFF';
    csvContent += 'Name,Ticket Type,Payment Status,Checked In,Check-In Time,Checked In By\r\n';

    for (const g of guests) {
      const name = `"${(g.full_name || '').replace(/"/g, '""')}"`;
      const ticketType = `"${(g.ticket_type || '').replace(/"/g, '""')}"`;
      const paymentStatus = `"${(g.payment_status || '').replace(/"/g, '""')}"`;
      const checkedIn = g.checked_in === 1 ? 'Yes' : 'No';
      const checkInTime = g.checked_in_at ? `"${g.checked_in_at}"` : '';
      const checkedInBy = g.checked_in_by ? `"${(g.checked_in_by || '').replace(/"/g, '""')}"` : '';

      csvContent += `${name},${ticketType},${paymentStatus},${checkedIn},${checkInTime},${checkedInBy}\r\n`;
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="attendance_report.csv"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
