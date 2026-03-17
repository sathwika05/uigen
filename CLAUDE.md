# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

Use comments sparingly. Only comment complex or non-obvious logic.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (uses Turbopack)
npm run dev

# Production build
npm run build

# Run all tests
npm run test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Lint
npm run lint

# Reset database
npm run db:reset
```

## Environment

The app runs without an `ANTHROPIC_API_KEY` — it falls back to a `MockLanguageModel` that returns static code. Set the key in `.env` to enable real Claude generation.

Required env vars:
- `ANTHROPIC_API_KEY` — optional; enables Claude Haiku 4.5 generation
- `JWT_SECRET` — defaults to `"development-secret-key"` in development

## Architecture

UIGen is a Next.js 15 App Router app. Users describe React components in a chat; Claude generates them via tool calls into a **virtual file system** (in-memory, no disk writes), and the result renders in a live iframe preview.

### Three-panel layout (`src/app/main-content.tsx`)

| Panel | Content |
|---|---|
| Left (35%) | Chat interface |
| Right (65%) | Toggle: live preview iframe **or** file tree + Monaco editor |

### Data flow

```
User message → ChatInterface
    → useChat (Vercel AI SDK) → POST /api/chat/route.ts
    → Claude Haiku 4.5 (or MockLanguageModel)
    → tool calls: str_replace_editor / file_manager
    → FileSystemContext updates VirtualFileSystem
    → refresh trigger → PreviewFrame re-renders via jsx-transformer
```

### Key modules

- **`src/lib/file-system.ts`** — `VirtualFileSystem` class: in-memory tree of `FileNode`s. Core API: `createFile`, `updateFile`, `deleteFile`, `rename`, `serialize`/`deserialize`. Supports `@/` import alias.

- **`src/lib/contexts/file-system-context.tsx`** — Provides the `VirtualFileSystem` instance app-wide. Handles `handleToolCall` dispatch for AI tool results (`str_replace_editor`, `file_manager`). Contains a `refreshTrigger` counter that tells `PreviewFrame` when to re-render.

- **`src/lib/contexts/chat-context.tsx`** — Wraps Vercel AI SDK's `useChat`. Routes tool call results to `FileSystemContext`. Tracks anonymous user work in localStorage via `anon-work-tracker`.

- **`src/lib/transform/jsx-transformer.ts`** — Converts the virtual FS to a runnable browser preview. Generates an import map, injects Babel standalone, and produces full HTML for the iframe sandbox.

- **`src/lib/provider.ts`** — Abstracts the language model. Returns `claude-haiku-4-5` when `ANTHROPIC_API_KEY` is set, otherwise returns `MockLanguageModel`.

- **`src/lib/tools/str-replace.ts`** — Implements the `str_replace_editor` tool (view/create/str_replace/insert operations on virtual files).

- **`src/lib/tools/file-manager.ts`** — Implements the `file_manager` tool (rename/delete files and directories).

- **`src/lib/prompts/generation.tsx`** — System prompt given to Claude; defines how it should use the tools to generate and edit React components.

- **`src/lib/auth.ts`** — JWT sessions via `jose`. 7-day expiry, HTTP-only cookies.

### Persistence

- **Authenticated users:** Messages and serialized file data stored in SQLite via Prisma. The database schema is defined in `src/generated/prisma/schema.prisma` — reference it anytime you need to understand the database structure. Models: `User`, `Project`.
- **Anonymous users:** Work tracked in `localStorage` via `src/lib/anon-work-tracker.ts`.
- **Virtual FS:** Never written to disk; serialized to JSON for DB/localStorage storage.

### Tech stack

- Next.js 15 (App Router), React 19, TypeScript 5
- Tailwind CSS v4, Radix UI, Monaco Editor
- Vercel AI SDK v4, `@ai-sdk/anthropic`
- Prisma + SQLite
- Vitest + React Testing Library
