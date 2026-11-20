import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export const Loading = () => (
  <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
    <div className="h-7 w-1/3 rounded-lg bg-slate-200" />
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="h-24 rounded-2xl bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-200" />
    </div>
    <div className="h-48 rounded-2xl bg-slate-200" />
  </div>
);

export const ErrorBox = ({ message }: { message: string }) => (
  <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 text-owe px-4 py-3 text-sm">
    <AlertCircle size={16} className="mt-0.5 shrink-0" /> {message}
  </p>
);

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
  </div>
);

export const EmptyState = ({ title, text, children }: { title: string; text?: string; children?: ReactNode }) => (
  <div className="card-empty">
    <p className="font-medium">{title}</p>
    {text && <p className="text-slate-500 text-sm mt-1">{text}</p>}
    {children && <div className="mt-3">{children}</div>}
  </div>
);

export const Stat = ({ label, value, hint, tone }: { label: string; value: string; hint?: ReactNode; tone?: 'good' | 'bad' }) => (
  <div className="card p-5">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`text-2xl font-bold mt-1 tabular-nums ${tone === 'good' ? 'text-owed' : tone === 'bad' ? 'text-owe' : 'text-slate-900'}`}>{value}</p>
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);
