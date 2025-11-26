import { useOrderBook } from '../../hooks/useOrderBook';

interface OrderBookDisplayProps {
  marketId: string;
}

export function OrderBookDisplay({ marketId }: OrderBookDisplayProps) {
  const { orderBook, loading } = useOrderBook(marketId);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Ordrebok</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasOrders = orderBook.yes.length > 0 || orderBook.no.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Ordrebok</h3>

      {!hasOrders ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">Ingen åpne ordre</p>
          <p className="text-xs text-gray-400 mt-1">Vær den første til å legge inn en ordre!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* YES Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700">JA-ordre</span>
              <span className="text-xs text-gray-500">{orderBook.yes.length} nivåer</span>
            </div>
            {orderBook.yes.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Ingen JA-ordre</div>
            ) : (
              <div className="space-y-1">
                {orderBook.yes.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm p-2 bg-green-50 rounded"
                  >
                    <span className="font-medium text-green-700">
                      ${entry.price.toFixed(2)}
                    </span>
                    <span className="text-gray-600">
                      ${entry.totalAmount.toFixed(0)}
                    </span>
                  </div>
                ))}
                {orderBook.yes.length > 5 && (
                  <div className="text-xs text-gray-400 text-center pt-1">
                    +{orderBook.yes.length - 5} flere nivåer
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NO Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-700">NEI-ordre</span>
              <span className="text-xs text-gray-500">{orderBook.no.length} nivåer</span>
            </div>
            {orderBook.no.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Ingen NEI-ordre</div>
            ) : (
              <div className="space-y-1">
                {orderBook.no.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm p-2 bg-red-50 rounded"
                  >
                    <span className="font-medium text-red-700">
                      ${entry.price.toFixed(2)}
                    </span>
                    <span className="text-gray-600">
                      ${entry.totalAmount.toFixed(0)}
                    </span>
                  </div>
                ))}
                {orderBook.no.length > 5 && (
                  <div className="text-xs text-gray-400 text-center pt-1">
                    +{orderBook.no.length - 5} flere nivåer
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Pris</span>
          <span>Beløp</span>
        </div>
      </div>
    </div>
  );
}
