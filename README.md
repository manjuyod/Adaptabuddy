# Adaptabuddy

Adaptive training companion scaffold built with Next.js 15 App Router, TypeScript, Tailwind, and Supabase. Mobile-first UI with a bottom nav, offline-ready PWA hooks, and a lightweight design system.

## Tech stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS with custom brand palette and Space Grotesk font
- Supabase (browser + server clients, cookie sessions, OAuth callback)
- PWA basics (manifest, service worker stub, generated icons/favicons)
- Design system primitives (Button, Card, Input, Toggle, Chip, Toast)

## App structure
- `/login`: Supabase email/password + Google OAuth stub
- `/train`, `/wizard`, `/kpi`, `/settings`, `/library/exercises`: mobile-first pages rendered via `app/(app)/` layout with bottom navigation
- Middleware + API callback for Supabase session cookies: `middleware.ts`, `app/api/auth/callback/route.ts`
- PWA wiring: `app/manifest.ts`, `public/sw.js`, `app/providers.tsx`

## Getting started
```bash
npm install
npm run dev
```

Set required environment variables (see `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Changelog
- Initial scaffold: Next.js + Tailwind app with Supabase SSR/browser clients, PWA manifest + service worker stub, design system components, and all required routes/pages.
