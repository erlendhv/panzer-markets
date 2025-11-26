import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MarketProposal, Market, Group } from '../types/firestore';

export function ProposePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [formData, setFormData] = useState({
    question: '',
    description: '',
    resolutionDate: '',
    groupId: '', // '' = public, otherwise group ID
    initialYesPrice: '0.50',
  });

  // Fetch user's groups
  useEffect(() => {
    if (!user) {
      setLoadingGroups(false);
      return;
    }

    const fetchGroups = async () => {
      try {
        // Get user's group memberships
        const membershipsQuery = query(
          collection(db, 'groupMembers'),
          where('userId', '==', user.uid)
        );
        const membershipsSnapshot = await getDocs(membershipsQuery);
        const groupIds = membershipsSnapshot.docs.map(doc => doc.data().groupId);

        if (groupIds.length === 0) {
          setUserGroups([]);
          setLoadingGroups(false);
          return;
        }

        // Fetch groups (Firestore 'in' query limited to 10 items)
        const groups: Group[] = [];
        for (let i = 0; i < groupIds.length; i += 10) {
          const chunk = groupIds.slice(i, i + 10);
          const groupsQuery = query(
            collection(db, 'groups'),
            where('__name__', 'in', chunk)
          );
          const groupsSnapshot = await getDocs(groupsQuery);
          groupsSnapshot.docs.forEach(doc => {
            groups.push({ id: doc.id, ...doc.data() } as Group);
          });
        }

        setUserGroups(groups);
      } catch (err) {
        console.error('Error fetching groups:', err);
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [user]);

  if (!user) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Innlogging kreves</h2>
        <p className="text-gray-600">Logg inn for å foreslå en bet.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const resolutionTimestamp = new Date(formData.resolutionDate).getTime();
      const isGroupMarket = formData.groupId !== '';
      const initialYesPrice = parseFloat(formData.initialYesPrice);

      if (isGroupMarket) {
        // Group market: create directly (no approval needed)
        const newMarket: Omit<Market, 'id'> = {
          question: formData.question,
          description: formData.description,
          creatorId: user.uid,
          status: 'open',
          groupId: formData.groupId,
          createdAt: Date.now(),
          resolutionDate: resolutionTimestamp,
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

        await addDoc(collection(db, 'markets'), newMarket);
      } else {
        // Public market: create proposal for site admin approval
        const proposal: Omit<MarketProposal, 'id'> = {
          proposerId: user.uid,
          question: formData.question,
          description: formData.description,
          suggestedResolutionDate: resolutionTimestamp,
          groupId: null,
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
          marketId: null,
          createdAt: Date.now(),
        };

        await addDoc(collection(db, 'proposals'), proposal);
      }

      setSuccess(true);
      setFormData({
        question: '',
        description: '',
        resolutionDate: '',
        groupId: '',
        initialYesPrice: '0.50',
      });

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error submitting:', err);
      setError(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const isGroupMarket = formData.groupId !== '';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isGroupMarket ? 'Opprett en bet' : 'Foreslå en bet'}
        </h1>
        <p className="text-gray-600">
          {isGroupMarket
            ? 'Opprett en ny bet i gruppen din. Den blir aktiv med en gang.'
            : 'Foreslå en ny offentlig bet. En admin vil se på forslaget ditt.'}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
              Spørsmål
            </label>
            <input
              type="text"
              id="question"
              name="question"
              required
              value={formData.question}
              onChange={handleChange}
              placeholder="Vil Linn Emilie bli forlovet innen 2026?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Gjør det klart, spesifikt, og mulig å svare med JA eller NEI.
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Beskrivelse
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Forklar konteksten og hvordan beten skal avgjøres..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Inkluder kontekst og klare avgjørelseskriterier.
            </p>
          </div>

          {/* Resolution Date */}
          <div>
            <label htmlFor="resolutionDate" className="block text-sm font-medium text-gray-700 mb-2">
              Foreslått avgjørelsesdato
            </label>
            <input
              type="datetime-local"
              id="resolutionDate"
              name="resolutionDate"
              required
              value={formData.resolutionDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Når skal denne beten avgjøres?
            </p>
          </div>

          {/* Group Selection */}
          <div>
            <label htmlFor="groupId" className="block text-sm font-medium text-gray-700 mb-2">
              Gruppe
            </label>
            <select
              id="groupId"
              name="groupId"
              value={formData.groupId}
              onChange={handleChange}
              disabled={loadingGroups}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Offentlig (krever godkjenning)</option>
              {userGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {isGroupMarket
                ? 'Beten blir synlig kun for gruppemedlemmer.'
                : 'Offentlige bets må godkjennes av en admin først.'}
            </p>
          </div>

          {/* Initial Yes Price (only for group markets) */}
          {isGroupMarket && (
            <div>
              <label htmlFor="initialYesPrice" className="block text-sm font-medium text-gray-700 mb-2">
                Startpris JA
              </label>
              <input
                type="number"
                id="initialYesPrice"
                name="initialYesPrice"
                min="0.01"
                max="0.99"
                step="0.01"
                value={formData.initialYesPrice}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Hva tror du sannsynligheten for JA er? (0.01 - 0.99)
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                {isGroupMarket
                  ? 'Beten er opprettet! Du kan nå begynne å handle.'
                  : 'Forslaget er sendt! En admin vil se på det snart.'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || loadingGroups}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? (isGroupMarket ? 'Oppretter...' : 'Sender...')
              : (isGroupMarket ? 'Opprett bet' : 'Send forslag')}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Gode forslag er:</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Klare og entydige (kan besvares med JA eller NEI)</li>
            <li>Har verifiserbare avgjørelseskriterier</li>
            <li>Morsomt for gjengen</li>
            <li>Kan avgjøres på et bestemt tidspunkt eller hendelse</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
