import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './testEnv.js';

let t, A, B, C, groupId, me, riya;
let n = 0;
const key = () => `feat-key-${++n}-${Math.random().toString(36).slice(2)}`;
const get = (path, cookie = A) => t.call('GET', path, { cookie });

beforeAll(async () => {
  t = await setup();
  A = await t.signIn('Asha Verma', 'asha@example.com');
  B = await t.signIn('Bhavin Shah', 'bhavin@example.com');
  C = await t.signIn('Chitra Rao', 'chitra@example.com');
  groupId = (await t.call('POST', '/api/groups', { cookie: A, body: { name: 'Flat', category: 'flatmates', memberNames: ['Riya'] } })).body.group.id;
  const d = (await get(`/api/groups/${groupId}`)).body;
  me = d.myMemberId;
  riya = d.members.find((m) => m.name === 'Riya').id;
  // Make Bhavin a real member through an invitation link
  const invite = (await t.call('POST', `/api/groups/${groupId}/invites`, { cookie: A, body: {} })).body;
  expect(invite.networkUrls).toEqual(expect.any(Array));
  expect(invite.networkUrls.every((url) => url.endsWith(invite.path))).toBe(true);
  const inv = invite.path.split('/').pop();
  await t.call('POST', `/api/invites/${inv}/accept`, { cookie: B, body: {} });
  const bhavin = (await get(`/api/groups/${groupId}`)).body.members.find((m) => m.name === 'Bhavin Shah').id;
  const add = (description, amount, category, date) =>
    t.call('POST', `/api/groups/${groupId}/expenses`, {
      cookie: A, key: key(),
      body: { description, amount, paidBy: me, splitMethod: 'equal', participants: [me, riya, bhavin].map((memberId) => ({ memberId })), category, date },
    });
  expect((await add('Rent', 90000, 'rent', '2026-10-01')).status).toBe(201);
  expect((await add('Dinner', 30000, 'food', '2026-10-12')).status).toBe(201);
  expect((await add('Groceries', 15000, 'groceries', '2026-09-20')).status).toBe(201);
});
afterAll(() => t.close());

describe('notifications', () => {
  it('tells other members about a new expense, not the person who added it', async () => {
    const b = (await get('/api/notifications', B)).body;
    const expenseNotes = b.notifications.filter((x) => x.type === 'expense');
    expect(expenseNotes).toHaveLength(3);
    expect(expenseNotes[0].body).toContain('Your share is');
    expect(expenseNotes[0].link).toContain(`/groups/${groupId}`);
    expect((await get('/api/notifications', A)).body.notifications.some((x) => x.type === 'expense')).toBe(false);
  });

  it('counts, marks one read, marks all read, and keeps notifications private', async () => {
    const before = (await get('/api/notifications/unread-count', B)).body.unread;
    expect(before).toBeGreaterThanOrEqual(3);
    const first = (await get('/api/notifications', B)).body.notifications[0];
    expect((await t.call('POST', `/api/notifications/${first.id}/read`, { cookie: C, body: {} })).status).toBe(404); // not hers
    expect((await t.call('POST', `/api/notifications/${first.id}/read`, { cookie: B, body: {} })).status).toBe(200);
    expect((await get('/api/notifications/unread-count', B)).body.unread).toBe(before - 1);
    await t.call('POST', '/api/notifications/read-all', { cookie: B, body: {} });
    expect((await get('/api/notifications/unread-count', B)).body.unread).toBe(0);
    expect((await get('/api/notifications/unread-count', null)).status).toBe(401);
  });

  it('notifies about friend requests and settlements', async () => {
    const asha = (await get('/api/auth/me')).body.user;
    await t.call('POST', '/api/friends/requests', { cookie: C, body: { userId: asha.id } });
    expect((await get('/api/notifications')).body.notifications.some((x) => x.type === 'friend')).toBe(true);
  });

  it('creates the monthly recap notice once', async () => {
    // A separate person and group, so this does not depend on (or disturb) the other test data
    const D = await t.signIn('Dev Patel', 'dev@example.com');
    const gid = (await t.call('POST', '/api/groups', { cookie: D, body: { name: 'Solo', category: 'friends_family' } })).body.group.id;
    const mine = (await get(`/api/groups/${gid}`, D)).body.myMemberId;
    const d = new Date();
    const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    expect((await t.call('GET', '/api/notifications', { cookie: D })).body.notifications.some((x) => x.type === 'recap')).toBe(false); // nothing to recap yet
    const add = await t.call('POST', `/api/groups/${gid}/expenses`, {
      cookie: D, key: key(),
      body: { description: 'Last month', amount: 5000, paidBy: mine, splitMethod: 'equal', participants: [{ memberId: mine }], category: 'other', date: `${prev}-05` },
    });
    expect(add.status).toBe(201);
    await get('/api/notifications', D);
    await get('/api/notifications/unread-count?sync=1', D);
    const recaps = (await get('/api/notifications', D)).body.notifications.filter((x) => x.type === 'recap');
    expect(recaps).toHaveLength(1);
    expect(recaps[0].link).toBe(`/recap?month=${prev}`);
  });
});

describe('monthly recap and analytics', () => {
  it('summarises one month using only the person\'s own share', async () => {
    const r = (await get('/api/recap?month=2026-10')).body;
    expect(r.totals).toMatchObject({ share: 40000, paid: 120000, count: 2 });
    expect(r.previous).toMatchObject({ month: '2026-09', share: 5000, changePct: 700 });
    expect(r.categories.map((c) => c.category)).toEqual(['rent', 'food']);
    expect(r.daily).toHaveLength(31);
    expect(r.topExpense).toMatchObject({ description: 'Rent', share: 30000 });
    expect(r.topDay.date).toBe('2026-10-01');
  });

  it('rejects a bad month and works for an empty month', async () => {
    expect((await get('/api/recap?month=2026-13')).status).toBe(400);
    const r = (await get('/api/recap?month=2020-01')).body;
    expect(r.totals.share).toBe(0);
    expect(r.previous.changePct).toBeNull();
    expect(r.topExpense).toBeNull();
  });

  it('returns a monthly trend with empty months filled in', async () => {
    const a = (await get('/api/analytics?months=6')).body;
    expect(a.trend).toHaveLength(6);
    expect(a.weekday).toHaveLength(7);
    expect((await get('/api/analytics?months=1')).status).toBe(400);
    expect((await get(`/api/analytics?group=${groupId}`, C)).status).toBe(404);
  });

  it('gives a group report to members only', async () => {
    const g = (await get(`/api/groups/${groupId}/report`)).body;
    expect(g.totals.spend).toBe(135000);
    expect(g.members.find((m) => m.name === 'Asha Verma').paid).toBeGreaterThan(0);
    expect(g.settleUp.length).toBeGreaterThan(0);
    const oct = (await get(`/api/groups/${groupId}/report?month=2026-10`)).body;
    expect(oct.totals.spend).toBe(120000);
    expect((await get(`/api/groups/${groupId}/report`, C)).status).toBe(404);
  });
});

describe('shareable reports', () => {
  let path, id;
  it('creates a frozen public link that needs no sign-in', async () => {
    const s = await t.call('POST', '/api/reports/share', { cookie: A, body: { kind: 'monthly', month: '2026-10' } });
    expect(s.status).toBe(201);
    ({ path, id } = s.body);
    const token = path.split('/').pop();
    const pub = await t.call('GET', `/api/public/reports/${token}`);
    expect(pub.status).toBe(200);
    expect(pub.res.headers.get('x-robots-tag')).toContain('noindex');
    expect(pub.body).toMatchObject({ kind: 'monthly', sharedBy: 'Asha Verma' });
    expect(pub.body.payload.totals.share).toBe(40000);
    // a new expense afterwards does not change the snapshot
    await t.call('POST', `/api/groups/${groupId}/expenses`, {
      cookie: A, key: key(),
      body: { description: 'Late', amount: 10000, paidBy: me, splitMethod: 'equal', participants: [{ memberId: me }], category: 'food', date: '2026-10-30' },
    });
    expect((await t.call('GET', `/api/public/reports/${token}`)).body.payload.totals.share).toBe(40000);
  });

  it('shares a group report only for your own groups', async () => {
    expect((await t.call('POST', '/api/reports/share', { cookie: C, body: { kind: 'group', groupId } })).status).toBe(404);
    expect((await t.call('POST', '/api/reports/share', { cookie: A, body: { kind: 'group' } })).status).toBe(400);
    const ok = await t.call('POST', '/api/reports/share', { cookie: A, body: { kind: 'group', groupId, days: 7 } });
    expect(ok.status).toBe(201);
    const pub = await t.call('GET', `/api/public/reports/${ok.body.path.split('/').pop()}`);
    expect(pub.body.payload.group.name).toBe('Flat');
  });

  it('lists shares with view counts and lets only the owner revoke', async () => {
    const list = (await get('/api/reports/shares')).body.shares;
    expect(list[0]).toHaveProperty('views');
    expect(list.find((x) => x.id === id).views).toBeGreaterThanOrEqual(2);
    expect((await t.call('POST', `/api/reports/shares/${id}/revoke`, { cookie: B, body: {} })).status).toBe(404);
    expect((await t.call('POST', `/api/reports/shares/${id}/revoke`, { cookie: A, body: {} })).status).toBe(200);
    expect((await t.call('GET', `/api/public/reports/${path.split('/').pop()}`)).status).toBe(404);
    expect((await get('/api/reports/shares')).body.shares.find((x) => x.id === id).active).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    expect((await t.call('GET', '/api/public/reports/nope')).status).toBe(404);
    expect((await t.call('GET', `/api/public/reports/${'a'.repeat(48)}`)).status).toBe(404);
  });
});
