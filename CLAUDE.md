# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

Panzer Markets is a friends-only prediction market application using virtual currency. It implements a binary order book system similar to Polymarket where:

- Every market creates two assets: YES_SHARE and NO_SHARE
- Core invariant: 1 YES Share + 1 NO Share = $1.00 (always)
- Users place limit orders; the matching engine executes trades when complementary orders satisfy the $1.00 peg

## Tech Stack

**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
**Backend:** Vercel Serverless Functions (Node.js)
**Database:** Firebase Firestore (real-time NoSQL)
**Auth:** Firebase Auth (Google Sign-In)
**Charts:** Chart.js with react-chartjs-2

## Commands

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Development
npm run dev              # Start Vite dev server (frontend only)
vercel dev              # Run with API functions (requires Vercel CLI)

# Build
npm run build           # Type check + build for production

# Lint
npm run lint            # Run ESLint
```

## Project Structure

```
panzer-markets/
├── api/                      # Vercel serverless functions
│   ├── trade.ts              # ORDER MATCHING ENGINE (core logic)
│   ├── cancelOrder.ts        # Cancel orders
│   ├── resolveMarket.ts      # Market resolution (admin)
│   ├── createGroup.ts        # Group creation
│   ├── groupAdmin.ts         # Group admin operations
│   ├── joinGroup.ts          # Join group
│   ├── leaveGroup.ts         # Leave group
│   ├── inviteToGroup.ts      # Invite users
│   ├── handleJoinRequest.ts  # Approve/deny join requests
│   ├── requestToJoinGroup.ts # Request to join
│   └── marketBan.ts          # Ban users from markets
│
├── src/
│   ├── types/firestore.ts    # TypeScript interfaces (data models)
│   ├── lib/firebase.ts       # Firebase client initialization
│   ├── services/api.ts       # API service layer (HTTP calls)
│   ├── hooks/                # React hooks for data fetching
│   ├── contexts/             # React Context (GroupContext, UserCacheContext)
│   ├── pages/                # Page components
│   ├── components/           # UI components
│   │   ├── market/           # Market-specific components
│   │   └── admin/            # Admin-only components
│   └── utils/                # Utility functions
│
├── vercel.json               # Vercel config (1024MB memory, 60s timeout)
└── .env                      # Environment variables (Firebase credentials)
```

## Architecture Notes

### Order Matching Engine (`api/trade.ts`)

The most complex part of the system. Uses Firestore transactions to prevent race conditions:

- Matches orders when `Bid_YES + Bid_NO >= $1.00`
- Mints YES/NO shares to respective users
- Tracks positions with cost basis for P&L calculation

### State Management

- React Context for shared state (GroupContext, UserCacheContext)
- Custom hooks with Firestore `onSnapshot` for real-time updates
- No external state management library

### API Authentication

- User ID passed via `x-user-id` header
- Firebase Admin SDK validates and processes requests

## Key Files

- `api/trade.ts` - Order matching engine (most complex)
- `src/types/firestore.ts` - All TypeScript interfaces/data models
- `src/hooks/useOrderBook.ts` - Order book aggregation logic
- `src/hooks/useAuth.ts` - Auth state with auto user creation
- `src/services/api.ts` - HTTP service layer

## Database Collections

- `users` - User accounts with balance
- `markets` - Prediction markets
- `orders` - Open limit orders
- `positions` - User holdings (YES/NO shares)
- `trades` - Executed trades
- `transactions` - Balance changes
- `groups` - Betting groups
- `groupMembers` - Group membership (doc ID: `${groupId}_${userId}`)
- `groupJoinRequests` - Pending join requests
- `marketBannedUsers` - Banned users per market

## Coding Conventions

- TypeScript strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- Named exports for components (e.g., `export { MarketsPage }`)
- Tailwind CSS for styling (mobile-first)
- Norwegian language UI strings
- ESLint with TypeScript support

## Dark Mode

All components must support dark mode. Theme state is managed via `ThemeContext` with the `darkMode: 'class'` Tailwind strategy.

**Common patterns:**

```
# Backgrounds
bg-white dark:bg-gray-800

# Borders
border-gray-200 dark:border-gray-700

# Text
text-gray-900 dark:text-white
text-gray-600 dark:text-gray-400
text-gray-500 dark:text-gray-400

# Form inputs
bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600

# Status badges
bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300
bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300
bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300
bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300

# Hover states
hover:bg-gray-100 dark:hover:bg-gray-700
hover:text-gray-900 dark:hover:text-white
```

**When adding UI:**

1. Always include `dark:` variants for backgrounds, borders, and text colors
2. Use `gray-800` for dark mode card/container backgrounds
3. Use `gray-700` for dark mode input backgrounds and secondary elements
4. Use opacity variants (e.g., `dark:bg-green-900/50`) for colored badges

## Responsive Design

All UI must work on both mobile and desktop. Tailwind uses mobile-first breakpoints: base classes apply to all sizes, prefixes (`sm:`, `md:`) add styles for larger screens.

**Breakpoint:** `md:` (768px) is the primary mobile/desktop breakpoint.

**Common patterns:**

```
# Typography - smaller base, larger on desktop
text-xl sm:text-2xl
text-xs sm:text-sm

# Spacing - tighter base, more room on desktop
p-4 sm:p-6
gap-3 sm:gap-4

# Visibility
hidden md:block    # Desktop only
md:hidden          # Mobile only
```

**Layout components:**

- `Sidebar.tsx` - Has `mobile` prop for drawer variant with larger touch targets
- `Layout.tsx` - Hamburger menu + slide-out drawer on mobile, fixed sidebar on desktop

**When adding UI:**

1. Write base styles that work on mobile
2. Add `sm:` or `md:` prefixes to enhance for desktop
3. Ensure touch targets are large enough on mobile (min ~44px)
4. Test on both narrow and wide viewports

## Environment Variables

Frontend (prefixed with `VITE_`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Backend (Firebase Admin):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

