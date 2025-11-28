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
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'closed':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'resolved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'proposed':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('nb-NO', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
      case 'proposed':
        return 'foreslått';
      default:
        return status;
    }
  };

  return (
    <Link
      to={`/market/${market.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 pr-4">
          {market.question}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(market.status)}`}>
          {getStatusLabel(market.status)}
        </span>
      </div>

      {market.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{market.description}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">JA</span>
              <span className="text-lg font-bold text-green-700 dark:text-green-400">{yesPercent}¢</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">NEI</span>
              <span className="text-lg font-bold text-red-700 dark:text-red-400">{noPercent}¢</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <span className="font-medium">Volum:</span> ${market.totalVolume.toFixed(0)}
          </div>
          <div>
            <span className="font-medium">Avgjøres:</span> {formatDate(market.resolutionDate)}
          </div>
        </div>
      </div>
    </Link>
  );
}
