import { useState, useEffect } from 'react';
import { getAccounts, getJournalEntries, getDocuments } from '../lib/api';

interface DashboardViewProps {
  companyId: string;
  companyName: string;
}

export function DashboardView({ companyId, companyName }: DashboardViewProps) {
  const [stats, setStats] = useState({ accounts: 0, entries: 0, documents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [companyId]);

  async function loadStats() {
    setLoading(true);
    try {
      const [accountsData, entriesData, docsData] = await Promise.all([
        getAccounts(companyId),
        getJournalEntries(companyId),
        getDocuments(companyId),
      ]);
      setStats({
        accounts: (accountsData.accounts || []).length,
        entries: (entriesData.entries || []).length,
        documents: (docsData.documents || []).length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { label: 'ანგარიშები', value: stats.accounts, color: 'text-blue-600' },
    { label: 'ბუღალტრული ჩანაწერები', value: stats.entries, color: 'text-green-600' },
    { label: 'დოკუმენტები', value: stats.documents, color: 'text-purple-600' },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">{companyName}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-6 border">
            <h3 className="text-sm font-medium text-gray-500 mb-1">{card.label}</h3>
            <p className={`text-3xl font-bold ${card.color}`}>
              {loading ? '...' : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">სწრაფი მოქმედებები</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium text-gray-800">AI ჩატი</h4>
            <p className="text-sm text-gray-500 mt-1">
              ესაუბრეთ AI ბუღალტერს — შექმნის ჩანაწერებს, აჩვენებს ბალანსს
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium text-gray-800">დოკუმენტის ატვირთვა</h4>
            <p className="text-sm text-gray-500 mt-1">
              ატვირთეთ ჩეკი ან ინვოისი — AI ავტომატურად ამოიცნობს მონაცემებს
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
