import { useMarketParticipants } from '../../hooks/useMarketParticipants';

interface MarketParticipantsProps {
  marketId: string;
}

export function MarketParticipants({ marketId }: MarketParticipantsProps) {
  const { participants, loading } = useMarketParticipants(marketId);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deltakere</h3>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deltakere</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Ingen har bettet ennå</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Deltakere ({participants.length})
      </h3>
      <div className="space-y-3">
        {participants.map((participant) => (
          <div
            key={participant.user.uid}
            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex items-center gap-3">
              {participant.user.photoURL ? (
                <img
                  src={participant.user.photoURL}
                  alt={participant.user.displayName || 'Bruker'}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-300 text-sm">
                    {participant.user.displayName?.[0] || '?'}
                  </span>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {participant.user.displayName || 'Ukjent'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {participant.orderCount} ordre{participant.orderCount !== 1 ? 'r' : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                ${participant.totalAmount.toFixed(0)}
              </div>
              <div className="flex gap-2 text-xs">
                {participant.yesAmount > 0 && (
                  <span className="text-green-600 dark:text-green-400">JA ${participant.yesAmount.toFixed(0)}</span>
                )}
                {participant.noAmount > 0 && (
                  <span className="text-red-600 dark:text-red-400">NEI ${participant.noAmount.toFixed(0)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
