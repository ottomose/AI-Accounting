import { useState } from 'react';
import { parseInvoices, createJournalEntry, getAccounts } from '../lib/api';
import type { ParsedInvoice, Account } from '../lib/api';

interface Props {
  documentId: string;
  companyId: string;
  onClose: () => void;
}

type Row = ParsedInvoice & {
  _selected: boolean;
  _posted?: boolean;
  _error?: string;
};

export function InvoiceReview({ documentId, companyId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function handleParse() {
    setLoading(true);
    setError('');
    try {
      const [{ invoices }, accRes] = await Promise.all([
        parseInvoices(documentId),
        getAccounts(companyId),
      ]);
      setAccounts(accRes.accounts.filter((a) => !a.isGroup));
      setRows(
        invoices.map((inv) => ({
          ...inv,
          _selected: !inv.alreadyPosted && !!inv.suggestion && inv.direction !== 'unknown',
          _posted: inv.alreadyPosted,
        }))
      );
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'დაპარსვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function postSelected() {
    const codeToAccount = new Map(accounts.map((a) => [a.code, a]));
    setPosting(true);
    setError('');
    let ok = 0, fail = 0;
    const errs: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row._selected || row._posted || !row.suggestion) continue;

      // Resolve codes → IDs
      const lines = row.suggestion.lines.map((l) => {
        const a = codeToAccount.get(l.accountCode);
        return a ? { accountId: a.id, debit: l.debit, credit: l.credit, description: l.description } : null;
      });
      if (lines.some((l) => l === null)) {
        const missing = row.suggestion.lines
          .filter((l) => !codeToAccount.has(l.accountCode))
          .map((l) => l.accountCode)
          .join(', ');
        updateRow(i, { _error: `ანგარიში ვერ მოიძებნა: ${missing}` });
        errs.push(`#${i + 1}: ${missing}`);
        fail++;
        continue;
      }

      try {
        const counterparty = row.direction === 'sale' ? row.buyerName : row.sellerName;
        const desc = `${row.description}${counterparty ? ` — ${counterparty}` : ''} (ფაქტურა ${row.series || row.invoiceId})`;
        const res = await createJournalEntry({
          date: row.operationDate || row.issueDate || new Date().toISOString().slice(0, 10),
          description: desc,
          currency: 'GEL',
          companyId,
          sourceRef: row.invoiceId,
          lines: lines as { accountId: string; debit: number; credit: number; description?: string }[],
        });
        const isDup = (res as unknown as { duplicate?: boolean }).duplicate;
        updateRow(i, { _posted: true, _error: isDup ? 'უკვე გატარებული' : undefined });
        ok++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Post failed';
        updateRow(i, { _error: msg });
        errs.push(`#${i + 1}: ${msg}`);
        fail++;
      }
    }

    setPosting(false);
    if (fail > 0) setError(`გატარდა ${ok}, ვერ გატარდა ${fail}. ${errs.slice(0, 3).join(' | ')}`);
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">ფაქტურების რეესტრი (RS.ge)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
            დახურვა
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          RS.ge-ს XLSX რეესტრიდან ავტომატურად გაკეთდება გაყიდვა/შესყიდვის გატარებები.
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
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">ფაქტურების რეესტრი</h3>
          <p className="text-sm text-gray-500">
            {rows.length} ფაქტურა · ჯამი {totalAmount.toFixed(2)} GEL · დღგ {totalVat.toFixed(2)}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          დახურვა
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <div className="flex gap-2 mb-4">
        <button
          onClick={postSelected}
          disabled={posting || selectedCount === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          {posting ? 'ვტვირთავ...' : `${selectedCount} ფაქტურის გატარება`}
        </button>
        <button
          onClick={() => setRows((p) => p.map((r) => ({ ...r, _selected: !r._posted && !!r.suggestion })))}
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
              <th className="p-2">მიმართ.</th>
              <th className="p-2">თარიღი</th>
              <th className="p-2">კონტრაგენტი</th>
              <th className="p-2 max-w-xs">აღწერა</th>
              <th className="p-2 text-right">ჯამი</th>
              <th className="p-2 text-right">დღგ</th>
              <th className="p-2">გატარება</th>
              <th className="p-2 w-16">სტატ.</th>
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
              const dirLabel =
                row.direction === 'sale' ? '📤 გაყიდვა'
                : row.direction === 'purchase' ? '📥 შესყიდვა'
                : '—';
              const dirColor =
                row.direction === 'sale' ? 'text-green-700'
                : row.direction === 'purchase' ? 'text-blue-700'
                : 'text-gray-400';
              const counterparty = row.direction === 'sale' ? row.buyerName : row.sellerName;
              return (
                <tr
                  key={row.invoiceId}
                  className={`border-b border-l-4 ${confColor} ${row._posted ? 'bg-green-50 opacity-60' : ''}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={row._selected}
                      disabled={row._posted || !row.suggestion}
                      onChange={(e) => updateRow(i, { _selected: e.target.checked })}
                    />
                  </td>
                  <td className={`p-2 whitespace-nowrap ${dirColor}`}>{dirLabel}</td>
                  <td className="p-2 whitespace-nowrap">{row.operationDate || row.issueDate || '—'}</td>
                  <td className="p-2 max-w-[160px]">
                    <div className="truncate" title={counterparty}>{counterparty || '—'}</div>
                  </td>
                  <td className="p-2 max-w-xs">
                    <div className="truncate" title={row.description}>{row.description}</div>
                    <div className="text-gray-400 text-[10px]">{row.series}</div>
                  </td>
                  <td className="p-2 text-right font-mono whitespace-nowrap">{row.totalAmount.toFixed(2)}</td>
                  <td className="p-2 text-right font-mono whitespace-nowrap">{row.vat.toFixed(2)}</td>
                  <td className="p-2 text-gray-600 max-w-xs">
                    {row.suggestion ? (
                      <div className="text-[10px]">
                        {row.suggestion.lines.map((l, j) => (
                          <div key={j}>
                            {l.debit > 0 ? `Dr ${l.accountCode} ${l.debit.toFixed(2)}` : `Cr ${l.accountCode} ${l.credit.toFixed(2)}`}
                          </div>
                        ))}
                        <div className="text-gray-400 mt-0.5 truncate" title={row.suggestion.reason}>
                          {row.suggestion.reason}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
