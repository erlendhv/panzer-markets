import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CreateMarketForm } from '../components/admin/CreateMarketForm';
import { UserManagement } from '../components/admin/UserManagement';
import { ProposalReview } from '../components/admin/ProposalReview';
import { MarketResolution } from '../components/admin/MarketResolution';

type AdminTab = 'markets' | 'users' | 'proposals' | 'resolve';

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('markets');

  if (!user?.isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-red-900 mb-2">Ingen tilgang</h2>
        <p className="text-red-700">Du trenger admin-rettigheter for å se denne siden.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'markets' as AdminTab, label: 'Opprett bet', icon: '📊' },
    { id: 'resolve' as AdminTab, label: 'Avgjør bets', icon: '✓' },
    { id: 'users' as AdminTab, label: 'Administrer brukere', icon: '👥' },
    { id: 'proposals' as AdminTab, label: 'Se forslag', icon: '📝' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin</h1>
        <p className="text-gray-600">Administrer bets, brukere og forslag</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'markets' && <CreateMarketForm />}
        {activeTab === 'resolve' && <MarketResolution />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'proposals' && <ProposalReview />}
      </div>
    </div>
  );
}
