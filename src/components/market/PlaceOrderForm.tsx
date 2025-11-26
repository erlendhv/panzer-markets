import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { placeOrder } from '../../services/api';
import type { Market, OrderSide } from '../../types/firestore';

interface PlaceOrderFormProps {
  market: Market;
}

export function PlaceOrderForm({ market }: PlaceOrderFormProps) {
  const { user } = useAuth();
  const [side, setSide] = useState<OrderSide>('YES');
  const [priceLimit, setPriceLimit] = useState(
    () => market.lastTradedPrice.yes.toFixed(2)
  );
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSideChange = (newSide: OrderSide) => {
    setSide(newSide);
    // Set price to the last traded price for this side
    const price = newSide === 'YES'
      ? market.lastTradedPrice.yes
      : market.lastTradedPrice.no;
    setPriceLimit(price.toFixed(2));
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600 text-center">Logg inn for å legge inn ordre</p>
      </div>
    );
  }

  if (market.status !== 'open') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600 text-center">Denne beten er {market.status === 'closed' ? 'lukket' : market.status === 'resolved' ? 'avgjort' : market.status}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const price = parseFloat(priceLimit);
      const amountNum = parseFloat(amount);

      if (price <= 0 || price >= 1) {
        throw new Error('Pris må være mellom 0 og 1');
      }

      if (amountNum < 1) {
        throw new Error('Minimumsbeløp er $1');
      }

      if (amountNum > user.balance) {
        throw new Error('Utilstrekkelig saldo');
      }

      const result = await placeOrder({
        marketId: market.id,
        side,
        priceLimit: price,
        amount: amountNum,
      });

      if (result.success) {
        const tradesExecuted = result.trades?.length || 0;
        setSuccess(
          tradesExecuted > 0
            ? `Ordre lagt inn! ${tradesExecuted} handel(er) utført.`
            : 'Ordre lagt inn og lagt til i ordreboken!'
        );
        setAmount('10');
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const estimatedShares = parseFloat(amount) / parseFloat(priceLimit || '1');
  const oppositePrice = (1 - parseFloat(priceLimit || '0')).toFixed(2);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Legg inn ordre</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hvilket utfall tror du på?
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSideChange('YES')}
              className={`p-4 rounded-lg border-2 font-medium transition-all ${
                side === 'YES'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">✓</div>
              <div>JA</div>
            </button>
            <button
              type="button"
              onClick={() => handleSideChange('NO')}
              className={`p-4 rounded-lg border-2 font-medium transition-all ${
                side === 'NO'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">✗</div>
              <div>NEI</div>
            </button>
          </div>
        </div>

        {/* Price Limit */}
        <div>
          <label htmlFor="priceLimit" className="block text-sm font-medium text-gray-700 mb-2">
            Makspris per andel (0-1)
          </label>
          <input
            type="number"
            id="priceLimit"
            min="0.01"
            max="0.99"
            step="0.01"
            value={priceLimit}
            onChange={(e) => setPriceLimit(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Du er villig til å betale opptil ${priceLimit} per {side === 'YES' ? 'JA' : 'NEI'}-andel.
            Dette betyr at du trenger en {side === 'YES' ? 'NEI' : 'JA'}-kjøper til ${oppositePrice} eller mer for å matche.
          </p>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            Beløp (USD)
          </label>
          <input
            type="number"
            id="amount"
            min="1"
            max={user.balance}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Tilgjengelig saldo: ${user.balance.toFixed(2)}
          </p>
        </div>

        {/* Estimated Shares */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-900 mb-1">Estimerte andeler hvis fylt:</div>
          <div className="text-2xl font-bold text-blue-900">
            {estimatedShares.toFixed(2)} {side === 'YES' ? 'JA' : 'NEI'}-andeler
          </div>
          <div className="text-sm text-blue-700 mt-2">
            Potensiell gevinst hvis {side === 'YES' ? 'JA' : 'NEI'} vinner: ${(estimatedShares - parseFloat(amount)).toFixed(2)}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full px-6 py-3 font-medium rounded-lg transition-colors ${
            side === 'YES'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:bg-gray-400 disabled:cursor-not-allowed`}
        >
          {loading ? 'Legger inn ordre...' : `Kjøp ${side === 'YES' ? 'JA' : 'NEI'}-andeler`}
        </button>
      </form>
    </div>
  );
}
