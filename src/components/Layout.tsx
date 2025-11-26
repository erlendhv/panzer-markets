import { Link, useLocation } from 'react-router-dom';
import { AuthButton } from './AuthButton';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: 'Bets', href: '/' },
    { name: 'Avgjort', href: '/resolved' },
    { name: 'Dine bets', href: '/portfolio' },
    { name: 'Foreslå bet', href: '/propose' },
  ];

  if (user?.isAdmin) {
    navigation.push({ name: 'Admin', href: '/admin' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <div className="text-2xl font-bold text-gray-900">Panzer Markets</div>
              </Link>
              {user && (
                <div className="hidden md:flex gap-1">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <AuthButton />
          </div>
        </div>
      </nav>
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
          {children}
        </main>
      </div>
    </div>
  );
}
