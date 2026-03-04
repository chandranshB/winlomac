# Racing Game R2 Worker

Cloudflare Worker for serving large game assets from R2 storage.

## Setup

1. Install dependencies:
```bash
cd workers
npm install
```

2. Login to Cloudflare:
```bash
npx wrangler login
```

3. Update `wrangler.toml` with your account details if needed

4. Upload the map to R2:
```bash
npm run upload-map
```

5. Deploy the worker:
```bash
npm run deploy
```

6. Update `src/utils/assetLoader.ts` with your worker URL:
```typescript
const R2_BASE_URL = 'https://racing-game.YOUR_ACCOUNT.workers.dev';
```

## Development

Test the worker locally:
```bash
npm run dev
```

## R2 Bucket Structure

```
racing-game/
└── maps/
    └── cartoon_race_track_oval.glb
```

## Usage

The asset loader automatically:
- Uses local files in development (fast)
- Falls back to R2 if local file is not available
- Uses R2 in production builds
