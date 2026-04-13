import { useState, useEffect } from 'react';
import { getJournalEntries, postJournalEntry } from '../lib/api';
import type { JournalEntry } from '../lib/api';

interface JournalEntriesViewProps {
  companyId: string;
}

export function JournalEntriesView({ companyId }: JournalEntriesViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, [companyId]);

  async function loadEntries() {
    setLoading(true);
    try {
      const data = await getJournalEntries(companyId);
      setEntries(data.entries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(id: string) {
    try {
      await postJournalEntry(id);
      await loadEntries();
    } catch (err) {
      console.error(err);
    }
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

  if (loading) return <div className="text-gray-500 py-8 text-center">იტვირთება...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">ბუღალტრული ჩანაწერები</h2>
        <div className="text-sm text-gray-500">{entries.length} ჩანაწერი</div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-gray-400 text-lg mb-2">ჩანაწერები არ არის</div>
          <p className="text-gray-400 text-sm">
            გამოიყენეთ AI ჩატი ჩანაწერების ავტომატურად შესაქმნელად
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ნომერი</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">თარიღი</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">აღწერა</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ვალუტა</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">სტატუსი</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{entry.entryNumber}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(entry.date).toLocaleDateString('ka-GE')}
                  </td>
                  <td className="px-4 py-3 text-sm">{entry.description}</td>
                  <td className="px-4 py-3 text-sm">{entry.currency}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[entry.status]}`}>
                      {statusLabels[entry.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.status === 'draft' && (
                      <button
                        onClick={() => handlePost(entry.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        გატარება
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
