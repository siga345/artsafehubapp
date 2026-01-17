# ART SAFE HUB

Web-first MVP workspace for beginner artists in CIS. This project focuses on structured song progress and PATH growth (not a social feed or DAW).

## Tech Stack
- Next.js (App Router) + TypeScript
- TailwindCSS + shadcn/ui styling conventions
- Prisma ORM + PostgreSQL
- NextAuth (Credentials)
- TanStack Query

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
```bash
cp .env.example .env
```

### 3) Run database
```bash
docker-compose up -d db
```

### 4) Run migrations & seed
```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5) Start dev server
```bash
npm run dev
```

Demo credentials:
- **Email:** demo@artsafehub.app
- **Password:** demo1234

## Prisma & Migrations
- Schema: `prisma/schema.prisma`
- Initial migration: `prisma/migrations/0001_init`

## Local File Uploads
Audio clips store files in `./uploads`. The storage layer lives in `src/lib/storage.ts` and can be swapped for S3 later.

## AI Integration (Placeholder)
The AI interface is intentionally mocked.
- `AIProvider` interface: `src/lib/ai.ts`
- Mock implementation: `MockAIProvider`
- API endpoints:
  - `POST /api/assistant/message`
  - `POST /api/assistant/next-step`

Replace `MockAIProvider` with a real implementation in a separate AI project without changing the UI/API contracts.

## Docker
Start everything:
```bash
docker-compose up --build
```

## Notes
- Feedback + discussions happen in Telegram (outside the app).
- This MVP is web-first; mobile is a future companion.
