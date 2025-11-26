import { useMarkets } from '../hooks/useMarkets';
import { MarketCard } from '../components/MarketCard';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../contexts/GroupContext';
import type { Market } from '../types/firestore';

export function ResolvedPage() {
  const { user } = useAuth();
  const { selectedGroupId, myGroups } = useGroups();

  const userGroupIds = myGroups.map(g => g.id);

  const { markets, loading, error } = useMarkets({
    status: 'resolved',
    groupId: selectedGroupId,
    userGroupIds,
  });

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
          Logg inn for å se avgjorte bets
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

  const getOutcomeLabel = (outcome: Market['resolutionOutcome']) => {
    switch (outcome) {
      case 'YES':
        return 'JA';
      case 'NO':
        return 'NEI';
      case 'INVALID':
        return 'Ugyldig';
      default:
        return '-';
    }
  };

  const getOutcomeColor = (outcome: Market['resolutionOutcome']) => {
    switch (outcome) {
      case 'YES':
        return 'text-green-700 bg-green-100';
      case 'NO':
        return 'text-red-700 bg-red-100';
      case 'INVALID':
        return 'text-gray-700 bg-gray-100';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {selectedGroup ? `Avgjort - ${selectedGroup.name}` : 'Avgjorte bets'}
        </h1>
        <p className="text-gray-600">
          {selectedGroup
            ? `Avgjorte bets i ${selectedGroup.name}`
            : 'Se hvordan tidligere bets ble avgjort'}
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen avgjorte bets enda</h3>
          <p className="text-gray-600">
            Når bets blir avgjort vil de dukke opp her
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {markets.map((market) => (
            <div key={market.id} className="relative">
              <MarketCard market={market} />
              {market.resolutionOutcome && (
                <div className="absolute top-4 right-20 z-10">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getOutcomeColor(market.resolutionOutcome)}`}>
                    {getOutcomeLabel(market.resolutionOutcome)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
