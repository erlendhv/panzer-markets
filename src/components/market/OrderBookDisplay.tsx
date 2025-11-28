import { useOrderBook } from "../../hooks/useOrderBook";

interface OrderBookDisplayProps {
  marketId: string;
}

/**
 * Calculate how much the opposite side would need to spend to fully match an order.
 * For a YES order at price P with amount A:
 *   - Shares available = A / P
 *   - Cost for NO buyer = Shares × (1 - P) = A × (1 - P) / P
 */
function calculateCostToMatch(amount: number, price: number): number {
  return (amount * (1 - price)) / price;
}

export function OrderBookDisplay({ marketId }: OrderBookDisplayProps) {
  const { orderBook, loading } = useOrderBook(marketId);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Åpne ordre</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Ordre som venter på å bli matchet med en motpart</p>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasOrders = orderBook.yes.length > 0 || orderBook.no.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Åpne ordre</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Ordre som venter på å bli matchet med en motpart</p>

      {!hasOrders ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">Ingen åpne ordre</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Vær den første til å legge inn en ordre!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* YES Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                JA-ordre
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {orderBook.yes.length} nivåer
              </span>
            </div>
            {orderBook.yes.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 italic">Ingen JA-ordre</div>
            ) : (
              <div className="space-y-1">
                {orderBook.yes.slice(0, 5).map((entry, idx) => {
                  const costToMatch = calculateCostToMatch(
                    entry.totalAmount,
                    entry.price,
                  );
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 bg-green-50 dark:bg-green-900/30 rounded"
                    >
                      <span className="font-medium text-green-700 dark:text-green-400">
                        ${entry.price.toFixed(2)}
                      </span>
                      <div className="text-right">
                        <span className="text-gray-600 dark:text-gray-300">
                          ${entry.totalAmount.toFixed(0)}
                        </span>
                        <span
                          className="text-xs text-gray-400 dark:text-gray-500 ml-2"
                          title="Beløp NEI-kjøper må betale for å matche"
                        >
                          (NEI: ${costToMatch.toFixed(0)})
                        </span>
                      </div>
                    </div>
                  );
                })}
                {orderBook.yes.length > 5 && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                    +{orderBook.yes.length - 5} flere nivåer
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NO Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                NEI-ordre
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {orderBook.no.length} nivåer
              </span>
            </div>
            {orderBook.no.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                Ingen NEI-ordre
              </div>
            ) : (
              <div className="space-y-1">
                {orderBook.no.slice(0, 5).map((entry, idx) => {
                  const costToMatch = calculateCostToMatch(
                    entry.totalAmount,
                    entry.price,
                  );
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 bg-red-50 dark:bg-red-900/30 rounded"
                    >
                      <span className="font-medium text-red-700 dark:text-red-400">
                        ${entry.price.toFixed(2)}
                      </span>
                      <div className="text-right">
                        <span className="text-gray-600 dark:text-gray-300">
                          ${entry.totalAmount.toFixed(0)}
                        </span>
                        <span
                          className="text-xs text-gray-400 dark:text-gray-500 ml-2"
                          title="Beløp JA-kjøper må betale for å matche"
                        >
                          (JA: ${costToMatch.toFixed(0)})
                        </span>
                      </div>
                    </div>
                  );
                })}
                {orderBook.no.length > 5 && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                    +{orderBook.no.length - 5} flere nivåer
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Pris</span>
          <span>Beløp betalt (din kostnad for å matche)</span>
        </div>
      </div>
    </div>
  );
}
