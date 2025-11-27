/**
 * Firestore Data Model Interfaces for Panzer Markets
 * Binary Order Book Prediction Market System
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  balance: number; // Virtual currency balance in USD
  portfolioValue: number; // Calculated value of all positions
  createdAt: number; // Unix timestamp
  isAdmin: boolean;
}

// ============================================================================
// GROUP TYPES
// ============================================================================

export interface Group {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  createdBy: string;
  memberCount: number;
  isOpen: boolean; // If true, anyone can join without approval
}

export type GroupRole = 'admin' | 'member';

export interface GroupMember {
  id: string; // Format: `${groupId}_${userId}`
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: number;
  invitedBy: string;
}

export interface GroupJoinRequest {
  id: string; // Format: `${groupId}_${userId}`
  groupId: string;
  userId: string;
  message: string; // Message from user explaining why they want to join
  status: 'pending' | 'approved' | 'denied';
  requestedAt: number;
  reviewedBy: string | null;
  reviewedAt: number | null;
}

// ============================================================================
// MARKET TYPES
// ============================================================================

export type MarketStatus = 'proposed' | 'open' | 'closed' | 'resolved' | 'rejected';

export type ResolutionOutcome = 'YES' | 'NO' | 'INVALID' | null;

export interface Market {
  id: string;
  question: string; // e.g., "Will BTC hit $100k by EOY?"
  description: string;
  creatorId: string;
  status: MarketStatus;
  groupId: string | null; // null = public market

  // Timestamps
  createdAt: number; // Unix timestamp
  resolutionDate: number; // When the market should resolve
  resolvedAt: number | null; // When it was actually resolved

  // Trading info
  lastTradedPrice: {
    yes: number; // Last traded price for YES shares (0-1)
    no: number; // Last traded price for NO shares (0-1)
  };
  history: { datetime: Date; yesChance: number }[];

  // Resolution
  resolutionOutcome: ResolutionOutcome;
  resolutionNote: string | null;

  // Volume tracking
  totalVolume: number; // Total USD traded
  totalYesShares: number; // Total YES shares minted
  totalNoShares: number; // Total NO shares minted
}

// ============================================================================
// ORDER BOOK TYPES
// ============================================================================

export type OrderSide = 'YES' | 'NO';

export type OrderStatus = 'open' | 'filled' | 'partially_filled' | 'cancelled';

export interface Order {
  id: string;
  marketId: string;
  userId: string;

  side: OrderSide; // Buying YES or NO shares
  priceLimit: number; // Max price willing to pay per share (0-1)

  // Quantities in USD
  originalAmount: number; // Original USD amount
  remainingAmount: number; // USD still available to fill
  filledAmount: number; // USD already matched and filled

  status: OrderStatus;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  filledAt: number | null;
}

// ============================================================================
// POSITION TYPES
// ============================================================================

export interface Position {
  id: string;
  userId: string;
  marketId: string;

  // Share holdings
  yesShares: number; // Number of YES shares owned
  noShares: number; // Number of NO shares owned

  // Cost basis tracking (for P&L calculation)
  yesCostBasis: number; // Total USD spent on YES shares
  noCostBasis: number; // Total USD spent on NO shares

  // Current values (calculated)
  currentValue: number; // Current market value of position
  unrealizedPnL: number; // Unrealized profit/loss

  updatedAt: number;
}

// ============================================================================
// TRADE (EXECUTION HISTORY) TYPES
// ============================================================================

export interface Trade {
  id: string;
  marketId: string;

  // The two orders that matched
  buyerOrderId: string;
  sellerOrderId: string;

  // The users involved
  yesUserId: string; // User who got YES shares
  noUserId: string; // User who got NO shares

  // Trade details
  side: OrderSide; // Which side was the taker (initiated trade)
  yesPrice: number; // Price YES user paid
  noPrice: number; // Price NO user paid (should equal 1 - yesPrice)
  sharesTraded: number; // Number of shares created

  // Total amounts
  totalAmount: number; // Should equal sharesTraded * 1.00

  executedAt: number;
}

// ============================================================================
// TRANSACTION TYPES (for wallet history)
// ============================================================================

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'trade_buy'
  | 'trade_sell'
  | 'market_resolution'
  | 'admin_adjustment';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // Positive for credits, negative for debits
  balanceAfter: number;

  // Related entities
  marketId: string | null;
  orderId: string | null;
  tradeId: string | null;

  description: string;
  createdAt: number;
}

// ============================================================================
// PROPOSAL TYPES
// ============================================================================

export interface MarketProposal {
  id: string;
  proposerId: string;

  // Proposal details
  question: string;
  description: string;
  suggestedResolutionDate: number;
  groupId: string | null; // null = public market proposal (requires site admin approval)

  // Status
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null; // Admin UID
  reviewedAt: number | null;
  rejectionReason: string | null;

  // If approved, the created market ID
  marketId: string | null;

  createdAt: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface PlaceOrderRequest {
  marketId: string;
  side: OrderSide;
  priceLimit: number; // 0-1 range
  amount: number; // USD amount
}

export interface PlaceOrderResponse {
  success: boolean;
  error?: string;
  order?: Order;
  trades?: Trade[]; // Any trades that were executed immediately
  remainingOrder?: Order | null; // If order was partially filled
}

export interface CancelOrderRequest {
  orderId: string;
}

export interface CancelOrderResponse {
  success: boolean;
  error?: string;
  refundedAmount?: number;
}

export interface ResolveMarketRequest {
  marketId: string;
  outcome: 'YES' | 'NO' | 'INVALID';
  note?: string;
}

export interface ResolveMarketResponse {
  success: boolean;
  error?: string;
  payouts?: {
    userId: string;
    amount: number;
  }[];
}

// ============================================================================
// BAN USER FROM MARKET TYPES
// ============================================================================

export interface MarketBanRequest {
  action: 'ban' | 'unban';
  marketId: string;
  userId: string;
  reason?: string; // Required for ban, optional for unban
}

export interface MarketBanResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  userDisplayName: string | null;
  userPhotoURL: string | null;
  content: string;
  createdAt: number;
  updatedAt: number | null;
  referencedTimestamp?: number | null;
}

// ============================================================================
// MARKET BANNED USER TYPES
// ============================================================================

export interface MarketBannedUser {
  id: string; // Format: `${marketId}_${userId}`
  marketId: string;
  userId: string;
  bannedBy: string; // Admin who banned the user
  reason: string;
  bannedAt: number;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface OrderBookEntry {
  price: number;
  totalAmount: number;
  orders: Order[];
}

export interface OrderBook {
  yes: OrderBookEntry[];
  no: OrderBookEntry[];
}

export interface MarketStats {
  marketId: string;
  yesPrice: number; // Current implied probability
  noPrice: number;
  volume24h: number;
  totalVolume: number;
  openInterest: number; // Total shares outstanding
}
