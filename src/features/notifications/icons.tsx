import { Bell, CalendarRange, HandCoins, Receipt, UserPlus, Users } from 'lucide-react';
import type { AppNotification } from '../../types';

const kinds: Record<AppNotification['type'], { icon: typeof Bell; tone: string }> = {
  expense: { icon: Receipt, tone: 'bg-violet-100 text-violet-700' },
  settlement: { icon: HandCoins, tone: 'bg-emerald-100 text-emerald-700' },
  friend: { icon: UserPlus, tone: 'bg-sky-100 text-sky-700' },
  group: { icon: Users, tone: 'bg-amber-100 text-amber-700' },
  recap: { icon: CalendarRange, tone: 'bg-pink-100 text-pink-700' },
};

export function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  const { icon: Icon, tone } = kinds[type] ?? { icon: Bell, tone: 'bg-slate-100 text-slate-600' };
  return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={17} /></span>;
}
