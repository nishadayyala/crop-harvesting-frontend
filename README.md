# Fieldwise — Crop Harvesting System

A responsive React + Vite frontend for crop inventory and harvest tracking. It uses the configured Spring Boot service as the only source of application data; there are no seeded or permanent mock records.

## Requirements

- Node.js 18 or newer and npm
- The Spring Boot backend, when its crop and harvest API is available

## Install and run

```bash
npm install
copy .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). For a production bundle, run `npm run build`; to serve the built bundle locally, use `npm run preview`.

## Backend connection

`src/api.js` centralizes all HTTP requests. Set `VITE_API_BASE_URL` in `.env` to the backend API base URL. By default it is `/api`; the Vite development server proxies `/api` to `http://localhost:8080`.

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

The UI request fields are:

- **Crop request:** `cropName`, `cropType`, `cropVariety`, `fieldLocation`, `cultivatedArea`, `sowingDate`, `expectedHarvestDate`, and `farmerName` are required by the backend. `notes` is optional. Dates use ISO `YYYY-MM-DD` format.
- **Harvest request:** `cropId`, `farmerName`, `fieldLocation`, `plannedHarvestDate`, `harvestedQuantity`, and `status` are required. `actualHarvestDate` and `notes` are optional. Dates use ISO `YYYY-MM-DD` format.
- Responses are JSON arrays of entities with an `id`. Harvest responses contain their associated `crop`; the frontend reads its `id` and `cropName`.

The crop backend does not store growing-season or crop-status fields, so the interface does not fabricate them. The Vite development proxy forwards `/api` to `http://localhost:8080`; the backend also permits the local Vite origins through CORS. Set `VITE_API_BASE_URL` only when the API is hosted at a different base URL.

## Features

- Dashboard totals for crops, harvest records, pending tasks, and completed tasks.
- Crop add, edit, delete, and search.
- Harvest record add, edit, delete, search, and status filtering.
- Responsive navigation, loading indicators, validation, visible API errors, and save/delete feedback.
- About Project page with API integration guidance.
