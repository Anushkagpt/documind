import bcrypt from 'bcryptjs';
import { memoryStore } from './lib/store';
import { ingestDocument } from './lib/ingest';

export const DEMO_EMAIL = 'demo@documind.dev';
export const DEMO_PASSWORD = 'password123';

export const SAMPLE_HANDBOOK = `Employee Handbook - Acme Systems

Remote Work Policy
Employees may work remotely up to four days per week. Wednesdays are anchor days when the whole team is expected in the office for standup and planning. Fully remote arrangements require written approval from your manager and HR. Home office equipment up to 1,500 dollars per year is reimbursable, including chairs, desks, monitors, and headsets.

Leave and Time Off
Full-time employees receive 24 days of paid time off per year, accrued monthly. Unused PTO rolls over up to a maximum of 10 days. Sick leave is separate and unlimited with a doctor's note after the third consecutive day. Parental leave is 16 weeks fully paid for the primary caregiver and 6 weeks for the secondary caregiver.

Expenses and Travel
Travel bookings must go through the company portal. Economy class is the default for flights under 6 hours; premium economy is allowed for longer flights. Meal expenses are reimbursed up to 65 dollars per day during business travel. Receipts are required for any expense over 25 dollars.

Security
Laptops must have disk encryption enabled and lock after 5 minutes of inactivity. Two-factor authentication is mandatory for all company systems. Report phishing emails to security@acme.example within one hour. Do not store customer data on personal devices or personal cloud accounts.`;

export const SAMPLE_SPEC = `Product Spec - Relay Real-Time Board

Overview
Relay is a real-time project board for small teams. Users create boards, lists, and cards. Changes appear instantly for everyone viewing the board without refreshing. The target user is an engineering team of 3 to 15 people.

Real-Time Sync
The server uses Socket.IO for bi-directional events. When many server instances run, a Redis adapter broadcasts events across them so any client receives every update. Each board is a Socket.IO room, and clients join the rooms for boards they can access.

Data Model
Boards contain lists, and lists contain cards. Cards have a title, description, due date, labels, and assignees. All data lives in PostgreSQL. Card positions are stored as fractional indexes so reordering needs only one row update.

Notifications
A BullMQ queue processes notification jobs in the background. When a card is assigned or a due date passes, a job is queued and a worker sends email and in-app notifications. Failed jobs retry with exponential backoff up to three times.

Performance Budget
Boards with up to 500 cards must render in under 200 milliseconds on a mid-range laptop. Server events must reach clients within 150 milliseconds under normal load.`;

/** Seed the in-memory store with a demo account and two indexed documents. */
export async function seedDemoData(): Promise<void> {
  const existing = await memoryStore.findUserByEmail(DEMO_EMAIL);
  if (existing) return;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await memoryStore.createUser(DEMO_EMAIL, 'Demo User', passwordHash);

  for (const [title, text] of [
    ['Employee Handbook', SAMPLE_HANDBOOK],
    ['Product Spec - Relay Board', SAMPLE_SPEC],
  ] as const) {
    const doc = await memoryStore.createDocument(user.id, title, 'text');
    // Inline ingest: chunks + local embeddings are computed immediately.
    await ingestDocument(doc.id, text);
  }
}
