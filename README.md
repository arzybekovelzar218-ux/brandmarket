# BrandMarket — web

React 19 · TypeScript · Vite · Tailwind CSS v4 · framer-motion · recharts · @dnd-kit · zustand · axios · lucide-react.

```bash
# backend (unchanged): ~/Downloads/brandmarket-pro/backend
mkdir -p uploads   # must exist before start, or uploaded photos 404
mvn spring-boot:run -Dspring-boot.run.profiles=demo     # :8080, in-memory demo data

npm install
npm run dev        # http://localhost:5173  (proxies /api, /videos, /uploads → :8080)
npm run build      # type-check + production build
```
Other backend port: `BACKEND_URL=http://localhost:8090 npm run dev`.

## Structure
- `src/index.css` — design tokens (colors for both themes, fonts, radii, shadows) in Tailwind's `@theme`
- `src/components/ui` — Button, Card, Input, Badge, Avatar, Img (onError fallback), Skeleton, Stars…
- `src/layout` — sidebar (desktop), bottom bar (mobile), glass header with search / notifications / cart
- `src/pages` — Shop (home), Feed, Product, Brand, Favorites, Checkout, Orders, Dashboard, Factory, Admin, Auth, Onboarding
- Routes reuse the backend's link format: `/p/:id`, `/b/:slug`

Demo accounts are one click on the sign-in page (shopper, creator, factory, admin).
