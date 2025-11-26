import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import type { MarketProposal, Market } from '../../types/firestore';

export function ProposalReview() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<MarketProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'proposals'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const proposalData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketProposal[];

      proposalData.sort((a, b) => b.createdAt - a.createdAt);
      setProposals(proposalData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleApprove = async (proposal: MarketProposal, initialYesPrice: number) => {
    if (!user) return;

    setProcessingId(proposal.id);
    try {
      // Create the market
      const newMarket: Omit<Market, 'id'> = {
        question: proposal.question,
        description: proposal.description,
        creatorId: user.uid,
        status: 'open',
        groupId: proposal.groupId ?? null, // null for public markets
        createdAt: Date.now(),
        resolutionDate: proposal.suggestedResolutionDate,
        resolvedAt: null,
        lastTradedPrice: {
          yes: initialYesPrice,
          no: 1 - initialYesPrice,
        },
        resolutionOutcome: null,
        resolutionNote: null,
        totalVolume: 0,
        totalYesShares: 0,
        totalNoShares: 0,
      };

      const marketRef = await addDoc(collection(db, 'markets'), newMarket);

      // Update proposal
      await updateDoc(doc(db, 'proposals', proposal.id), {
        status: 'approved',
        reviewedBy: user.uid,
        reviewedAt: Date.now(),
        marketId: marketRef.id,
      });

    } catch (err) {
      console.error('Error approving proposal:', err);
      alert('Failed to approve proposal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (proposal: MarketProposal, reason: string) => {
    if (!user) return;

    setProcessingId(proposal.id);
    try {
      await updateDoc(doc(db, 'proposals', proposal.id), {
        status: 'rejected',
        reviewedBy: user.uid,
        reviewedAt: Date.now(),
        rejectionReason: reason,
      });
    } catch (err) {
      console.error('Error rejecting proposal:', err);
      alert('Failed to reject proposal');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('nb-NO', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-600">Ingen ventende forslag</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          onApprove={handleApprove}
          onReject={handleReject}
          processing={processingId === proposal.id}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
}

interface ProposalCardProps {
  proposal: MarketProposal;
  onApprove: (proposal: MarketProposal, initialPrice: number) => void;
  onReject: (proposal: MarketProposal, reason: string) => void;
  processing: boolean;
  formatDate: (timestamp: number) => string;
}

function ProposalCard({ proposal, onApprove, onReject, processing, formatDate }: ProposalCardProps) {
  const [initialPrice, setInitialPrice] = useState('0.50');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{proposal.question}</h3>
        {proposal.description && (
          <p className="text-gray-600 text-sm mb-4">{proposal.description}</p>
        )}
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div>
            <span className="font-medium">Foreslått avgjørelse:</span> {formatDate(proposal.suggestedResolutionDate)}
          </div>
          <div>
            <span className="font-medium">Foreslått:</span> {formatDate(proposal.createdAt)}
          </div>
        </div>
      </div>

      {!showRejectForm ? (
        <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
          <div className="flex-1">
            <label htmlFor={`price-${proposal.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Startpris JA
            </label>
            <input
              id={`price-${proposal.id}`}
              type="number"
              min="0.01"
              max="0.99"
              step="0.01"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              disabled={processing}
            />
          </div>
          <div className="flex gap-2 pt-6">
            <button
              onClick={() => onApprove(proposal, parseFloat(initialPrice))}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
            >
              {processing ? 'Behandler...' : 'Godkjenn'}
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={processing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
            >
              Avslå
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Årsak til avslag
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
            placeholder="Forklar hvorfor dette forslaget blir avslått..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onReject(proposal, rejectionReason);
                setShowRejectForm(false);
                setRejectionReason('');
              }}
              disabled={processing || !rejectionReason}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
            >
              {processing ? 'Behandler...' : 'Bekreft avslag'}
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectionReason('');
              }}
              disabled={processing}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
