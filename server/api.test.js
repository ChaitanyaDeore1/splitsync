import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './testEnv.js';

let t, A, B, groupId, me, riya, kabir;
let n = 0;
const key = () => `test-key-${++n}-${Math.random().toString(36).slice(2)}`;
const detail = async (id = groupId, cookie = A) => (await t.call('GET', `/api/groups/${id}`, { cookie })).body;
const expenses = async (id = groupId) => (await t.call('GET', `/api/groups/${id}/expenses`, { cookie: A })).body.expenses;
const post = (body, k = key(), id = groupId, cookie = A) => t.call('POST', `/api/groups/${id}/expenses`, { body, cookie, key: k });
const expense = (over = {}) => ({
  description: 'Dinner', amount: 100000, paidBy: me, splitMethod: 'equal',
  participants: [me, riya, kabir].map((memberId) => ({ memberId })), category: 'food', date: '2026-11-18', ...over,
});

beforeAll(async () => {
  t = await setup();
  A = await t.signIn('Asha Verma', 'asha@example.com');
  B = await t.signIn('Bhavin Shah', 'bhavin@example.com');
  groupId = (await t.call('POST', '/api/groups', { cookie: A, body: { name: 'Flat', category: 'flatmates', memberNames: ['Riya', 'Kabir'] } })).body.group.id;
  const d = await detail();
  me = d.myMemberId;
  riya = d.members.find((m) => m.name === 'Riya').id;
  kabir = d.members.find((m) => m.name === 'Kabir').id;
});
afterAll(() => t.close());

describe('groups and permissions', () => {
  it('creates a group with the signed-in user as admin', async () => {
    const d = await detail();
    expect(d.members.map((m) => m.name)).toEqual(['Asha Verma', 'Kabir', 'Riya']);
    expect(d.members[0]).toMatchObject({ role: 'admin', userId: expect.any(String) });
    expect(d.members.every((m) => m.balance === 0)).toBe(true);
  });

  it('hides a group and blocks every action for non-members', async () => {
    expect((await t.call('GET', `/api/groups/${groupId}`, { cookie: B })).status).toBe(404);
    expect((await t.call('GET', `/api/groups/${groupId}/expenses`, { cookie: B })).status).toBe(404);
    expect((await t.call('GET', `/api/groups/${groupId}/activity`, { cookie: B })).status).toBe(404);
    expect((await t.call('POST', `/api/groups/${groupId}/members`, { cookie: B, body: { name: 'Eve' } })).status).toBe(404);
    expect((await post(expense(), key(), groupId, B)).status).toBe(404);
    expect((await t.call('GET', '/api/groups', { cookie: B })).body.groups).toEqual([]);
    expect((await t.call('GET', `/api/groups/${groupId}`)).status).toBe(401);
    expect((await t.call('GET', '/api/groups/not-a-uuid', { cookie: A })).status).toBe(404);
  });

  it('adds members, rejects duplicate names, records activity', async () => {
    expect((await t.call('POST', `/api/groups/${groupId}/members`, { cookie: A, body: { name: 'Meera' } })).status).toBe(201);
    expect((await t.call('POST', `/api/groups/${groupId}/members`, { cookie: A, body: { name: 'meera' } })).status).toBe(409);
    const { activity } = (await t.call('GET', `/api/groups/${groupId}/activity`, { cookie: A })).body;
    expect(activity.map((a) => a.action)).toEqual(['member.added', 'group.created']);
  });
});

describe('expenses', () => {
  it('splits on the server to the exact paisa and keeps balances at zero', async () => {
    expect((await post(expense())).status).toBe(201);
    const [e] = await expenses();
    expect(e.splits.reduce((s, x) => s + x.amount, 0)).toBe(100000);
    const d = await detail();
    expect(d.members.reduce((s, m) => s + m.balance, 0)).toBe(0);
    expect(d.members.find((m) => m.id === me).balance).toBe(66666); // paid 1000.00, own share 333.34
  });

  it('handles percentage, shares and exact splits', async () => {
    const people = [me, riya, kabir];
    const pct = await post(expense({ splitMethod: 'percentage', participants: people.map((memberId, i) => ({ memberId, value: [3333, 3333, 3334][i] })) }));
    const shr = await post(expense({ splitMethod: 'shares', participants: people.map((memberId, i) => ({ memberId, value: [1, 2, 4][i] })) }));
    const exa = await post(expense({ splitMethod: 'exact', participants: people.map((memberId, i) => ({ memberId, value: [50000, 30000, 20000][i] })) }));
    for (const r of [pct, shr, exa]) {
      expect(r.status).toBe(201);
      expect(Object.values(r.body.expense.splits).reduce((a, b) => a + b, 0)).toBe(100000);
    }
    expect((await detail()).members.reduce((s, m) => s + m.balance, 0)).toBe(0);
  });

  it('rejects invalid input and saves nothing', async () => {
    const before = (await expenses()).length;
    const exact = expense({ splitMethod: 'exact', participants: [{ memberId: me, value: 50000 }, { memberId: riya, value: 40000 }] });
    expect((await post(exact)).status).toBe(422);
    expect((await post(expense({ paidBy: '00000000-0000-4000-8000-000000000000' }))).status).toBe(400);
    expect((await post(expense({ date: '2026-02-31' }))).status).toBe(400);
    expect((await post(expense({ amount: 12.5 }))).status).toBe(400);
    expect((await post(expense({ amount: 0 }))).status).toBe(400);
    expect((await post(expense({ description: '  ' }))).status).toBe(400);
    expect((await post(expense({ participants: [{ memberId: me }, { memberId: me }] }))).status).toBe(400);
    expect((await expenses()).length).toBe(before);
  });

  it('saves a repeated request only once (idempotency)', async () => {
    const before = (await expenses()).length;
    const k = key();
    const first = await post(expense({ description: 'Once only' }), k);
    const again = await post(expense({ description: 'Once only' }), k);
    expect(first.status).toBe(201);
    expect(again.body).toMatchObject({ replayed: true, expense: { id: first.body.expense.id } });
    expect((await post(expense({ description: 'Different' }), k)).status).toBe(422);
    expect((await t.call('POST', `/api/groups/${groupId}/expenses`, { cookie: A, body: expense() })).status).toBe(400); // no key
    const k2 = key();
    const burst = await Promise.all(Array.from({ length: 5 }, () => post(expense({ description: 'Burst' }), k2)));
    expect(burst.every((r) => r.status === 201)).toBe(true);
    expect((await expenses()).length).toBe(before + 2);
  });
});

describe('settlements', () => {
  let g, a, r, k;
  const settle = (from, to, amount, kk = key(), cookie = A) =>
    t.call('POST', `/api/groups/${g}/settlements`, { cookie, key: kk, body: { fromMember: from, toMember: to, amount } });

  beforeAll(async () => {
    g = (await t.call('POST', '/api/groups', { cookie: A, body: { name: 'Trip', category: 'travel', memberNames: ['Riya', 'Kabir'] } })).body.group.id;
    const d = await detail(g);
    a = d.myMemberId;
    r = d.members.find((m) => m.name === 'Riya').id;
    k = d.members.find((m) => m.name === 'Kabir').id;
    await post(expense({ amount: 90000, paidBy: a, participants: [a, r, k].map((memberId) => ({ memberId })) }), key(), g);
  });

  it('suggests the fewest payments', async () => {
    const { suggestions } = (await t.call('GET', `/api/groups/${g}/suggestions`, { cookie: A })).body;
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.toMember === a && s.amount === 30000)).toBe(true);
  });

  it('records a payment once, refuses overpayment and duplicates', async () => {
    const kk = key();
    const first = await settle(r, a, 30000, kk);
    expect(first.status).toBe(201);
    expect((await settle(r, a, 30000, kk)).body.replayed).toBe(true);
    expect((await settle(r, a, 30000)).status).toBe(422); // already settled
    expect((await settle(k, a, 30001)).status).toBe(422); // more than owed
    expect((await settle(a, a, 100)).status).toBe(400);
    expect((await t.call('POST', `/api/groups/${g}/settlements`, { cookie: B, key: key(), body: { fromMember: k, toMember: a, amount: 100 } })).status).toBe(404);
  });

  it('lets only one of two simultaneous payments succeed, then everyone is settled', async () => {
    const results = await Promise.all([settle(k, a, 30000), settle(k, a, 30000)]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 422]);
    const d = await detail(g);
    expect(d.members.every((m) => m.balance === 0)).toBe(true);
    expect((await t.call('GET', `/api/groups/${g}/suggestions`, { cookie: A })).body.suggestions).toEqual([]);
    expect((await t.call('GET', `/api/groups/${g}/settlements`, { cookie: A })).body.settlements).toHaveLength(2);
  });
});
