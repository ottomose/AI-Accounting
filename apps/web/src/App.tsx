import { useState } from 'react';
import { useSession } from './lib/auth';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { CompanySelector } from './components/CompanySelector';
import { DashboardView } from './components/DashboardView';
import { AccountsView } from './components/AccountsView';
import { JournalEntriesView } from './components/JournalEntriesView';
import { ChatView } from './components/ChatView';
import { DocumentsView } from './components/DocumentsView';
import type { Company } from './lib/api';

function App() {
  const { data: session, isPending } = useSession();
  const [company, setCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">იტვირთება...</div>
      </div>
    );
  }

  if (!session) {
    return <AuthForm onSuccess={() => window.location.reload()} />;
  }

  if (!company) {
    return <CompanySelector onSelect={setCompany} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView companyId={company.id} companyName={company.name} />;
      case 'accounts':
        return <AccountsView companyId={company.id} />;
      case 'entries':
        return <JournalEntriesView companyId={company.id} />;
      case 'chat':
        return <ChatView companyId={company.id} />;
      case 'documents':
        return <DocumentsView companyId={company.id} />;
      default:
        return <DashboardView companyId={company.id} companyName={company.name} />;
    }
  };

  return (
    <Layout
      company={company}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onCompanySwitch={() => setCompany(null)}
    >
      {renderTab()}
    </Layout>
  );
}

export default App;
