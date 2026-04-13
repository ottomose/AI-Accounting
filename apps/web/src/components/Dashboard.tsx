import { useSession, signOut } from '../lib/auth';

export function Dashboard() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">AI Accounting</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session?.user.name}
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                {session?.user.role ?? 'client'}
              </span>
            </span>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-600 hover:underline"
            >
              გასვლა
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              კომპანიები
            </h3>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              ტრანზაქციები
            </h3>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              დოკუმენტები
            </h3>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
        </div>
      </main>
    </div>
  );
}
