import { useMarkets } from '../hooks/useMarkets';
import { MarketCard } from '../components/MarketCard';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../contexts/GroupContext';

export function MarketsPage() {
  const { user } = useAuth();
  const { selectedGroupId, myGroups } = useGroups();

  // Get list of user's group IDs for filtering
  const userGroupIds = myGroups.map(g => g.id);

  const { markets, loading, error } = useMarkets({
    status: 'open',
    groupId: selectedGroupId,
    userGroupIds,
  });

  // Find selected group name for header
  const selectedGroup = selectedGroupId
    ? myGroups.find(g => g.id === selectedGroupId)
    : null;

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Velkommen til Panzer Markets
        </h2>
        <p className="text-gray-600 mb-8">
          Logg inn for å begynne å bette
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {selectedGroup ? selectedGroup.name : 'Alle bets'}
        </h1>
        <p className="text-gray-600">
          {selectedGroup
            ? `Aktive bets i ${selectedGroup.name}`
            : 'Alle aktive bets du har tilgang til'}
        </p>
      </div>

      {markets.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen aktive bets</h3>
          <p className="text-gray-600">
            Vær den første til å foreslå en bet og få den godkjent!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
