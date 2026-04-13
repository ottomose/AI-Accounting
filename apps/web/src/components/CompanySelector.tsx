import { useState, useEffect } from 'react';
import { getCompanies, createCompany } from '../lib/api';
import type { Company } from '../lib/api';

interface CompanySelectorProps {
  onSelect: (company: Company) => void;
}

export function CompanySelector({ onSelect }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const data = await getCompanies();
      setCompanies(data.companies);
      if (data.companies.length === 1) {
        onSelect(data.companies[0]);
      }
    } catch (err) {
      setError('კომპანიების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const data = await createCompany(name, taxId);
      setCompanies((prev) => [...prev, data.company]);
      onSelect(data.company);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'შექმნა ვერ მოხერხდა');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">იტვირთება...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">აირჩიეთ კომპანია</h2>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

        {companies.length > 0 && (
          <div className="space-y-2 mb-6">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => onSelect(company)}
                className="w-full text-left p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <div className="font-medium text-gray-900">{company.name}</div>
                <div className="text-sm text-gray-500">ს/ნ: {company.taxId}</div>
              </button>
            ))}
          </div>
        )}

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + ახალი კომპანიის დამატება
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                კომპანიის სახელი
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="შპს მაგალითი"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                საიდენტიფიკაციო ნომერი
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="000000000"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'იქმნება...' : 'შექმნა'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                გაუქმება
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
