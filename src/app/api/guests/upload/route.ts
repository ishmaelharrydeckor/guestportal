import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const staffRole = request.headers.get('x-staff-role') || request.cookies.get('guest_portal_role')?.value || 'Staff';
    if (staffRole === 'Staff') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const { guests, mode } = await request.json();

    if (!Array.isArray(guests)) {
      return NextResponse.json({ error: 'Guests must be an array' }, { status: 400 });
    }

    // Atomic transaction for the entire upload
    await db.transaction(async (tx) => {
      if (mode === 'replace') {
        await tx.execute('DELETE FROM guests');
      }

      for (const g of guests) {
        // Validation: reject if no name
        if (!g.full_name || !g.full_name.trim()) {
          continue; 
        }

        // Find existing guest by email or order_id
        let existingId: string | null = null;

        if (g.email && g.email.trim()) {
          const res = await tx.queryOne(
            "SELECT id FROM guests WHERE email = $1 AND email IS NOT NULL AND email != ''",
            [g.email.trim()]
          ) as any;
          if (res) existingId = res.id;
        }

        if (!existingId && g.order_id && String(g.order_id).trim()) {
          const res = await tx.queryOne(
            "SELECT id FROM guests WHERE order_id = $1 AND order_id IS NOT NULL AND order_id != ''",
            [String(g.order_id).trim()]
          ) as any;
          if (res) existingId = res.id;
        }

        // Standardize values
        const ticketType = g.ticket_type || 'Unknown';
        const paymentStatus = g.payment_status || 'Unknown';
        const amountPaid = typeof g.amount_paid === 'number' ? g.amount_paid : null;
        const orderId = g.order_id ? String(g.order_id).trim() : null;
        const email = g.email ? String(g.email).trim() : null;

        if (existingId) {
          // Update details, preserving checked_in state
          await tx.execute(`
            UPDATE guests
            SET full_name = $1, email = $2, ticket_type = $3, payment_status = $4, amount_paid = $5, order_id = $6
            WHERE id = $7
          `, [
            g.full_name.trim(),
            email,
            ticketType,
            paymentStatus,
            amountPaid,
            orderId,
            existingId
          ]);
        } else {
          // Insert new guest record
          const newId = crypto.randomUUID();
          await tx.execute(`
            INSERT INTO guests (id, full_name, email, ticket_type, payment_status, amount_paid, order_id, checked_in)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
          `, [
            newId,
            g.full_name.trim(),
            email,
            ticketType,
            paymentStatus,
            amountPaid,
            orderId
          ]);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
