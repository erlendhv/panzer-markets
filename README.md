# Panzer Markets

A friends-only prediction market application using virtual currency. Built with React, TypeScript, Firebase, and Vercel.

## Core Concept: Binary Order Book

Unlike traditional sportsbooks, Panzer Markets functions like Polymarket with a binary order book system:

### The Asset
Every event outcome creates two assets: `YES_SHARE` and `NO_SHARE`.

### The Peg
**1 YES Share + 1 NO Share = $1.00** (always)

### The Matching
Users place **limit orders** (e.g., "Buy YES at $0.60"). The backend matching engine checks for opposite orders that satisfy the $1.00 peg:
- If buying YES at $0.60, system looks for NO orders at $0.40 or less
- When `Bid_YES + Bid_NO >= $1.00`, the trade executes
- System takes $1.00, holds in escrow, mints 1 YES share and 1 NO share to respective users

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI Framework:** Tailwind CSS (Mobile-first)
- **Database:** Firebase Firestore
- **Auth:** Firebase Auth (Google Sign-In)
- **Backend:** Vercel Serverless Functions (Node.js)

## Project Structure

```
panzer-markets/
├── src/
│   ├── types/
│   │   └── firestore.ts          # TypeScript interfaces for all data models
│   ├── lib/
│   │   └── firebase.ts            # Firebase client initialization
│   ├── services/
│   │   └── api.ts                 # API service layer
│   ├── hooks/
│   │   ├── useAuth.ts             # Authentication hook
│   │   ├── useMarkets.ts          # Markets data hook
│   │   └── useOrderBook.ts        # Order book hook
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── api/
│   ├── trade.ts                   # Order matching engine (CORE)
│   ├── cancelOrder.ts             # Cancel order API
│   ├── resolveMarket.ts           # Market resolution API (Admin)
│   └── package.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── vercel.json                    # Vercel deployment config
└── .env.example                   # Environment variables template
```

## Key Features

### 1. Market Proposal & Admin Approval
- **User Action:** Users suggest events (Title, Description, Resolution Date)
- **Status:** Created as `status: 'proposed'`
- **Admin Action:** Admin reviews proposals
  - **Reject:** Marks as rejected with reason
  - **Accept:** Creates market with optional seed orders to set initial odds
  - **Status:** Updates to `status: 'open'`

### 2. Trading (The Matching Engine)
The matching engine (`api/trade.ts`) is the most complex part. See detailed implementation at `api/trade.ts:1`

### 3. Wallet & Settlement
- **Sign Up:** New users receive $1,000 virtual currency
- **Top Up:** Admin can inject funds into user balances
- **Resolution:** Admin resolves markets with YES/NO/INVALID outcomes

## Data Model

See comprehensive TypeScript interfaces in `src/types/firestore.ts:1`

## Setup Instructions

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..
```

### 2. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Google Authentication
3. Create a Firestore database
4. Generate a service account key for Firebase Admin
5. Copy `.env.example` to `.env` and fill in your Firebase credentials

### 3. Run Locally

```bash
# Start development server
npm run dev

# In another terminal, run Vercel dev for API functions
vercel dev
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## API Endpoints

- `POST /api/trade` - Place order (matching engine)
- `POST /api/cancelOrder` - Cancel order
- `POST /api/resolveMarket` - Resolve market (Admin only)

## License

Private - Friends Only