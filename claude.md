# HeySheets MVP - AI Chat for Google Sheets

React + TypeScript + Vite + Supabase Edge Functions application with AI-powered chat interface.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **State Management**: TanStack Query for server state, Zustand for debug store
- **Backend**: Supabase Edge Functions (Deno runtime)
- **AI Provider**: Claude 3.5 Sonnet via OpenRouter API
- **Deployment**: Vercel (frontend) + Supabase (backend functions)

## Tech Stack

- React Router for navigation
- shadcn/ui components (Sheet, Button, etc.)
- Lucide React for icons
- pnpm for package management
- Supabase for auth, database, and edge functions

## Key Files

- `src/pages/StorePage.tsx` - Main chat interface with correlation ID tracking
- `src/App.tsx` - Root component with debug panel integration
- `supabase/functions/chat-completion/index.ts` - Main AI orchestration endpoint
- `src/stores/useDebugStore.ts` - Zustand store for debug panel state
- `src/components/debug/DebugPanel.tsx` - Production debug monitoring UI

## Important Conventions

### Package Management
- **ALWAYS use pnpm** (NOT npm or yarn)
- Project uses pnpm-lock.yaml - never mix package managers
- Run `pnpm install` for dependencies

### Dark Mode First
- Default theme: gray-950/900 backgrounds, gray-100 text, gray-800 borders
- All new components should follow dark mode styling
- Scrollbars: `scrollbarColor: '#374151 #111827', scrollbarWidth: 'thin'`

### UI/UX Patterns
- Use fixed positioning for side panels (avoid modal overlays that block interaction)
- Bottom-left placement for utility toggles
- Closed/collapsed by default unless specified otherwise

### Production Deployment
- User works exclusively in production environment
- Debug features must work in production (not just dev mode)
- User merges to main and tests in production immediately
- No local development environment available

### Correlation ID Tracking
- All chat requests generate UUID correlation IDs
- Propagate via `X-Request-ID` header to backend
- Backend logs with `[REQUEST_ID:xxx]` format
- Debug panel links directly to Supabase logs

## AI Model Configuration

**Default Model**: `anthropic/claude-3.5-sonnet`

**Available Models**:
- Claude 3.5 Sonnet (Smart tier) - $3/M input, $15/M output
- Grok Beta (Fast tier) - $0.05/M input, $0.15/M output
- GPT-4o Mini (Balanced tier) - $0.15/M input, $0.60/M output

Model selection persists in localStorage.

## Commands

```bash
# Development
pnpm dev                    # Start dev server (port 5173)
pnpm build                  # Production build
pnpm preview                # Preview production build

# Supabase Functions
supabase functions serve    # Run functions locally
supabase functions deploy   # Deploy to production
```

## Git Workflow & Pull Requests

### CRITICAL: Automatic PR Creation
**When completing any implementation or set of changes, ALWAYS:**

1. ✅ Commit all changes with clear messages
2. ✅ Push to the feature branch
3. ✅ **IMMEDIATELY provide the PR creation URL** without being asked
4. ✅ Include comprehensive PR title and description

**PR URL Format:**
```
https://github.com/duaneharrison1/heysheetsmvp/compare/main...<branch-name>
```

**The user should NEVER have to ask for the PR URL - provide it proactively every time!**

### Branch Naming
- Feature branches: `claude/feature-name-<session-id>`
- Always push with: `git push -u origin <branch-name>`
- Branch must start with `claude/` and end with matching session ID

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, etc.
- Be specific and descriptive
- Reference files/components changed

### PR Descriptions Should Include
- Summary of changes
- Key features implemented
- Technical implementation details
- Files created/modified
- Any critical fixes applied
- Testing checklist
- Commit list

## Debug Panel

Production-enabled debug monitoring system:

- **Access**: Bottom-left "debug" text button OR `Ctrl+Shift+D`
- **Location**: Fixed left-side panel (384px width)
- **Features**: Request history, timing breakdowns, cost tracking, Supabase log links
- **No Overlay**: Chat remains fully interactive when panel is open

## Common Issues & Solutions

### Build Failures
- Check for pnpm-lock.yaml corruption → run `pnpm install`
- Verify no npm or yarn.lock files present
- Ensure all imports resolve correctly

### Deployment
- Vercel builds from main branch automatically
- Edge functions deployed separately via Supabase CLI
- Environment variables must be set in both Vercel and Supabase

### Dark Mode
- If scrollbars aren't dark: add inline style with scrollbarColor
- Use gray-950 not black (#000) for backgrounds
- Test visibility of text on dark backgrounds

## User Preferences

- Works exclusively in production (no local dev environment)
- Prefers concise, direct responses
- Wants proactive PR creation with URLs
- Values clean, minimal UI (no unnecessary elements)
- Expects dark mode throughout
- Dislikes modal overlays that block interaction
- Merges and tests immediately in production

## Project Goals

Building an AI-powered chat interface for Google Sheets operations with:
- Intent classification (chat vs function execution)
- Google Sheets API integration
- Multi-model support
- Production debugging and monitoring
- Cost and performance tracking
