# AI Accounting Platform

## Project
AI-first accounting platform for the Georgian market. The AI agent acts as
a "junior accountant" — it processes documents, posts journal entries, answers
client questions in Georgian, and escalates uncertain items to a human operator.

## Tech Stack
- Runtime: Node.js 22+ / TypeScript (strict)
- Backend: Hono on Node.js (not Cloudflare Workers)
- Database: PostgreSQL via Neon (Serverless), Drizzle ORM
- File Storage: Cloudflare R2 (receipts, invoices, statements)
- AI: Claude API (primary), Gemini API (secondary) — model-agnostic layer
- Queue: BullMQ + Redis (async document processing)
- Auth: Better Auth (JWT + roles: admin / operator / client)

## Structure
Monorepo:
  apps/api/        — Hono backend
  apps/web/        — React + Vite + Tailwind frontend
  packages/shared/ — shared types, constants, schemas
  packages/ai/     — AI service layer (THIS IS THE CURRENT TASK)

## Code Style
- ESM imports, no default exports except React components
- Zod for all runtime validation
- Named exports only
- Prefer `const` + arrow functions
- All AI tool definitions must be model-agnostic (no provider-specific types in the tool definition)
- Georgian comments only where business logic requires cultural context; English otherwise
- Error messages user-facing in Georgian, internal logs in English

## Commands
- Build: `pnpm build`
- Test: `pnpm test` (vitest)
- Type check: `pnpm typecheck`
- Lint: `pnpm lint`

## Verification
After writing code, always run: pnpm typecheck && pnpm test