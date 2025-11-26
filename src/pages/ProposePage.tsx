import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MarketProposal } from '../types/firestore';

export function ProposePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    question: '',
    description: '',
    resolutionDate: '',
  });

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

      const proposal: Omit<MarketProposal, 'id'> = {
        proposerId: user.uid,
        question: formData.question,
        description: formData.description,
        suggestedResolutionDate: resolutionTimestamp,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        marketId: null,
        createdAt: Date.now(),
      };

      await addDoc(collection(db, 'proposals'), proposal);

      setSuccess(true);
      setFormData({
        question: '',
        description: '',
        resolutionDate: '',
      });

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      setError(err.message || 'Failed to submit proposal');
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Foreslå en bet</h1>
        <p className="text-gray-600">
          Foreslå en ny bet. Plomma eller Sneipen vil se på forslaget ditt.
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
                Forslaget er sendt! Plomma eller Sneipen vil se på det snart.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sender...' : 'Send forslag'}
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
