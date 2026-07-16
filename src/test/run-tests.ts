import assert from 'assert';
import Database from 'better-sqlite3';
import Fuse from 'fuse.js';
import crypto from 'crypto';

console.log('=== Starting EventReg Ops Test Suite ===\n');

// ==========================================
// 1. TEST EXCEL COLUMN MAPPING & PARSING
// ==========================================
console.log('Running Test 1: Excel parsing & column mapping...');

const mockRawHeaders = ['Guest Name', 'E-Mail', 'Ticket/Package', 'Payment Status', 'Paid Amount', 'Reference Code'];

const mapHeaders = (rawHeaders: string[]) => {
  const cleanHeaders = rawHeaders.map((h) => String(h).trim().toLowerCase());
  const mapping: Record<string, number> = {};

  const nameIdx = cleanHeaders.findIndex((h) => h.includes('name') || h.includes('guest') || h.includes('attendee'));
  const emailIdx = cleanHeaders.findIndex((h) => h.includes('email') || h.includes('e-mail') || h.includes('mail'));
  const ticketIdx = cleanHeaders.findIndex((h) => h.includes('ticket') || h.includes('type') || h.includes('package'));
  const amountIdx = cleanHeaders.findIndex((h) => h.includes('amount') || h.includes('price') || h.includes('cost') || h.includes('paid amount'));
  const paymentIdx = cleanHeaders.findIndex((h, idx) => {
    if (idx === amountIdx) return false;
    return h.includes('status') || h.includes('payment') || h.includes('paid');
  });
  const orderIdx = cleanHeaders.findIndex((h) => {
    const words = h.split(/[\s_\-\/]+/);
    return words.includes('id') || h.includes('order') || h.includes('ref') || h.includes('code');
  });

  if (nameIdx !== -1) mapping['full_name'] = nameIdx;
  if (emailIdx !== -1) mapping['email'] = emailIdx;
  if (ticketIdx !== -1) mapping['ticket_type'] = ticketIdx;
  if (paymentIdx !== -1) mapping['payment_status'] = paymentIdx;
  if (amountIdx !== -1) mapping['amount_paid'] = amountIdx;
  if (orderIdx !== -1) mapping['order_id'] = orderIdx;

  return mapping;
};

const mapping = mapHeaders(mockRawHeaders);

// Assert mapping found correct indices
assert.strictEqual(mapping['full_name'], 0);
assert.strictEqual(mapping['email'], 1);
assert.strictEqual(mapping['ticket_type'], 2);
assert.strictEqual(mapping['payment_status'], 3);
assert.strictEqual(mapping['amount_paid'], 4);
assert.strictEqual(mapping['order_id'], 5);

// Test standardisation of values
const standardizePayment = (val: string) => {
  const clean = val.toLowerCase();
  if (clean.includes('paid') || clean.includes('yes') || clean.includes('success') || clean.includes('complete')) {
    return 'Paid';
  } else if (clean.includes('pending') || clean.includes('wait')) {
    return 'Pending';
  } else if (clean.includes('issue') || clean.includes('error') || clean.includes('unpaid') || clean.includes('refund')) {
    return 'Issue';
  }
  return 'Unknown';
};

assert.strictEqual(standardizePayment('PAID'), 'Paid');
assert.strictEqual(standardizePayment('Pending payment'), 'Pending');
assert.strictEqual(standardizePayment('Payment Issue'), 'Issue');
assert.strictEqual(standardizePayment('random'), 'Unknown');

console.log('✓ Excel Column Mapping tests passed!\n');

// ==========================================
// 2. TEST FUZZY SEARCH MATCHING
// ==========================================
console.log('Running Test 2: Fuzzy search matching...');

const mockGuestsList = [
  { id: '1', full_name: 'Jonathan Smith', email: 'jonathan@smith.com' },
  { id: '2', full_name: 'Sarah Jenkins', email: 'sarah.j@gmail.com' },
  { id: '3', full_name: 'Robert Chen', email: 'robert.chen@yahoo.com' },
];

const fuse = new Fuse(mockGuestsList, {
  keys: ['full_name', 'email'],
  threshold: 0.4,
});

// Search for "Jonathon" (typo of Jonathan)
const searchResult1 = fuse.search('Jonathon');
assert.ok(searchResult1.length > 0);
assert.strictEqual(searchResult1[0].item.full_name, 'Jonathan Smith');

// Search for "sarah.j" (email prefix check)
const searchResult2 = fuse.search('sarah.j');
assert.ok(searchResult2.length > 0);
assert.strictEqual(searchResult2[0].item.full_name, 'Sarah Jenkins');

console.log('✓ Fuzzy search matching tests passed!\n');

// ==========================================
// 3. TEST DATABASE WRITES & TRANSACTIONS
// ==========================================
console.log('Running Test 3: SQLite writes & duplicate flows...');

// Create an in-memory SQLite database
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE guests (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    ticket_type TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    amount_paid REAL,
    order_id TEXT,
    checked_in INTEGER DEFAULT 0,
    checked_in_at TEXT,
    checked_in_by TEXT
  );
`);

// Insert mock guest
db.prepare(`
  INSERT INTO guests (id, full_name, email, ticket_type, payment_status, amount_paid, order_id, checked_in)
  VALUES ('guest-abc', 'Alice Johnson', 'alice@johnson.com', 'VIP', 'Paid', 150.0, 'TKT-1001', 0)
`).run();

// Atomic check-in logic helper for test
const runCheckInTransaction = (guestId: string, action: string, force = false, staffUser = 'TestStaff') => {
  const now = new Date().toISOString();

  return db.transaction(() => {
    const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId) as any;
    if (!guest) {
      throw new Error('Guest not found');
    }

    if (action === 'checkin') {
      if (guest.checked_in === 1 && !force) {
        return {
          status: 'ALREADY_CHECKED_IN',
          checked_in_at: guest.checked_in_at,
          checked_in_by: guest.checked_in_by,
        };
      }

      db.prepare(`
        UPDATE guests 
        SET checked_in = 1, checked_in_at = ?, checked_in_by = ? 
        WHERE id = ?
      `).run(now, staffUser, guestId);

      return { status: 'SUCCESS' };
    } else if (action === 'undo') {
      db.prepare(`
        UPDATE guests 
        SET checked_in = 0, checked_in_at = NULL, checked_in_by = NULL 
        WHERE id = ?
      `).run(guestId);

      return { status: 'SUCCESS' };
    }
    throw new Error('Invalid action');
  })();
};

// 1. Verify initial state is not checked in
let guestState = db.prepare('SELECT * FROM guests WHERE id = ?').get('guest-abc') as any;
assert.strictEqual(guestState.checked_in, 0);

// 2. Perform check-in
const res1 = runCheckInTransaction('guest-abc', 'checkin');
assert.strictEqual(res1.status, 'SUCCESS');

guestState = db.prepare('SELECT * FROM guests WHERE id = ?').get('guest-abc') as any;
assert.strictEqual(guestState.checked_in, 1);
assert.ok(guestState.checked_in_at);
assert.strictEqual(guestState.checked_in_by, 'TestStaff');

// 3. Attempt check-in again (duplicate flow, force = false)
const res2 = runCheckInTransaction('guest-abc', 'checkin', false);
assert.strictEqual(res2.status, 'ALREADY_CHECKED_IN');
assert.strictEqual(res2.checked_in_by, 'TestStaff');

// 4. Force check-in again (force = true)
const res3 = runCheckInTransaction('guest-abc', 'checkin', true, 'SecondStaff');
assert.strictEqual(res3.status, 'SUCCESS');

guestState = db.prepare('SELECT * FROM guests WHERE id = ?').get('guest-abc') as any;
assert.strictEqual(guestState.checked_in, 1);
assert.strictEqual(guestState.checked_in_by, 'SecondStaff');

// 5. Undo check-in
const res4 = runCheckInTransaction('guest-abc', 'undo');
assert.strictEqual(res4.status, 'SUCCESS');

guestState = db.prepare('SELECT * FROM guests WHERE id = ?').get('guest-abc') as any;
assert.strictEqual(guestState.checked_in, 0);
assert.strictEqual(guestState.checked_in_at, null);
assert.strictEqual(guestState.checked_in_by, null);

console.log('✓ SQLite check-in transaction & duplicate prevention tests passed!\n');

// ==========================================
// 4. TEST ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================
console.log('Running Test 4: Role-Based Access Control...');

const getRoleForPassword = (password: string) => {
  const expectedAdminPassword = 'admin123';
  const expectedStaffPassword = 'staff123';
  if (password === expectedAdminPassword) return 'Admin';
  if (password === expectedStaffPassword) return 'Staff';
  return '';
};

// Assert correct roles are mapped
assert.strictEqual(getRoleForPassword('admin123'), 'Admin');
assert.strictEqual(getRoleForPassword('staff123'), 'Staff');
assert.strictEqual(getRoleForPassword('wrong-password'), '');

const isRouteAllowed = (role: string, pathname: string) => {
  if (role === 'Admin') return true;
  
  // Staff restrictions
  const isRestrictedPage =
    pathname === '/dashboard' ||
    pathname === '/log' ||
    pathname === '/upload';

  const isRestrictedApi =
    pathname === '/api/guests/stats' ||
    pathname === '/api/guests/export' ||
    pathname === '/api/guests/upload';

  return !isRestrictedPage && !isRestrictedApi;
};

// Assert Admin permissions
assert.ok(isRouteAllowed('Admin', '/dashboard'));
assert.ok(isRouteAllowed('Admin', '/log'));
assert.ok(isRouteAllowed('Admin', '/upload'));
assert.ok(isRouteAllowed('Admin', '/'));

// Assert Staff permissions
assert.ok(isRouteAllowed('Staff', '/'));
assert.ok(isRouteAllowed('Staff', '/login'));
assert.ok(isRouteAllowed('Staff', '/api/guests/search'));

// Assert Staff restrictions
assert.strictEqual(isRouteAllowed('Staff', '/dashboard'), false);
assert.strictEqual(isRouteAllowed('Staff', '/log'), false);
assert.strictEqual(isRouteAllowed('Staff', '/upload'), false);
assert.strictEqual(isRouteAllowed('Staff', '/api/guests/stats'), false);
assert.strictEqual(isRouteAllowed('Staff', '/api/guests/export'), false);
assert.strictEqual(isRouteAllowed('Staff', '/api/guests/upload'), false);

console.log('✓ Role-Based Access Control tests passed!\n');

console.log('=== All tests passed successfully! ===');
