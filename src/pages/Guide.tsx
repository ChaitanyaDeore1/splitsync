import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Info, Lightbulb, Search, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../components/Status';
import { faqs, glossary, sections } from '../features/guide/content';
import type { Block } from '../features/guide/content';
import { useStore } from '../store/useStore';

const textOf = (b: Block): string =>
  b.t === 'p' || b.t === 'tip' || b.t === 'warn' ? b.text : b.t === 'steps' || b.t === 'list' ? b.items.join(' ') : b.t === 'table' ? [...b.head, ...b.rows.flat()].join(' ') : b.text;

function Render({ b }: { b: Block }) {
  switch (b.t) {
    case 'p':
      return <p className="text-slate-700 leading-relaxed">{b.text}</p>;
    case 'steps':
      return (
        <ol className="space-y-3">
          {b.items.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
              <span className="text-slate-700 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700 marker:text-brand-500">
          {b.items.map((s) => <li key={s} className="leading-relaxed">{s}</li>)}
        </ul>
      );
    case 'tip':
      return <p className="flex gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><Lightbulb size={18} className="mt-0.5 shrink-0" />{b.text}</p>;
    case 'warn':
      return <p className="flex gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><TriangleAlert size={18} className="mt-0.5 shrink-0" />{b.text}</p>;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>{b.head.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {b.rows.map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={c} className={`px-4 py-2.5 align-top ${i === 0 ? 'font-medium whitespace-nowrap' : 'text-slate-600'}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'link':
      return <Link to={b.to} className="inline-flex text-sm font-medium text-brand-700 hover:underline">{b.text} →</Link>;
  }
}

export default function Guide() {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const openTour = useStore((s) => s.openTour);
  const { hash } = useLocation();
  const q = query.trim().toLowerCase();

  // Jump to a section when the address has #section-id
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const shown = useMemo(
    () => (q ? sections.filter((s) => `${s.title} ${s.summary} ${s.blocks.map(textOf).join(' ')}`.toLowerCase().includes(q)) : sections),
    [q],
  );
  const shownFaqs = q ? faqs.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q)) : faqs;
  const shownTerms = q ? glossary.filter((g) => `${g.term} ${g.meaning}`.toLowerCase().includes(q)) : glossary;
  const nothing = q && shown.length + shownFaqs.length + shownTerms.length === 0;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Guide"
        subtitle="Everything you need to know about SplitSync, from your first group to shared reports."
        actions={<button onClick={openTour} className="btn-secondary"><Info size={16} /> Take the tour</button>}
      />

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the guide: settle, percentage, share link…" aria-label="Search the guide" className="input !pl-10 !py-2.5" />
      </div>

      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
        <nav aria-label="Guide sections" className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-20">
            <p className="section-title">On this page</p>
            <ul className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
              {sections.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); history.replaceState(null, '', `#${s.id}`); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    className={`block rounded-lg px-3 py-1.5 text-sm hover:bg-white hover:text-brand-700 ${shown.includes(s) ? 'text-slate-600' : 'text-slate-300'}`}>
                    {s.title}
                  </a>
                </li>
              ))}
              <li className="shrink-0"><a href="#faq" className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white hover:text-brand-700">FAQ</a></li>
              <li className="shrink-0"><a href="#glossary" className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white hover:text-brand-700">Glossary</a></li>
            </ul>
          </div>
        </nav>

        <div className="space-y-6 min-w-0">
          {nothing && <div className="card-empty text-slate-500">Nothing matches “{query}”. Try a simpler word.</div>}

          {shown.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-20 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{s.title}</h2>
                <p className="text-sm text-slate-500">{s.summary}</p>
              </div>
              {s.blocks.map((b, i) => <Render key={i} b={b} />)}
            </section>
          ))}

          {shownFaqs.length > 0 && (
            <section id="faq" className="card scroll-mt-20 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">Frequently asked questions</h2>
              <ul className="divide-y divide-slate-100">
                {shownFaqs.map((f, i) => {
                  const open = q ? true : openFaq === i;
                  return (
                    <li key={f.q}>
                      <button onClick={() => setOpenFaq(open && !q ? null : i)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-3 text-left font-medium">
                        {f.q}
                        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && <p className="pb-3 text-slate-600 leading-relaxed">{f.a}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {shownTerms.length > 0 && (
            <section id="glossary" className="card scroll-mt-20 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">Glossary</h2>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {shownTerms.map((g) => (
                  <div key={g.term}>
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-sm text-slate-600">{g.meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
