import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';

const steps = [
  { title: 'Create your first group', text: 'Open Groups and press New group. Name it (for example "Goa Trip") and pick a category.', to: '/groups', cta: 'Open Groups' },
  { title: 'Add friends', text: 'List names when creating a group, or open a group, choose the Members tab and add people any time. Share an invitation link so they can join with their own account.', to: '/friends', cta: 'Open Friends' },
  { title: 'Record and split an expense', text: 'In a group, open Expenses and press Add expense. Choose who paid and who shares it, then split Equal, by Exact amount, Percentage or Shares. The preview shows each share before you save.', to: '/groups', cta: 'Open Groups' },
  { title: 'See who owes whom and settle up', text: 'The Balances tab shows each person\'s position and the payments that settle everyone. Press Mark as paid once someone has paid. Green means you are owed; red means you owe.', to: '/groups', cta: 'Open Groups' },
  { title: 'Stay in the loop', text: 'The bell at the top shows new expenses, payments and friend requests. A small pop-up appears when something arrives.', to: '/notifications', cta: 'Open Notifications' },
  { title: 'Charts and your monthly recap', text: 'Insights charts your spending by month, category and group. The Monthly recap tells the story of one month and compares it with the last.', to: '/recap', cta: 'Open Monthly recap' },
  { title: 'Share a report', text: 'Press Share on a recap or a group report to create a read-only link. Pick how long it works, and turn it off any time.', to: '/insights', cta: 'Open Insights' },
  { title: 'Need more help?', text: 'The Guide covers every feature with examples, an FAQ and troubleshooting. You can reopen this tour from the Guide at any time.', to: '/guide', cta: 'Open the Guide' },
];

export default function Walkthrough() {
  const open = useStore((s) => s.tourOpen);
  const close = useStore((s) => s.closeTour);
  const firstName = useStore((s) => s.user?.name.split(' ')[0]);
  const [index, setIndex] = useState(0);

  if (!open) return null;
  const step = steps[index]!;
  const last = index === steps.length - 1;

  function finish() {
    setIndex(0);
    close();
  }

  return (
    <aside role="dialog" aria-label="Guided tour" className="fixed z-40 bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 bg-white rounded-2xl border border-slate-200 shadow-pop p-5 animate-slide-in">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-brand-700">
          {index === 0 && firstName ? `Welcome, ${firstName}! ` : ''}Step {index + 1} of {steps.length}
        </p>
        <button onClick={finish} aria-label="Skip tour" className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
      </div>
      <div className="h-1 bg-slate-100 rounded mt-2">
        <div className="h-1 bg-brand-600 rounded" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      <h3 className="font-semibold mt-3">{step.title}</h3>
      <p className="text-sm text-slate-600 mt-1">{step.text}</p>
      <Link to={step.to} className="inline-block text-sm text-brand-700 font-medium mt-2">{step.cta} →</Link>
      <div className="flex items-center justify-between mt-4">
        <button onClick={finish} className="text-sm text-slate-500">Skip tour</button>
        <div className="flex gap-2">
          {index > 0 && <button onClick={() => setIndex(index - 1)} className="btn-secondary !py-1.5">Back</button>}
          <button onClick={last ? finish : () => setIndex(index + 1)} className="btn-primary !py-1.5">
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </aside>
  );
}
