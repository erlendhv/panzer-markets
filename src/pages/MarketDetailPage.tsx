import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Market } from '../types/firestore';
import { OrderBookDisplay } from '../components/market/OrderBookDisplay';
import { PlaceOrderForm } from '../components/market/PlaceOrderForm';
import { CommentsSection } from '../components/market/CommentsSection';

export function MarketDetailPage() {
  const { marketId } = useParams<{ marketId: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!marketId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'markets', marketId),
      (snapshot) => {
        if (snapshot.exists()) {
          setMarket({ id: snapshot.id, ...snapshot.data() } as Market);
        } else {
          setMarket(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching market:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [marketId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-red-900 mb-2">Bet ikke funnet</h2>
        <p className="text-red-700">Denne beten eksisterer ikke eller har blitt fjernet.</p>
      </div>
    );
  }

  const yesPrice = market.lastTradedPrice.yes;
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = 100 - yesPercent;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('nb-NO', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: Market['status']) => {
    switch (status) {
      case 'open':
        return 'åpen';
      case 'closed':
        return 'lukket';
      case 'resolved':
        return 'avgjort';
      default:
        return status;
    }
  };

  const getStatusColor = (status: Market['status']) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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

  const getOutcomeBanner = (outcome: Market['resolutionOutcome']) => {
    switch (outcome) {
      case 'YES':
        return 'bg-green-100 border-green-400';
      case 'NO':
        return 'bg-red-100 border-red-400';
      case 'INVALID':
        return 'bg-gray-100 border-gray-400';
      default:
        return 'bg-gray-100 border-gray-400';
    }
  };

  const getOutcomeTextColor = (outcome: Market['resolutionOutcome']) => {
    switch (outcome) {
      case 'YES':
        return 'text-green-800';
      case 'NO':
        return 'text-red-800';
      case 'INVALID':
        return 'text-gray-800';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div>
      {/* Market Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{market.question}</h1>
            {market.description && (
              <p className="text-gray-600">{market.description}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(market.status)}`}>
            {getStatusLabel(market.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          <div>
            <div className="text-sm text-gray-500">Totalt volum</div>
            <div className="text-lg font-semibold text-gray-900">${market.totalVolume.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Avgjørelsesdato</div>
            <div className="text-lg font-semibold text-gray-900">{formatDate(market.resolutionDate)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">JA-andeler</div>
            <div className="text-lg font-semibold text-green-600">{market.totalYesShares.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">NEI-andeler</div>
            <div className="text-lg font-semibold text-red-600">{market.totalNoShares.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Resolution Outcome Banner */}
      {market.status === 'resolved' && market.resolutionOutcome && (
        <div className={`rounded-lg border-2 p-6 mb-6 ${getOutcomeBanner(market.resolutionOutcome)}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium ${getOutcomeTextColor(market.resolutionOutcome)} opacity-75`}>
                Utfall
              </div>
              <div className={`text-3xl font-bold ${getOutcomeTextColor(market.resolutionOutcome)}`}>
                {getOutcomeLabel(market.resolutionOutcome)}
              </div>
            </div>
            <div className="text-right">
              {market.resolvedAt && (
                <div className={`text-sm ${getOutcomeTextColor(market.resolutionOutcome)} opacity-75`}>
                  Avgjort {formatDate(market.resolvedAt)}
                </div>
              )}
              {market.resolutionNote && (
                <div className={`text-sm ${getOutcomeTextColor(market.resolutionOutcome)} mt-1`}>
                  {market.resolutionNote}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">JA</span>
            <span className="text-3xl font-bold text-green-700">{yesPercent}¢</span>
          </div>
          <div className="w-full bg-green-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-700">NEI</span>
            <span className="text-3xl font-bold text-red-700">{noPercent}¢</span>
          </div>
          <div className="w-full bg-red-200 rounded-full h-3">
            <div
              className="bg-red-600 h-3 rounded-full transition-all"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Order Form */}
        <div className="lg:col-span-2">
          <PlaceOrderForm market={market} />
        </div>

        {/* Order Book */}
        <div>
          <OrderBookDisplay marketId={market.id} />
        </div>
      </div>

      {/* Comments */}
      <CommentsSection marketId={market.id} />
    </div>
  );
}
