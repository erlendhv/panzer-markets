import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import type { Market } from '../../types/firestore';

export function CreateMarketForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    question: '',
    description: '',
    resolutionDate: '',
    initialYesPrice: '0.50',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const resolutionTimestamp = new Date(formData.resolutionDate).getTime();
      const yesPrice = parseFloat(formData.initialYesPrice);

      if (yesPrice <= 0 || yesPrice >= 1) {
        throw new Error('Startpris for JA må være mellom 0 og 1');
      }

      const newMarket: Omit<Market, 'id'> = {
        question: formData.question,
        description: formData.description,
        creatorId: user.uid,
        status: 'open',
        groupId: null, // Admin-created markets are public
        createdAt: Date.now(),
        resolutionDate: resolutionTimestamp,
        resolvedAt: null,
        lastTradedPrice: {
          yes: yesPrice,
          no: 1 - yesPrice,
        },
        history: [],
        resolutionOutcome: null,
        resolutionNote: null,
        totalVolume: 0,
        totalYesShares: 0,
        totalNoShares: 0,
        lastTradeAt: null,
      };

      await addDoc(collection(db, 'markets'), newMarket);

      setSuccess(true);
      setFormData({
        question: '',
        description: '',
        resolutionDate: '',
        initialYesPrice: '0.50',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error creating market:', err);
      setError(err.message || 'Failed to create market');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Opprett ny bet</h2>

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
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Beskrivelse
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            placeholder="Flere detaljer om beten og avgjørelseskriterier..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Resolution Date */}
        <div>
          <label htmlFor="resolutionDate" className="block text-sm font-medium text-gray-700 mb-2">
            Avgjørelsesdato
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
        </div>

        {/* Initial Price */}
        <div>
          <label htmlFor="initialYesPrice" className="block text-sm font-medium text-gray-700 mb-2">
            Startpris JA (0-1)
          </label>
          <input
            type="number"
            id="initialYesPrice"
            name="initialYesPrice"
            required
            min="0.01"
            max="0.99"
            step="0.01"
            value={formData.initialYesPrice}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-sm text-gray-500">
            NEI-pris blir {(1 - parseFloat(formData.initialYesPrice || '0.5')).toFixed(2)}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">Bet opprettet!</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Oppretter...' : 'Opprett bet'}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Om startprising</h3>
        <p className="text-sm text-blue-700">
          Startprisen setter startoddsene. For eksempel betyr 0.50 50/50 odds.
          Brukere kan legge inn ordre på hvilken som helst pris, og systemet vil utføre handler
          når JA + NEI priser = $1.00.
        </p>
      </div>
    </div>
  );
}
