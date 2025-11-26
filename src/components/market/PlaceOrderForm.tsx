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
  const [priceLimit, setPriceLimit] = useState('0.50');
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600 text-center">Sign in to place orders</p>
      </div>
    );
  }

  if (market.status !== 'open') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600 text-center">This market is {market.status}</p>
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
        throw new Error('Price must be between 0 and 1');
      }

      if (amountNum < 1) {
        throw new Error('Minimum order amount is $1');
      }

      if (amountNum > user.balance) {
        throw new Error('Insufficient balance');
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
            ? `Order placed! ${tradesExecuted} trade(s) executed.`
            : 'Order placed and added to order book!'
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
      <h2 className="text-xl font-bold text-gray-900 mb-6">Place Order</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Which outcome do you believe?
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSide('YES')}
              className={`p-4 rounded-lg border-2 font-medium transition-all ${
                side === 'YES'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">✓</div>
              <div>YES</div>
            </button>
            <button
              type="button"
              onClick={() => setSide('NO')}
              className={`p-4 rounded-lg border-2 font-medium transition-all ${
                side === 'NO'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">✗</div>
              <div>NO</div>
            </button>
          </div>
        </div>

        {/* Price Limit */}
        <div>
          <label htmlFor="priceLimit" className="block text-sm font-medium text-gray-700 mb-2">
            Max Price per Share (0-1)
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
            You're willing to pay up to ${priceLimit} per {side} share.
            This means you need a {side === 'YES' ? 'NO' : 'YES'} buyer at ${oppositePrice} or more to match.
          </p>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            Amount (USD)
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
            Available balance: ${user.balance.toFixed(2)}
          </p>
        </div>

        {/* Estimated Shares */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-900 mb-1">Estimated shares if filled:</div>
          <div className="text-2xl font-bold text-blue-900">
            {estimatedShares.toFixed(2)} {side} shares
          </div>
          <div className="text-sm text-blue-700 mt-2">
            Potential profit if {side} wins: ${(estimatedShares - parseFloat(amount)).toFixed(2)}
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
          {loading ? 'Placing Order...' : `Buy ${side} Shares`}
        </button>
      </form>
    </div>
  );
}
