import { useState } from 'react';
import { useSession, signOut } from '../lib/auth';
import type { Company } from '../lib/api';

interface LayoutProps {
  company: Company | null;
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCompanySwitch: () => void;
}

const tabs = [
  { id: 'dashboard', label: 'მთავარი' },
  { id: 'accounts', label: 'ანგარიშები' },
  { id: 'entries', label: 'ჩანაწერები' },
  { id: 'documents', label: 'დოკუმენტები' },
  { id: 'chat', label: 'AI ჩატი' },
];

export function Layout({ company, children, activeTab, onTabChange, onCompanySwitch }: LayoutProps) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">AI Accounting</h1>
            {company && (
              <button
                onClick={onCompanySwitch}
                className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1"
              >
                {company.name} ▾
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session?.user.name}
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                {(session?.user as Record<string, unknown>).role as string ?? 'client'}
              </span>
            </span>
            <button onClick={() => signOut()} className="text-sm text-red-600 hover:underline">
              გასვლა
            </button>
          </div>
        </div>
      </nav>

      {company && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
