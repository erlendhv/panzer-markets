/**
 * API Service Layer
 * Handles all communication with Vercel serverless functions
 */

import { auth } from '../lib/firebase';
import type {
  PlaceOrderRequest,
  PlaceOrderResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  ResolveMarketRequest,
  ResolveMarketResponse,
  MarketBanRequest,
  MarketBanResponse,
} from '../types/firestore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Helper to get the current user's ID token for authentication
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-user-id': user.uid,
  };
}

/**
 * Place a new order (market or limit)
 */
export async function placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/trade`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to place order');
  }

  return response.json();
}

/**
 * Cancel an existing order
 */
export async function cancelOrder(orderId: string): Promise<CancelOrderResponse> {
  const headers = await getAuthHeaders();

  const request: CancelOrderRequest = { orderId };

  const response = await fetch(`${API_BASE_URL}/cancelOrder`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel order');
  }

  return response.json();
}

/**
 * Resolve a market (Admin only)
 */
export async function resolveMarket(request: ResolveMarketRequest): Promise<ResolveMarketResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/resolveMarket`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to resolve market');
  }

  return response.json();
}

/**
 * Ban a user from a market (Admin only)
 */
export async function banUserFromMarket(marketId: string, userId: string, reason: string): Promise<MarketBanResponse> {
  const headers = await getAuthHeaders();

  const request: MarketBanRequest = {
    action: 'ban',
    marketId,
    userId,
    reason,
  };

  const response = await fetch(`${API_BASE_URL}/marketBan`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to ban user from market');
  }

  return response.json();
}

/**
 * Unban a user from a market (Admin only)
 */
export async function unbanUserFromMarket(marketId: string, userId: string): Promise<MarketBanResponse> {
  const headers = await getAuthHeaders();

  const request: MarketBanRequest = {
    action: 'unban',
    marketId,
    userId,
  };

  const response = await fetch(`${API_BASE_URL}/marketBan`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unban user from market');
  }

  return response.json();
}
