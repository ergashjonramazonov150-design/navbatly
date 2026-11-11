# Navbatly

Online appointment booking for barbershops and beauty salons in Uzbekistan.

**Stack:** React + TypeScript (Vite), Tailwind CSS, shadcn/ui, Supabase, Vercel, Telegram Bot API.
Architecture and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL + publishable key
npm run dev                  # http://localhost:5173
```

## Scripts

| Command            | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `npm run dev`      | Start the dev server                                 |
| `npm run build`    | Type-check and build for production                  |
| `npm run lint`     | Lint with oxlint                                     |
| `npm run format`   | Format all files with Prettier                       |
| `npm run db:push`  | Apply `supabase/migrations` to the linked project    |
| `npm run db:types` | Regenerate `src/types/database.types.ts` from the DB |

## Database

Never change the schema in the Supabase dashboard. Every change is a new SQL file in
`supabase/migrations/`, applied with `npm run db:push`.
