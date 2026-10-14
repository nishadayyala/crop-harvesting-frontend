# Fieldwise — Crop Harvesting System

A responsive React + Vite frontend for crop inventory and harvest tracking. It uses the configured Spring Boot service as the only source of application data; there are no seeded or permanent mock records.

## Requirements

- Node.js 20 or newer and npm
- The Spring Boot backend, when its crop and harvest API is available

## Install and run

```bash
npm install
copy .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). For a production bundle, run `npm run build`; to serve the built bundle locally, use `npm run preview`.

## Backend connection and sign-in

`src/api.js` centralizes all HTTP requests. Set `VITE_API_BASE_URL` in `.env` to the backend API base URL. By default it is `/api`; the Vite development server proxies `/api` to `http://localhost:8080`.

For production, the Vercel serverless handler in `api/[...path].js` forwards same-origin `/api/*` requests to the Render service. It passes the session cookie, CSRF header, request origin, and response cookies through without putting the backend address in browser code. The handler requires Node.js 20 or newer.

The app requires a backend session. New users can register as farmers; administrators must be provisioned by the backend owner. The backend returns an HTTP-only session cookie and a separate CSRF cookie/token for protected requests. Do not put passwords, session tokens, or database credentials in Vite variables. Values prefixed with `VITE_` are visible to every browser user.

The backend uses a class-level `@RequestMapping("/api")`. The frontend calls the following controller mappings:

| Method | Path | Expected behavior |
| --- | --- | --- |
| GET | `/api/crops` | List crops (JSON array) |
| GET | `/api/crops/{id}` | Fetch one crop |
| POST | `/api/crops` | Create a crop; returns `201` and the created entity |
| PUT | `/api/crops/{id}` | Update a crop; returns the updated entity |
| DELETE | `/api/crops/{id}` | Delete a crop; returns `204` |
| GET | `/api/harvests` | List harvesting records (JSON array) |
| GET | `/api/harvests/{id}` | Fetch one harvesting record |
| POST | `/api/harvests` | Create a record; returns `201` and the created entity |
| PUT | `/api/harvests/{id}` | Update a record; returns the updated entity |
| DELETE | `/api/harvests/{id}` | Delete a record; returns `204` |
| GET | `/api/auth/csrf` | Get the CSRF token needed by state-changing requests |
| POST | `/api/auth/register` | Register as a farmer and start a session |
| POST | `/api/auth/login` | Sign in and start a session |
| GET | `/api/auth/me` | Return the current safe user profile |
| POST | `/api/auth/logout` | End the current session |

The UI request fields are:

- **Crop request:** `cropName`, `cropType`, `cropVariety`, `fieldLocation`, `cultivatedArea`, `sowingDate`, `expectedHarvestDate`, and `farmerName` are required by the backend. `notes` is optional. Dates use ISO `YYYY-MM-DD` format.
- **Harvest request:** `cropId`, `farmerName`, `fieldLocation`, `plannedHarvestDate`, `harvestedQuantity`, and `status` are required. `actualHarvestDate` and `notes` are optional. Dates use ISO `YYYY-MM-DD` format.
- Responses are JSON arrays of entities with an `id`. Harvest responses contain their associated `crop`; the frontend reads its `id` and `cropName`.

The crop backend does not store growing-season or crop-status fields, so the interface does not fabricate them. Farmers only see records they own; administrators can see all records. The Vite development proxy forwards `/api` to `http://localhost:8080`; the backend permits the configured local origins through credentialed CORS.

### Production frontend configuration

In Vercel, import this repository using the repository root, set the build command to `npm run build` and output directory to `dist`, and set `VITE_API_BASE_URL` to `/api` (or leave it unset). In the Vercel project's **server-side** environment variables, set `BACKEND_API_URL` to the Render service's HTTPS origin only, such as `https://your-service.onrender.com` (no `/api` path, credentials, or trailing path). The value is read only by the Vercel function and is not exposed in the browser bundle.

Set the backend's `CORS_ALLOWED_ORIGINS` to the exact deployed Vercel origin (scheme and host, no trailing slash). The browser talks to Vercel on the same origin as the app; Vercel forwards the request and cookies to Render, so the production `Secure; SameSite=Lax` session cookie is first-party in the browser. This avoids dependence on third-party-cookie settings and does not require a shared custom domain. Never place database credentials, session tokens, or other private secrets in a `VITE_` variable.

## Features

- Dashboard totals for crops, harvest records, pending tasks, and completed tasks.
- Crop add, edit, delete, and search.
- Harvest record add, edit, delete, search, and status filtering.
- Responsive navigation, loading indicators, validation, visible API errors, and save/delete feedback.
- Farmer registration and sign-in, session restoration, and sign-out.
- A Vercel same-origin API proxy with focused tests for cookies, CSRF, and configuration errors.
- About Project page with API integration guidance.

Run frontend checks with `npm test` and `npm run build`.
