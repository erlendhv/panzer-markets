import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AuthButton } from './AuthButton';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4 md:gap-8">
              {/* Hamburger menu button - mobile only */}
              {user && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  aria-label="Toggle menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {sidebarOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              )}
              <Link to="/" className="flex items-center gap-2">
                <div className="text-xl md:text-2xl font-bold text-gray-900">Panzer Markets</div>
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

      {/* Mobile navigation drawer */}
      {user && sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 top-16">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative bg-white w-72 max-w-[85vw] h-full overflow-y-auto shadow-xl">
            {/* Mobile nav links */}
            <div className="p-4 border-b border-gray-200">
              <div className="space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
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
            </div>
            {/* Groups sidebar content */}
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />

            {/* Mobile logout button */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  signOut(auth);
                  setSidebarOpen(false);
                }}
                className="w-full px-4 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Logg ut
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop sidebar - hidden on mobile */}
        {user && <Sidebar className="hidden md:block" />}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
          {children}
        </main>
      </div>

      <footer className="bg-gray-100 border-t border-gray-200 py-4 text-center text-sm text-gray-500">
        Panzer Markets © 2026 · Laget av Plomma og Kringla
      </footer>
    </div>
  );
}
