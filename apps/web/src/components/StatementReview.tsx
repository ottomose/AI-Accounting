import { useState } from 'react';
import { parseStatement, createJournalEntry, getAccounts, seedCompanyAccounts } from '../lib/api';
import type { ParsedStatement, ParsedTransaction, Account } from '../lib/api';

interface Props {
  documentId: string;
  companyId: string;
  onClose: () => void;
}

type TxRow = ParsedTransaction & {
  _selected: boolean;
  _debit: string;
  _credit: string;
  _posted?: boolean;
  _error?: string;
};

export function StatementReview({ documentId, companyId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function handleParse() {
    setLoading(true);
    setError('');
    try {
      const [{ statement: st }, accRes] = await Promise.all([
        parseStatement(documentId),
        getAccounts(companyId),
      ]);
      setStatement(st);
      setAccounts(accRes.accounts.filter((a) => !(a as unknown as { isGroup: boolean }).isGroup));
      setRows(
        st.transactions.map((tx) => ({
          ...tx,
          // Select unposted rows with both debit/credit suggested; skip already-posted
          _selected: !tx.alreadyPosted && !!(tx.suggestion?.debitAccountCode && tx.suggestion?.creditAccountCode),
          _debit: tx.suggestion?.debitAccountCode ?? '',
          _credit: tx.suggestion?.creditAccountCode ?? '',
          _posted: tx.alreadyPosted,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'დაპარსვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<TxRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function postSelected() {
    if (!statement) return;
    const codeToAccount = new Map(accounts.map((a) => [a.code, a]));
    console.log('[postSelected] total accounts:', accounts.length, 'first few codes:', accounts.slice(0, 5).map((a) => a.code));
    setPosting(true);
    setError('');

    let posted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row._selected || row._posted) continue;
      const debitAcc = codeToAccount.get(row._debit);
      const creditAcc = codeToAccount.get(row._credit);
      if (!debitAcc || !creditAcc) {
        const msg = `ანგარიშის კოდი ვერ მოიძებნა: debit="${row._debit}" credit="${row._credit}"`;
        console.error('[postSelected]', msg, 'row:', row);
        updateRow(i, { _error: msg });
        errors.push(`#${i + 1}: ${msg}`);
        failed++;
        continue;
      }

      try {
        const res = await createJournalEntry({
          date: row.date,
          description: `${row.description}${row.partnerName ? ` — ${row.partnerName}` : ''}`,
          currency: (row.currency || 'GEL') as 'GEL',
          companyId,
          sourceRef: row.transactionId,
          lines: [
            { accountId: debitAcc.id, debit: row.amount, credit: 0, description: row.description },
            { accountId: creditAcc.id, debit: 0, credit: row.amount, description: row.description },
          ],
        });
        const isDup = (res as unknown as { duplicate?: boolean }).duplicate;
        updateRow(i, { _posted: true, _error: isDup ? 'უკვე გატარებული' : undefined });
        posted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Post failed';
        console.error('[postSelected] entry failed:', msg, row);
        updateRow(i, { _error: msg });
        errors.push(`#${i + 1}: ${msg}`);
        failed++;
      }
    }

    setPosting(false);
    if (failed > 0) {
      setError(`გატარდა ${posted}, ვერ გატარდა ${failed}. ${errors.slice(0, 3).join(' | ')}`);
    }
  }

  if (!statement) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">ამონაწერის ანალიზი</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
            დახურვა
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          XLSX ამონაწერი (TBC) daparsda, ყოველ ტრანზაქციაზე შემოთავაზდება debit/credit ანგარიშები.
        </p>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <button
          onClick={handleParse}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'ვამუშავებ...' : 'დაწყება'}
        </button>
      </div>
    );
  }

  const selectedCount = rows.filter((r) => r._selected && !r._posted).length;
  const postedCount = rows.filter((r) => r._posted).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">ამონაწერის ანალიზი — {statement.bank}</h3>
          <p className="text-sm text-gray-500">
            {statement.periodStart} — {statement.periodEnd} · {rows.length} ტრანზაქცია · საწყისი ნაშთი{' '}
            {statement.openingBalance?.toFixed(2)} → საბოლოო {statement.closingBalance?.toFixed(2)}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          დახურვა
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <div className="mb-4 p-3 bg-gray-50 border rounded-lg flex items-center justify-between">
        <span className="text-xs text-gray-600">
          ანგარიშთა გეგმა: {accounts.length} ანგარიში
        </span>
        <button
          onClick={async () => {
            const hasAccounts = accounts.length > 0;
            const msg = hasAccounts
              ? 'ანგარიშთა გეგმა და ყველა გატარება წაიშლება და ჩაიწერება BASS-ის ახალი გეგმა. გავაგრძელო?'
              : 'BASS-ის ანგარიშთა გეგმა შეიქმნას?';
            if (!confirm(msg)) return;
            try {
              await seedCompanyAccounts(companyId, hasAccounts);
              const res = await getAccounts(companyId);
              setAccounts(res.accounts);
              setError('');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Seed failed');
            }
          }}
          className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          {accounts.length === 0 ? 'BASS გეგმის შექმნა' : 'BASS გეგმის განახლება (reset)'}
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ ანგარიშთა გეგმა არ არის. დააჭირე ზემოთ ღილაკს BASS-ის შესაქმნელად.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={postSelected}
          disabled={posting || selectedCount === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          {posting ? 'ვტვირთავ...' : `${selectedCount} ჩანაწერის გატარება`}
        </button>
        <button
          onClick={() => setRows((p) => p.map((r) => ({ ...r, _selected: !r._posted })))}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
        >
          ყველას მონიშვნა
        </button>
        {postedCount > 0 && (
          <span className="px-3 py-2 text-sm text-green-600">{postedCount} გატარებულია ✓</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 w-8"></th>
              <th className="p-2">თარიღი</th>
              <th className="p-2">აღწერა</th>
              <th className="p-2 text-right">თანხა</th>
              <th className="p-2">Debit</th>
              <th className="p-2">Credit</th>
              <th className="p-2">მიზეზი</th>
              <th className="p-2 w-20">სტატუსი</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const conf = row.suggestion?.confidence;
              const confColor =
                conf === 'high' ? 'border-l-green-400'
                : conf === 'medium' ? 'border-l-yellow-400'
                : conf === 'low' ? 'border-l-red-400'
                : 'border-l-gray-200';
              return (
                <tr
                  key={i}
                  className={`border-b border-l-4 ${confColor} ${row._posted ? 'bg-green-50 opacity-60' : ''}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={row._selected}
                      disabled={row._posted}
                      onChange={(e) => updateRow(i, { _selected: e.target.checked })}
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap">{row.date}</td>
                  <td className="p-2 max-w-xs">
                    <div className="truncate" title={row.description}>{row.description}</div>
                    {row.partnerName && (
                      <div className="text-gray-400 text-[10px] truncate">{row.partnerName}</div>
                    )}
                  </td>
                  <td className={`p-2 text-right whitespace-nowrap ${row.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {row.direction === 'in' ? '+' : '-'}{row.amount.toFixed(2)}
                  </td>
                  <td className="p-2">
                    <select
                      value={row._debit}
                      disabled={row._posted}
                      onChange={(e) => updateRow(i, { _debit: e.target.value })}
                      className="border rounded px-1 py-0.5 text-xs w-32"
                    >
                      <option value="">—</option>
                      {accounts.map((a) => (
                        <option key={a.code} value={a.code}>{a.code} {a.nameKa}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={row._credit}
                      disabled={row._posted}
                      onChange={(e) => updateRow(i, { _credit: e.target.value })}
                      className="border rounded px-1 py-0.5 text-xs w-32"
                    >
                      <option value="">—</option>
                      {accounts.map((a) => (
                        <option key={a.code} value={a.code}>{a.code} {a.nameKa}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-gray-500 max-w-xs truncate" title={row.suggestion?.reason}>
                    {row.suggestion?.reason || '—'}
                  </td>
                  <td className="p-2">
                    {row._posted ? <span className="text-green-600" title="უკვე გატარებული">✓</span>
                      : row._error ? <span className="text-red-600" title={row._error}>⚠</span>
                      : row.suggestion?.needsReview ? <span className="text-yellow-600">შემოწმე</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
