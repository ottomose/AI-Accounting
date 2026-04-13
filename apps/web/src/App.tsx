import { useSession } from './lib/auth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';

function App() {
  const { data: session, isPending } = useSession();

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

  return <Dashboard />;
}

export default App;
