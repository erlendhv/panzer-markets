import { useState } from 'react';
import { useMarkets } from '../../hooks/useMarkets';
import { resolveMarket, deleteMarket } from '../../services/api';
import type { Market } from '../../types/firestore';

export function MarketResolution() {
  const { markets, loading } = useMarkets();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<Record<string, 'YES' | 'NO' | 'INVALID'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter to only show markets that can be resolved (open or closed, not already resolved)
  const resolvableMarkets = markets.filter(
    (m) => m.status === 'open' || m.status === 'closed'
  );

  const handleResolve = async (market: Market) => {
    const outcome = selectedOutcome[market.id];
    if (!outcome) {
      setError('Vennligst velg et utfall');
      return;
    }

    setResolvingId(market.id);
    setError(null);
    setSuccess(null);

    try {
      await resolveMarket({
        marketId: market.id,
        outcome,
        note: notes[market.id] || undefined,
      });
      setSuccess(`Bet avgjort som ${outcome}!`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve market');
    } finally {
      setResolvingId(null);
    }
  };

  const handleDelete = async (market: Market) => {
    if (!window.confirm('Er du sikker på at du vil slette dette bettet?')) return;
    setDeletingId(market.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteMarket(market.id);
      setSuccess('Bet slettet!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Kan ikke slette bet');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('nb-NO', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'åpen';
      case 'closed':
        return 'lukket';
      default:
        return status;
    }
  };

  const isPastResolutionDate = (timestamp: number) => {
    return Date.now() > timestamp;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Avgjør bets</h2>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
        </div>
      )}

      {resolvableMarkets.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400 text-center py-8">Ingen bets å avgjøre</p>
      ) : (
        <div className="space-y-6">
          {resolvableMarkets.map((market) => (
            <div
              key={market.id}
              className={`border rounded-lg p-4 ${
                isPastResolutionDate(market.resolutionDate)
                  ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{market.question}</h3>
                  {market.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{market.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      market.status === 'open'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                    }`}
                  >
                    {getStatusLabel(market.status)}
                  </span>
                  {isPastResolutionDate(market.resolutionDate) && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                      Forfalt
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Avgjørelsesdato:</span>
                  <div className="font-medium text-gray-900 dark:text-white">{formatDate(market.resolutionDate)}</div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Volum:</span>
                  <div className="font-medium text-gray-900 dark:text-white">${market.totalVolume.toFixed(0)}</div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">JA-pris:</span>
                  <div className="font-medium text-green-600 dark:text-green-400">
                    {Math.round(market.lastTradedPrice.yes * 100)}¢
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">NEI-pris:</span>
                  <div className="font-medium text-red-600 dark:text-red-400">
                    {Math.round((1 - market.lastTradedPrice.yes) * 100)}¢
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSelectedOutcome({ ...selectedOutcome, [market.id]: 'YES' })
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedOutcome[market.id] === 'YES'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900'
                    }`}
                  >
                    JA
                  </button>
                  <button
                    onClick={() =>
                      setSelectedOutcome({ ...selectedOutcome, [market.id]: 'NO' })
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedOutcome[market.id] === 'NO'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900'
                    }`}
                  >
                    NEI
                  </button>
                  <button
                    onClick={() =>
                      setSelectedOutcome({ ...selectedOutcome, [market.id]: 'INVALID' })
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedOutcome[market.id] === 'INVALID'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    UGYLDIG
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Notat (valgfritt)"
                  value={notes[market.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [market.id]: e.target.value })}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />

                <button
                  onClick={() => handleResolve(market)}
                  disabled={!selectedOutcome[market.id] || resolvingId === market.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {resolvingId === market.id ? 'Avgjør...' : 'Avgjør bet'}
                </button>

                <button
                  onClick={() => handleDelete(market)}
                  disabled={deletingId === market.id}
                  className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {deletingId === market.id ? 'Sletter...' : 'Slett'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
