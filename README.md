# EventReg Ops - Guest Check-In

A working, self-contained Next.js React operations tool built for event staff to manage guest check-ins efficiently, securely, and offline.

## Core Features
1. **Lightweight Auth:** Cookie-based session access secured by a shared staff password.
2. **Intelligent Excel Upload:** Parses attendee lists (`.xlsx` / `.csv`) client-side via SheetJS, maps headers dynamically, provides a preview, and handles atomic SQLite upserts (with merge or replace modes).
3. **Fuzzy Search:** Instant search-as-you-type using Fuse.js.
4. **Checked-In Management:** Atomic check-ins with warning prompts for duplicate scans, and check-in undo capabilities.
5. **Real-time Dashboard:** Live statistics counts and live recent check-in feeds.
6. **Attendance Log & Export:** Filterable and sortable log table with a one-click CSV export utility.

---

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Access Passwords (RBAC)**
   Create a `.env.local` file in the project root directory and define passwords for each role:
   ```env
   ADMIN_PASSWORD=your_admin_password
   STAFF_PASSWORD=your_staff_password
   ```
   *   **Admin Role** (Access to everything): defaults to `admin123` if environment variable is not set.
   *   **Staff Role** (Only access to the check-in page): defaults to `staff123` if environment variable is not set.

3. **Run the App Locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run the Assertion Test Suite**
   ```bash
   npm run test
   ```

---

## Technical Notes

### SQLite Database
* The database resides locally in the project root folder: `guest_checkin.db`.
* No cloud services or external databases are required. It operates fully offline once dependencies are cached.
* SQLite runs in WAL (Write-Ahead Logging) mode to safely handle concurrent read/write transactions from multiple check-in terminals on the same local network.

### Resetting the Guest List
There are two ways to reset the guest list between events:
1. **In the UI:** Go to the **Upload** page, import your new guest Excel/CSV sheet, and select **"Replace list entirely"** in the configuration modal. This will cleanly wipe the database and import the new records.
2. **Via Filesystem:** Stop the server, delete the `guest_checkin.db` file in the project root, and restart the server. The database schema will be automatically rebuilt from scratch.
