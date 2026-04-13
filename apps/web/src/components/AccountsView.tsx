import { useState, useEffect } from 'react';
import { getAccounts, getTrialBalance } from '../lib/api';
import type { Account, TrialBalanceResponse } from '../lib/api';

interface AccountsViewProps {
  companyId: string;
}

export function AccountsView({ companyId }: AccountsViewProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [view, setView] = useState<'chart' | 'balance'>('chart');
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    try {
      const [accountsData, balanceData] = await Promise.all([
        getAccounts(companyId),
        getTrialBalance(companyId),
      ]);
      setAccounts(accountsData.accounts || []);
      setTrialBalance(balanceData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const typeColors: Record<string, string> = {
    asset: 'bg-green-100 text-green-700',
    liability: 'bg-red-100 text-red-700',
    equity: 'bg-purple-100 text-purple-700',
    revenue: 'bg-blue-100 text-blue-700',
    expense: 'bg-orange-100 text-orange-700',
  };

  const typeLabels: Record<string, string> = {
    asset: 'აქტივი',
    liability: 'ვალდებულება',
    equity: 'კაპიტალი',
    revenue: 'შემოსავალი',
    expense: 'ხარჯი',
  };

  const filteredAccounts = filterType
    ? accounts.filter((a) => a.type === filterType)
    : accounts;

  if (loading) return <div className="text-gray-500 py-8 text-center">იტვირთება...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">ანგარიშთა გეგმა</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('chart')}
            className={`px-3 py-1.5 rounded-lg text-sm ${view === 'chart' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            ანგარიშები
          </button>
          <button
            onClick={() => setView('balance')}
            className={`px-3 py-1.5 rounded-lg text-sm ${view === 'balance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            საცდელი ბალანსი
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setFilterType('')}
              className={`px-3 py-1 rounded-full text-xs ${!filterType ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              ყველა
            </button>
            {Object.entries(typeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1 rounded-full text-xs ${filterType === key ? 'bg-gray-800 text-white' : typeColors[key]}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">კოდი</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">სახელი</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ტიპი</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">დონე</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAccounts.map((account) => (
                  <tr key={account.code} className={account.isGroup ? 'bg-gray-50 font-medium' : ''}>
                    <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                    <td className="px-4 py-3 text-sm" style={{ paddingLeft: `${(account.level - 1) * 20 + 16}px` }}>
                      <div>{account.nameKa}</div>
                      <div className="text-xs text-gray-400">{account.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[account.type]}`}>
                        {typeLabels[account.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{account.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">კოდი</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ანგარიში</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">დებეტი</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">კრედიტი</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ნაშთი</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {trialBalance?.accounts.map((row) => (
                <tr key={row.code}>
                  <td className="px-4 py-3 text-sm font-mono">{row.code}</td>
                  <td className="px-4 py-3 text-sm">{row.nameKa}</td>
                  <td className="px-4 py-3 text-sm text-right">{row.debit.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right">{row.credit.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${row.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.balance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm">ჯამი</td>
                <td className="px-4 py-3 text-sm text-right">{trialBalance?.totalDebit.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right">{trialBalance?.totalCredit.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {trialBalance?.isBalanced ? (
                    <span className="text-green-600">დაბალანსებული</span>
                  ) : (
                    <span className="text-red-600">არ არის დაბალანსებული</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
