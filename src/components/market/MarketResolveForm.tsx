import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGroups } from '../../contexts/GroupContext';
import { resolveMarket, deleteMarket } from '../../services/api';
import type { Market } from '../../types/firestore';

interface MarketResolveFormProps {
  market: Market;
}

export function MarketResolveForm({ market }: MarketResolveFormProps) {
  const { user } = useAuth();
  const { memberships } = useGroups();
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO' | 'INVALID' | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check permissions: site admin, group admin, or market creator
  const isSiteAdmin = user?.isAdmin === true;
  const isGroupAdmin = market.groupId
    ? memberships.get(market.groupId)?.role === 'admin'
    : false;
  const isCreator = user?.uid === market.creatorId;
  const canResolve = isSiteAdmin || isGroupAdmin || isCreator;

  // Only show for open/closed markets that haven't been resolved
  if (!canResolve || market.status === 'resolved' || market.status === 'rejected' || market.status === 'proposed') {
    return null;
  }

  const handleResolve = async () => {
    if (!selectedOutcome) {
      setError('Velg et utfall');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resolveMarket({
        marketId: market.id,
        outcome: selectedOutcome,
        note: note || undefined,
      });
      // Page will update via the onSnapshot listener
    } catch (err: any) {
      setError(err.message || 'Kunne ikke avgjøre beten');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canResolve) return;

    const confirmed = window.confirm('Er du sikker på at du vil slette denne beten?');
    if (!confirmed) return;

    setDeleteLoading(true);
    setError(null);

    try {
      await deleteMarket(market.id);
      // After deletion, listeners higher up should notice the market is gone
      // You might also want to navigate away on the page that uses this component.
    } catch (err: any) {
      setError(err.message || 'Kunne ikke slette beten');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Avgjør bet</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedOutcome('YES')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedOutcome === 'YES'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900'
            }`}
          >
            JA
          </button>
          <button
            onClick={() => setSelectedOutcome('NO')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedOutcome === 'NO'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900'
            }`}
          >
            NEI
          </button>
          <button
            onClick={() => setSelectedOutcome('INVALID')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedOutcome === 'INVALID'
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
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />

        <button
          onClick={handleResolve}
          disabled={!selectedOutcome || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Avgjør...' : 'Avgjør bet'}
        </button>

        {canResolve && (
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {deleteLoading ? 'Sletter...' : 'Slett bet'}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {isSiteAdmin && 'Du er site-admin.'}
        {!isSiteAdmin && isGroupAdmin && 'Du er gruppeadmin.'}
        {!isSiteAdmin && !isGroupAdmin && isCreator && 'Du opprettet denne beten.'}
      </p>
    </div>
  );
}
