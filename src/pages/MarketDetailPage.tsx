import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Market, Group, User } from '../types/firestore';
import { OrderBookDisplay } from '../components/market/OrderBookDisplay';
import { PlaceOrderForm } from '../components/market/PlaceOrderForm';
import { CommentsSection, CommentsSectionRef } from '../components/market/CommentsSection';
import { MarketParticipants } from '../components/market/MarketParticipants';
import { MarketHistoryChart } from "../components/market/MarketHistoryChart";
import { MarketBannedUsers } from '../components/market/MarketBannedUsers';
import { MarketResolveForm } from '../components/market/MarketResolveForm';
import { useComments } from '../hooks/useComments';
import { useAuth } from '../hooks/useAuth';
import { useUserCache } from '../contexts/UserCacheContext';


export function MarketDetailPage() {
  const { marketId } = useParams<{ marketId: string }>();
  const { user } = useAuth();
  const { getUsers } = useUserCache();
  const [market, setMarket] = useState<Market | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { comments } = useComments(marketId);
  const chartRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<CommentsSectionRef>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);





  useEffect(() => {
    if (!marketId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'markets', marketId),
      async (snapshot) => {
        if (snapshot.exists()) {
          const marketData = { id: snapshot.id, ...snapshot.data() } as Market;
          setMarket(marketData);

          // Fetch group if market belongs to one
          if (marketData.groupId) {
            const groupDoc = await getDoc(doc(db, 'groups', marketData.groupId));
            if (groupDoc.exists()) {
              setGroup({ id: groupDoc.id, ...groupDoc.data() } as Group);
            }
          } else {
            setGroup(null);
          }

          // Fetch creator info
          if (marketData.creatorId) {
            const users = await getUsers([marketData.creatorId]);
            setCreator(users.get(marketData.creatorId) || null);
          }
        } else {
          setMarket(null);
          setGroup(null);
          setCreator(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching market:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [marketId, getUsers]);

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
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'closed':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'resolved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">{market.question}</h1>
            {market.description && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{market.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {group ? (
                <Link
                  to={`/groups/${group.id}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  <span className="text-gray-500 dark:text-gray-400">Gruppe:</span> {group.name}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  Offentlig marked
                </span>
              )}
              {user?.isAdmin && creator && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <span>Opprettet av:</span>
                  {creator.photoURL && (
                    <img src={creator.photoURL} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">{creator.displayName || creator.email}</span>
                </span>
              )}
            </div>
          </div>
          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${getStatusColor(market.status)}`}>
            {getStatusLabel(market.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Totalt volum</div>
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">${market.totalVolume.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Avgjørelsesdato</div>
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{formatDate(market.resolutionDate)}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">JA-andeler</div>
            <div className="text-base sm:text-lg font-semibold text-green-600 dark:text-green-400">{market.totalYesShares.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">NEI-andeler</div>
            <div className="text-base sm:text-lg font-semibold text-red-600 dark:text-red-400">{market.totalNoShares.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Resolution Outcome Banner */}
      {market.status === 'resolved' && market.resolutionOutcome && (
        <div className={`rounded-lg border-2 p-4 sm:p-6 mb-6 ${getOutcomeBanner(market.resolutionOutcome)}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div>
              <div className={`text-sm font-medium ${getOutcomeTextColor(market.resolutionOutcome)} opacity-75`}>
                Utfall
              </div>
              <div className={`text-2xl sm:text-3xl font-bold ${getOutcomeTextColor(market.resolutionOutcome)}`}>
                {getOutcomeLabel(market.resolutionOutcome)}
              </div>
            </div>
            <div className="sm:text-right">
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

      {/* Resolve Form (for admins/creators) */}
      <MarketResolveForm market={market} />

      {/* Price Display */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700 dark:text-green-400">JA</span>
            <span className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400">{yesPercent}¢</span>
          </div>
          <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2 sm:h-3">
            <div
              className="bg-green-600 h-2 sm:h-3 rounded-full transition-all"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-700 dark:text-red-400">NEI</span>
            <span className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-400">{noPercent}¢</span>
          </div>
          <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2 sm:h-3">
            <div
              className="bg-red-600 h-2 sm:h-3 rounded-full transition-all"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>
      </div>

    <div ref={chartRef}>
    <MarketHistoryChart
        history={market.history}
        comments={comments}
        onTimestampSelect={(ts) => {
        setSelectedTimestamp(ts);
        commentRef.current?.setAttachedTimestamp(ts);
        setTimeout(() => commentRef.current?.scrollIntoView(), 50);
        }}
        highlightTimestamp={selectedTimestamp}
    />
    </div>



      {/* Trading Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        {/* Order Form */}
        <div className="lg:col-span-2">
          <PlaceOrderForm market={market} />
        </div>

        {/* Order Book and Participants */}
        <div className="space-y-4 sm:space-y-6">
          <OrderBookDisplay marketId={market.id} />
          <MarketParticipants marketId={market.id} />
        </div>
      </div>

      {/* Banned Users Management (Admin only) */}
      <div className="mb-6">
        <MarketBannedUsers market={market} />
      </div>

      {/* Comments */}
    <CommentsSection
    ref={commentRef}
    marketId={market.id}
    selectedTimestamp={selectedTimestamp}
    clearSelectedTimestamp={() => setSelectedTimestamp(null)}
    onTimestampClick={(ts) => {
        setSelectedTimestamp(ts); 
        chartRef.current?.scrollIntoView({ behavior: 'smooth' });
    }}
    />

    </div>
  );
}
