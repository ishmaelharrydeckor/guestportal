import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const staffRole = request.headers.get('x-staff-role') || request.cookies.get('guest_portal_role')?.value || 'Staff';
    if (staffRole === 'Staff') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const total = await db.queryOne('SELECT COUNT(*) as count FROM guests') as any;
    const checkedIn = await db.queryOne('SELECT COUNT(*) as count FROM guests WHERE checked_in = 1') as any;
    const pendingIssues = await db.queryOne("SELECT COUNT(*) as count FROM guests WHERE payment_status IN ('Pending', 'Issue')") as any;
    const issueCount = await db.queryOne("SELECT COUNT(*) as count FROM guests WHERE payment_status = 'Issue'") as any;
    
    // Fetch latest 5 check-ins for the recent activity table
    const recentRows = await db.query(`
      SELECT * FROM guests 
      WHERE checked_in = 1 
      ORDER BY checked_in_at DESC 
      LIMIT 5
    `) as any[];

    const recentActivity = recentRows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      ticket_type: r.ticket_type,
      payment_status: r.payment_status,
      checked_in_at: r.checked_in_at,
      checked_in_by: r.checked_in_by,
    }));

    return NextResponse.json({
      total: total.count,
      checkedIn: checkedIn.count,
      notArrived: total.count - checkedIn.count,
      pendingIssues: pendingIssues.count,
      issueCount: issueCount.count,
      recentActivity,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
