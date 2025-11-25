import { Link } from 'react-router-dom';
import type { Market } from '../types/firestore';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const yesPrice = market.lastTradedPrice.yes;
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = 100 - yesPercent;

  const getStatusColor = (status: Market['status']) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-blue-100 text-blue-800';
      case 'proposed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Link
      to={`/market/${market.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-4">
          {market.question}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(market.status)}`}>
          {market.status}
        </span>
      </div>

      {market.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{market.description}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-green-700">YES</span>
              <span className="text-lg font-bold text-green-700">{yesPercent}¢</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-red-700">NO</span>
              <span className="text-lg font-bold text-red-700">{noPercent}¢</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm text-gray-500 pt-2 border-t border-gray-100">
          <div>
            <span className="font-medium">Volume:</span> ${market.totalVolume.toFixed(0)}
          </div>
          <div>
            <span className="font-medium">Resolves:</span> {formatDate(market.resolutionDate)}
          </div>
        </div>
      </div>
    </Link>
  );
}
