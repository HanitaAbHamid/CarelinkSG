import { useState } from 'react';
import { Bandage, Compass, Receipt, Plus } from 'lucide-react';
import type { CarePack, CarePackEntry, UserRole } from '../types';
import { apiRequest } from '../lib/api';

interface Props {
  packs: CarePack[];
  entries: CarePackEntry[];
  role: UserRole;
  actor: string;
  onUpdated: () => void;
}

export function CarePackPanels({ packs, entries, role, actor, onUpdated }: Props) {
  const enabledPacks = packs.filter((p) => p.enabled === 1);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [activePack, setActivePack] = useState<string | null>(null);

  // Strict Anti-Bloat Rule: render literally NOTHING if no Care Packs are enabled!
  if (enabledPacks.length === 0) return null;

  async function addEntry(packKey: string) {
    if (!title.trim()) return;
    await apiRequest(`/care-packs/${packKey}/entries`, {
      method: 'POST',
      role,
      actor,
      body: {
        title: title.trim(),
        details: packKey === 'care_expenses' && amount ? { amountSgd: Number(amount) } : {},
      },
    });
    setTitle('');
    setAmount('');
    setActivePack(null);
    onUpdated();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-600">
          Active Opt-In Care Packs
        </h3>
        <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
          {enabledPacks.length} enabled for Ah Ma
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {enabledPacks.map((pack) => {
          const packEntries = entries.filter((e) => e.pack_key === pack.pack_key);
          const Icon =
            pack.pack_key === 'wound_log'
              ? Bandage
              : pack.pack_key === 'care_expenses'
                ? Receipt
                : Compass;

          return (
            <div
              key={pack.pack_key}
              className="rounded-2xl border border-teal-200 bg-white p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{pack.name}</p>
                    <p className="text-xs text-slate-500">{pack.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePack(activePack === pack.pack_key ? null : pack.pack_key)}
                  className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Log
                </button>
              </div>

              {activePack === pack.pack_key && (
                <div className="flex flex-col sm:flex-row gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      pack.pack_key === 'care_expenses'
                        ? 'e.g. Wet market fish & greens'
                        : pack.pack_key === 'wound_log'
                          ? 'e.g. Left heel dressing changed — dry & clean'
                          : 'e.g. Returned safely from void-deck walk'
                    }
                    className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  {pack.pack_key === 'care_expenses' && (
                    <input
                      type="number"
                      step="0.1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="S$ 12.50"
                      className="w-28 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void addEntry(pack.pack_key)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Save
                  </button>
                </div>
              )}

              {packEntries.length > 0 && (
                <div className="divide-y divide-stone-100 text-xs">
                  {packEntries.slice(0, 4).map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-semibold text-slate-800">{e.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {e.logged_by} • {new Date(e.created_at).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {typeof e.details?.amountSgd === 'number' && (
                        <span className="font-extrabold text-teal-800">
                          S${Number(e.details.amountSgd).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
