import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, increment, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { User, Order, Position, Market } from '../../types/firestore';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<Map<string, Market>>(new Map());
  const [loading, setLoading] = useState(true);
  const [adjustingBalance, setAdjustingBalance] = useState<string | null>(null);

  // Fetch users
  useEffect(() => {
    const q = query(collection(db, 'users'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map((doc) => doc.data() as User);
      setUsers(userData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Fetch open orders (single query for all users - most efficient)
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['open', 'partially_filled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(orderData);
    });

    return unsubscribe;
  }, []);

  // Fetch all positions
  useEffect(() => {
    const q = query(collection(db, 'positions'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const positionData = snapshot.docs.map((doc) => doc.data() as Position);
      setPositions(positionData);
    });

    return unsubscribe;
  }, []);

  // Fetch open markets (for calculating position values)
  useEffect(() => {
    const q = query(
      collection(db, 'markets'),
      where('status', '==', 'open')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const marketData = new Map<string, Market>();
      snapshot.docs.forEach((doc) => {
        marketData.set(doc.id, { id: doc.id, ...doc.data() } as Market);
      });
      setMarkets(marketData);
    });

    return unsubscribe;
  }, []);

  // Helper to calculate user's locked amount in open orders
  const getUserLockedInOrders = (userId: string) => {
    return orders
      .filter(o => o.userId === userId)
      .reduce((sum, o) => sum + o.remainingAmount, 0);
  };

  // Helper to calculate user's position value in open markets
  const getUserPositionValue = (userId: string) => {
    return positions
      .filter(p => p.userId === userId)
      .reduce((sum, pos) => {
        const market = markets.get(pos.marketId);
        if (!market) return sum; // Skip if market not open
        const yesValue = pos.yesShares * market.lastTradedPrice.yes;
        const noValue = pos.noShares * market.lastTradedPrice.no;
        return sum + yesValue + noValue;
      }, 0);
  };

  // Helper to calculate total value (balance + locked in orders + position value)
  const getUserTotalValue = (user: User) => {
    return user.balance + getUserLockedInOrders(user.uid) + getUserPositionValue(user.uid);
  };

  const adjustBalance = async (userId: string, amount: number) => {
    setAdjustingBalance(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        balance: increment(amount),
      });
    } catch (err) {
      console.error('Error adjusting balance:', err);
      alert('Failed to adjust balance');
    } finally {
      setAdjustingBalance(null);
    }
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: !currentStatus,
      });
    } catch (err) {
      console.error('Error toggling admin status:', err);
      alert('Failed to update admin status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Brukeradministrasjon</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Administrer brukersaldo og tillatelser</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bruker
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Saldo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Portefølje
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Handlinger
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Bruker'}
                        className="h-10 w-10 rounded-full mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.displayName || 'Ukjent'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    ${user.balance.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">${getUserTotalValue(user).toFixed(2)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isAdmin ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      Bruker
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => adjustBalance(user.uid, 100)}
                      disabled={adjustingBalance === user.uid}
                      className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 disabled:opacity-50"
                      title="Legg til $100"
                    >
                      +$100
                    </button>
                    <button
                      onClick={() => adjustBalance(user.uid, -100)}
                      disabled={adjustingBalance === user.uid}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                      title="Trekk fra $100"
                    >
                      -$100
                    </button>
                    <button
                      onClick={() => toggleAdmin(user.uid, user.isAdmin)}
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      title={user.isAdmin ? 'Fjern admin' : 'Gjør til admin'}
                    >
                      {user.isAdmin ? '👤' : '👑'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">Ingen brukere funnet</p>
        </div>
      )}
    </div>
  );
}
