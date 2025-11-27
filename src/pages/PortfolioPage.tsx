import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserPositions } from "../hooks/useUserPositions";
import { useUserOrders } from "../hooks/useUserOrders";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cancelOrder } from "../services/api";
import { getAvailableBalance, getLockedInOrders } from "../utils/balance";
import type { Market } from "../types/firestore";
import { Link } from "react-router-dom";

export function PortfolioPage() {
  const { user } = useAuth();
  const { positions, loading: positionsLoading } = useUserPositions(user?.uid);
  const { orders, loading: ordersLoading } = useUserOrders(user?.uid);
  const [markets, setMarkets] = useState<Map<string, Market>>(new Map());
  const [activeTab, setActiveTab] = useState<"positions" | "orders">(
    "positions",
  );
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );
  const [positionFilter, setPositionFilter] = useState<"open" | "resolved">(
    "open",
  );

  useEffect(() => {
    const fetchMarkets = async () => {
      const marketIds = new Set([
        ...positions.map((p) => p.marketId),
        ...orders.map((o) => o.marketId),
      ]);

      const marketData = new Map<string, Market>();
      for (const marketId of marketIds) {
        const marketDoc = await getDoc(doc(db, "markets", marketId));
        if (marketDoc.exists()) {
          marketData.set(marketId, {
            id: marketDoc.id,
            ...marketDoc.data(),
          } as Market);
        }
      }
      setMarkets(marketData);
    };

    if (positions.length > 0 || orders.length > 0) {
      fetchMarkets();
    }
  }, [positions, orders]);

  if (!user) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Innlogging kreves
        </h2>
        <p className="text-gray-600">Logg inn for å se dine bets.</p>
      </div>
    );
  }

  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrderId(orderId);
    try {
      await cancelOrder(orderId);
    } catch (err) {
      console.error("Error cancelling order:", err);
      alert("Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Only include open market positions in total value (resolved positions are already paid out as balance)
  const totalValue = positions.reduce((sum, pos) => {
    const market = markets.get(pos.marketId);
    if (!market || market.status !== "open") return sum;

    const yesValue = pos.yesShares * market.lastTradedPrice.yes;
    const noValue = pos.noShares * market.lastTradedPrice.no;
    return sum + yesValue + noValue;
  }, 0);

  const totalCost = positions
    .filter((pos) => {
      const market = markets.get(pos.marketId);
      return market && market.status === "open";
    })
    .reduce((sum, pos) => sum + pos.yesCostBasis + pos.noCostBasis, 0);
  const unrealizedPnL = totalValue - totalCost;

  // Filter positions based on market status
  const openPositions = positions.filter((pos) => {
    const market = markets.get(pos.marketId);
    return market && market.status === "open";
  });
  const resolvedPositions = positions.filter((pos) => {
    const market = markets.get(pos.marketId);
    return market && market.status === "resolved";
  });

  const openOrders = orders.filter(
    (o) => o.status === "open" || o.status === "partially_filled",
  );
  const closedOrders = orders.filter(
    (o) => o.status === "filled" || o.status === "cancelled",
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Dine bets</h1>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Tilgjengelig saldo</div>
            <div className="text-2xl font-bold text-gray-900">
              ${getAvailableBalance(user.balance, orders).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">I åpne ordre</div>
            <div className="text-2xl font-bold text-gray-900">
              ${getLockedInOrders(orders).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">I åpne trades/bets</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totalValue.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total verdi</div>
            <div className="text-2xl font-bold text-gray-900">
              ${(user.balance + totalValue).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Urealisert gevinst/tap</div>
            <div
              className={`text-2xl font-bold ${unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("positions")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "positions"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Posisjoner ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "orders"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Ordre ({openOrders.length} åpne)
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "positions" && (
        <PositionsView
          openPositions={openPositions}
          resolvedPositions={resolvedPositions}
          markets={markets}
          loading={positionsLoading}
          filter={positionFilter}
          onFilterChange={setPositionFilter}
        />
      )}

      {activeTab === "orders" && (
        <OrdersView
          openOrders={openOrders}
          closedOrders={closedOrders}
          markets={markets}
          loading={ordersLoading}
          onCancelOrder={handleCancelOrder}
          cancellingOrderId={cancellingOrderId}
        />
      )}
    </div>
  );
}

interface PositionsViewProps {
  openPositions: any[];
  resolvedPositions: any[];
  markets: Map<string, Market>;
  loading: boolean;
  filter: "open" | "resolved";
  onFilterChange: (filter: "open" | "resolved") => void;
}

function PositionsView({
  openPositions,
  resolvedPositions,
  markets,
  loading,
  filter,
  onFilterChange,
}: PositionsViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const positionsToShow = filter === "open" ? openPositions : resolvedPositions;

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => onFilterChange("open")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === "open"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Åpne ({openPositions.length})
          </button>
          <button
            onClick={() => onFilterChange("resolved")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === "resolved"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Avgjort ({resolvedPositions.length})
          </button>
        </div>
      </div>

      {positionsToShow.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">
            {filter === "open"
              ? "Ingen åpne posisjoner. Begynn å bette for å bygge opp porteføljen din!"
              : "Ingen avsluttede posisjoner."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {positionsToShow.map((position) => {
            const market = markets.get(position.marketId);
            if (!market) return null;

            const yesValue = position.yesShares * market.lastTradedPrice.yes;
            const noValue = position.noShares * market.lastTradedPrice.no;
            const totalValue = yesValue + noValue;
            const totalCost = position.yesCostBasis + position.noCostBasis;
            const pnl = totalValue - totalCost;

            return (
              <div
                key={position.id}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <Link
                      to={`/market/${position.marketId}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {market.question}
                    </Link>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      market.status === "open"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {market.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">JA-andeler</div>
                    <div className="font-semibold text-green-700">
                      {position.yesShares.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      ${yesValue.toFixed(2)} verdi
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">NEI-andeler</div>
                    <div className="font-semibold text-red-700">
                      {position.noShares.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      ${noValue.toFixed(2)} verdi
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total kostnad</div>
                    <div className="font-semibold text-gray-900">
                      ${totalCost.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Nåværende verdi</div>
                    <div className="font-semibold text-gray-900">
                      ${totalValue.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Gevinst/tap</div>
                    <div
                      className={`font-semibold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface OrdersViewProps {
  openOrders: any[];
  closedOrders: any[];
  markets: Map<string, Market>;
  loading: boolean;
  onCancelOrder: (orderId: string) => void;
  cancellingOrderId: string | null;
}

function OrdersView({
  openOrders,
  closedOrders,
  markets,
  loading,
  onCancelOrder,
  cancellingOrderId,
}: OrdersViewProps) {
  const [showClosed, setShowClosed] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const ordersToShow = showClosed ? closedOrders : openOrders;

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setShowClosed(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              !showClosed
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Åpne ordre ({openOrders.length})
          </button>
          <button
            onClick={() => setShowClosed(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              showClosed
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Historikk ({closedOrders.length})
          </button>
        </div>
      </div>

      {ordersToShow.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">
            Ingen {showClosed ? "lukkede" : "åpne"} ordre
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordersToShow.map((order) => {
            const market = markets.get(order.marketId);
            if (!market) return null;

            return (
              <div
                key={order.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Link
                      to={`/market/${order.marketId}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {market.question}
                    </Link>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span
                        className={`font-medium ${order.side === "YES" ? "text-green-700" : "text-red-700"}`}
                      >
                        {order.side}
                      </span>
                      <span className="text-gray-600">
                        @ ${order.priceLimit.toFixed(2)}
                      </span>
                      <span className="text-gray-600">
                        ${order.remainingAmount.toFixed(2)} / $
                        {order.originalAmount.toFixed(2)}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          order.status === "open"
                            ? "bg-green-100 text-green-800"
                            : order.status === "filled"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "partially_filled"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                  {!showClosed && (
                    <button
                      onClick={() => onCancelOrder(order.id)}
                      disabled={cancellingOrderId === order.id}
                      className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {cancellingOrderId === order.id
                        ? "Kansellerer..."
                        : "Kanseller"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
