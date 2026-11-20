export type GroupCategory = 'flatmates' | 'travel' | 'friends_family';
export type ExpenseCategory = 'food' | 'rent' | 'utilities' | 'groceries' | 'travel' | 'stay' | 'other';
export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

// Shapes returned by the server API. All money is integer paise.
export interface GroupSummary {
  id: string;
  name: string;
  category: GroupCategory;
  memberCount: number;
  myBalance: number;
}
export interface Member {
  id: string;
  name: string;
  userId: string | null;
  role: 'admin' | 'member';
  balance: number;
}
export interface GroupDetail {
  group: { id: string; name: string; category: GroupCategory };
  myMemberId: string;
  members: Member[];
}
export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitMethod: SplitMethod;
  category: ExpenseCategory;
  date: string;
  notes: string | null;
  splits: { memberId: string; amount: number }[];
}
export interface Suggestion {
  fromMember: string;
  toMember: string;
  amount: number;
}
export interface Settlement extends Suggestion {
  id: string;
  status: 'pending' | 'completed';
  createdAt: string;
}
export interface ActivityItem {
  id: number;
  message: string;
  createdAt: string;
  actorName: string | null;
}
export interface RecentActivity {
  id: number;
  message: string;
  createdAt: string;
  groupName: string;
}

export interface FriendUser {
  id: string; // friendship id
  userId: string;
  name: string;
  email?: string | null;
  username?: string | null;
}
export interface FriendsResponse {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
}
export type TimelineItem =
  | {
      kind: 'expense';
      id: string;
      groupId: string;
      groupName: string;
      description: string;
      category: ExpenseCategory;
      date: string;
      amount: number;
      myShare: number;
      paidByMe: boolean;
      payerName: string;
      splitMethod: SplitMethod;
      notes: string | null;
    }
  | { kind: 'settlement'; id: string; groupId: string; groupName: string; date: string; amount: number; iPaid: boolean; fromName: string; toName: string };
export interface TimelineResponse {
  items: TimelineItem[];
  summary: {
    totalShare: number;
    totalPaid: number;
    byMonth: { period: string; spent: number }[];
    byYear: { period: string; spent: number }[];
  };
}
export interface InvitePreview {
  groupId: string;
  groupName: string;
  invitedBy: string;
  claimName: string | null;
  alreadyMember: boolean;
}

// ---- notifications, analytics, recap and shared reports ----
export interface AppNotification {
  id: number;
  type: 'expense' | 'settlement' | 'friend' | 'group' | 'recap';
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}
export interface CategoryTotal {
  category: ExpenseCategory;
  spent: number;
  count: number;
}
export interface NamedTotal {
  name: string;
  spent: number;
  count: number;
}
export interface Recap {
  month: string;
  person: string;
  totals: { share: number; paid: number; count: number; avgExpense: number; dailyAverage: number };
  previous: { month: string; share: number; changePct: number | null };
  categories: CategoryTotal[];
  groups: NamedTotal[];
  daily: { date: string; spent: number }[];
  topDay: { date: string; spent: number } | null;
  topExpense: { description: string; groupName: string; date: string; share: number; amount: number } | null;
  payments: { sent: number; sentCount: number; received: number; receivedCount: number };
}
export interface Analytics {
  months: number;
  trend: { month: string; spent: number; paid: number; count: number }[];
  categories: CategoryTotal[];
  groups: NamedTotal[];
  weekday: { day: number; spent: number }[];
  topExpenses: { id: string; groupId: string; description: string; groupName: string; date: string; share: number }[];
  stats: { total: number; count: number; averagePerMonth: number; busiestMonth: { month: string; spent: number } | null };
}
export interface GroupReport {
  group: { name: string; category: GroupCategory; memberCount: number };
  month: string | null;
  totals: { spend: number; count: number; average: number };
  categories: CategoryTotal[];
  monthly: { month: string; spent: number; count: number }[];
  members: { name: string; paid: number; share: number; balance: number }[];
  topExpenses: { description: string; date: string; amount: number; paidBy: string }[];
  payments: { count: number; total: number };
  settleUp: { from: string; to: string; amount: number }[];
}
export interface SharedReportItem {
  id: string;
  kind: 'monthly' | 'group';
  title: string;
  expiresAt: string;
  views: number;
  createdAt: string;
  active: boolean;
}
export type PublicReport =
  | { kind: 'monthly'; title: string; sharedBy: string; createdAt: string; expiresAt: string; payload: Recap }
  | { kind: 'group'; title: string; sharedBy: string; createdAt: string; expiresAt: string; payload: GroupReport };
