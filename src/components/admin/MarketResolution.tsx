import { useState } from 'react';
import { useMarkets } from '../../hooks/useMarkets';
import { resolveMarket } from '../../services/api';
import type { Market } from '../../types/firestore';

export function MarketResolution() {
  const { markets, loading } = useMarkets();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Avgjør bets</h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {resolvableMarkets.length === 0 ? (
        <p className="text-gray-600 text-center py-8">Ingen bets å avgjøre</p>
      ) : (
        <div className="space-y-6">
          {resolvableMarkets.map((market) => (
            <div
              key={market.id}
              className={`border rounded-lg p-4 ${
                isPastResolutionDate(market.resolutionDate)
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{market.question}</h3>
                  {market.description && (
                    <p className="text-sm text-gray-600 mt-1">{market.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      market.status === 'open'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {getStatusLabel(market.status)}
                  </span>
                  {isPastResolutionDate(market.resolutionDate) && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Forfalt
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-500">Avgjørelsesdato:</span>
                  <div className="font-medium">{formatDate(market.resolutionDate)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Volum:</span>
                  <div className="font-medium">${market.totalVolume.toFixed(0)}</div>
                </div>
                <div>
                  <span className="text-gray-500">JA-pris:</span>
                  <div className="font-medium text-green-600">
                    {Math.round(market.lastTradedPrice.yes * 100)}¢
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">NEI-pris:</span>
                  <div className="font-medium text-red-600">
                    {Math.round((1 - market.lastTradedPrice.yes) * 100)}¢
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSelectedOutcome({ ...selectedOutcome, [market.id]: 'YES' })
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedOutcome[market.id] === 'YES'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
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
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
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
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <button
                  onClick={() => handleResolve(market)}
                  disabled={!selectedOutcome[market.id] || resolvingId === market.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {resolvingId === market.id ? 'Avgjør...' : 'Avgjør bet'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
