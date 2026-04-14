import { useState, useEffect, Fragment } from 'react';
import {
  getJournalEntries,
  postJournalEntry,
  deleteJournalEntry,
  voidJournalEntry,
  updateJournalEntry,
  getAccounts,
} from '../lib/api';
import type { JournalEntry, JournalLine, Account } from '../lib/api';

interface Props {
  companyId: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  posted: 'bg-green-100 text-green-700',
  voided: 'bg-gray-100 text-gray-500',
};
const statusLabels: Record<string, string> = {
  draft: 'მონახაზი',
  posted: 'გატარებული',
  voided: 'გაუქმებული',
};

export function JournalEntriesView({ companyId }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    load();
  }, [companyId]);

  async function load() {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([getJournalEntries(companyId), getAccounts(companyId)]);
      setEntries(e.entries || []);
      setAccounts((a.accounts || []).filter((x) => !x.isGroup));
      setSelected(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  }
  function toggleSelect(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  const draftIds = entries.filter((e) => e.status === 'draft').map((e) => e.id);
  const selectedDrafts = draftIds.filter((id) => selected.has(id));

  async function bulkPost() {
    if (selectedDrafts.length === 0) return;
    setBusy(true);
    setErr('');
    let ok = 0,
      fail = 0;
    for (const id of selectedDrafts) {
      try {
        await postJournalEntry(id);
        ok++;
      } catch {
        fail++;
      }
    }
    setBusy(false);
    if (fail > 0) setErr(`გატარდა ${ok}, ვერ გატარდა ${fail}`);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('წაიშალოს ჩანაწერი?')) return;
    try {
      await deleteJournalEntry(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleVoid(id: string) {
    if (!confirm('გაუქმდეს ჩანაწერი? (posted → voided)')) return;
    try {
      await voidJournalEntry(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Void failed');
    }
  }

  if (loading) return <div className="text-gray-500 py-8 text-center">იტვირთება...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">ბუღალტრული ჩანაწერები</h2>
        <div className="text-sm text-gray-500">{entries.length} ჩანაწერი</div>
      </div>

      {err && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{err}</div>}

      {draftIds.length > 0 && (
        <div className="mb-4 flex gap-2 items-center">
          <button
            onClick={() => {
              if (selectedDrafts.length === draftIds.length) setSelected(new Set());
              else setSelected(new Set(draftIds));
            }}
            className="text-xs px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            {selectedDrafts.length === draftIds.length ? 'გაუქმება' : `ყველა მონახაზი (${draftIds.length})`}
          </button>
          <button
            onClick={bulkPost}
            disabled={busy || selectedDrafts.length === 0}
            className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? 'ვამუშავებ...' : `${selectedDrafts.length} ჩანაწერის დადასტურება`}
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          ჩანაწერები არ არის
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="w-8 p-2"></th>
                <th className="w-8 p-2"></th>
                <th className="text-left p-2">ნომერი</th>
                <th className="text-left p-2">თარიღი</th>
                <th className="text-left p-2">აღწერა</th>
                <th className="text-right p-2">თანხა</th>
                <th className="text-center p-2">ხაზები</th>
                <th className="text-left p-2">სტატუსი</th>
                <th className="text-right p-2">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => {
                const isOpen = expanded.has(e.id);
                const isDraft = e.status === 'draft';
                return (
                  <Fragment key={e.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="p-2 text-center">
                        {isDraft && (
                          <input
                            type="checkbox"
                            checked={selected.has(e.id)}
                            onChange={() => toggleSelect(e.id)}
                          />
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => toggleExpand(e.id)}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {isOpen ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="p-2 font-mono text-xs">{e.entryNumber}</td>
                      <td className="p-2 whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString('ka-GE')}
                      </td>
                      <td className="p-2 max-w-md">
                        <div className="truncate" title={e.description}>{e.description}</div>
                      </td>
                      <td className="p-2 text-right font-mono whitespace-nowrap">
                        {Number(e.totalDebit || 0).toFixed(2)} {e.currency}
                      </td>
                      <td className="p-2 text-center text-xs text-gray-500">{e.lineCount ?? e.lines?.length ?? 0}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[e.status]}`}>
                          {statusLabels[e.status]}
                        </span>
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {isDraft && (
                          <>
                            <button
                              onClick={() => postJournalEntry(e.id).then(load)}
                              className="text-xs text-blue-600 hover:underline mr-2"
                            >
                              გატარება
                            </button>
                            <button
                              onClick={() => setEditing(e)}
                              className="text-xs text-gray-600 hover:underline mr-2"
                            >
                              რედაქტ.
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              წაშლა
                            </button>
                          </>
                        )}
                        {e.status === 'posted' && (
                          <button
                            onClick={() => handleVoid(e.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            გაუქმება
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && e.lines && (
                      <tr className="bg-gray-50">
                        <td colSpan={9} className="p-3">
                          <table className="w-full text-xs">
                            <thead className="text-gray-500">
                              <tr>
                                <th className="text-left p-1">ანგარიში</th>
                                <th className="text-left p-1">აღწერა</th>
                                <th className="text-right p-1">დებეტი</th>
                                <th className="text-right p-1">კრედიტი</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.lines.map((l) => (
                                <tr key={l.id} className="border-t border-gray-200">
                                  <td className="p-1 font-mono">
                                    {l.accountCode} — {l.accountNameKa || l.accountName}
                                  </td>
                                  <td className="p-1 text-gray-600">{l.description || '—'}</td>
                                  <td className="p-1 text-right font-mono">
                                    {Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : ''}
                                  </td>
                                  <td className="p-1 text-right font-mono">
                                    {Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : ''}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-gray-300 font-semibold">
                                <td className="p-1" colSpan={2}>სულ</td>
                                <td className="p-1 text-right font-mono">{Number(e.totalDebit || 0).toFixed(2)}</td>
                                <td className="p-1 text-right font-mono">{Number(e.totalCredit || 0).toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          entry={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  entry: JournalEntry;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}

type EditLine = {
  accountId: string;
  description: string;
  debit: number;
  credit: number;
};

function EditModal({ entry, accounts, onClose, onSaved }: EditModalProps) {
  const [date, setDate] = useState(entry.date.slice(0, 10));
  const [description, setDescription] = useState(entry.description);
  const [lines, setLines] = useState<EditLine[]>(
    (entry.lines || []).map((l: JournalLine) => ({
      accountId: l.accountId,
      description: l.description || '',
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  function updateLine(i: number, patch: Partial<EditLine>) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!balanced) {
      setErr(`დებეტი (${totalDebit.toFixed(2)}) ≠ კრედიტი (${totalCredit.toFixed(2)})`);
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await updateJournalEntry(entry.id, {
        date,
        description,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          description: l.description || undefined,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-lg font-bold">რედაქტირება — {entry.entryNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{err}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">თარიღი</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">აღწერა</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-600">ხაზები</label>
              <button
                onClick={() =>
                  setLines((p) => [...p, { accountId: '', description: '', debit: 0, credit: 0 }])
                }
                className="text-xs text-blue-600 hover:underline"
              >
                + ხაზის დამატება
              </button>
            </div>
            <table className="w-full text-xs border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">ანგარიში</th>
                  <th className="p-2 text-left">აღწერა</th>
                  <th className="p-2 text-right">დებეტი</th>
                  <th className="p-2 text-right">კრედიტი</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <select
                        value={l.accountId}
                        onChange={(e) => updateLine(i, { accountId: e.target.value })}
                        className="border rounded px-1 py-1 text-xs w-full"
                      >
                        <option value="">—</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} {a.nameKa}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        className="border rounded px-1 py-1 text-xs w-full"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={l.debit || ''}
                        onChange={(e) => updateLine(i, { debit: Number(e.target.value) || 0 })}
                        className="border rounded px-1 py-1 text-xs w-24 text-right"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={l.credit || ''}
                        onChange={(e) => updateLine(i, { credit: Number(e.target.value) || 0 })}
                        className="border rounded px-1 py-1 text-xs w-24 text-right"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold bg-gray-50">
                  <td className="p-2" colSpan={2}>სულ</td>
                  <td className="p-2 text-right font-mono">{totalDebit.toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">{totalCredit.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <div className={`mt-2 text-xs ${balanced ? 'text-green-600' : 'text-red-600'}`}>
              {balanced ? '✓ დაბალანსებულია' : `სხვაობა: ${(totalDebit - totalCredit).toFixed(2)}`}
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            გაუქმება
          </button>
          <button
            onClick={save}
            disabled={saving || !balanced}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            {saving ? 'ვინახავ...' : 'შენახვა'}
          </button>
        </div>
      </div>
    </div>
  );
}
