# R2 Setup Guide for Racing Game

This guide will help you set up Cloudflare R2 storage for your large map files.

## Prerequisites

- Cloudflare account
- R2 bucket named `racing-game` (already created)
- Node.js installed

## Step-by-Step Setup

### 1. Install Worker Dependencies

```bash
cd workers
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

This will open a browser window for authentication.

### 3. Get R2 API Credentials

1. Go to [Cloudflare Dashboard > R2 > Manage R2 API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens)
2. Click "Create API Token"
3. Name: "Racing Game Upload"
4. Permissions: Object Read & Write
5. TTL: Forever (or your preference)
6. Click "Create API Token"
7. Copy the Access Key ID and Secret Access Key

### 4. Upload the Map to R2

Set your credentials (in CMD):
```cmd
set R2_ACCESS_KEY_ID=your_access_key_id
set R2_SECRET_ACCESS_KEY=your_secret_access_key
```

Then upload:
```cmd
cd workers
npm install
npm run upload-map
```

This uses the S3 API to upload files larger than 300 MB.

### 4. Deploy the Worker

```bash
npm run deploy
```

After deployment, you'll see a URL like: `https://racing-game.YOUR_ACCOUNT.workers.dev`

### 5. Configure Your App

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and update with your worker URL:

```
VITE_R2_BASE_URL=https://racing-game.YOUR_ACCOUNT.workers.dev
```

### 6. Test Locally

```bash
cd ..
npm run dev
```

The app will:
- Try to load the map from `/public/tracks/` (local) first
- Fall back to R2 if not available
- Log which source is being used in the console

### 7. Remove Local Map (Optional)

Once R2 is working, you can remove the large file from git:

```bash
git rm public/tracks/cartoon_race_track_oval.glb
git commit -m "Move large map file to R2 storage"
```

## How It Works

### Development Mode
1. Checks if local file exists at `/tracks/cartoon_race_track_oval.glb`
2. If found, uses local file (fast loading)
3. If not found, falls back to R2

### Production Mode
- Always uses R2 (configured via `VITE_R2_BASE_URL`)

## Troubleshooting

### Worker not accessible
- Check your worker URL in Cloudflare dashboard
- Verify R2 bucket binding in `workers/wrangler.toml`
- Check CORS headers are set correctly

### Map not loading
- Check browser console for asset loader logs
- Verify file was uploaded: `npx wrangler r2 object get racing-game/maps/cartoon_race_track_oval.glb`
- Test worker directly: `curl https://YOUR_WORKER_URL/maps/cartoon_race_track_oval.glb -I`

### Local fallback not working
- Ensure file exists at `public/tracks/cartoon_race_track_oval.glb`
- Check browser network tab for 404 errors
- Verify Vite is serving the public directory

## R2 Bucket Structure

```
racing-game/
└── maps/
    └── cartoon_race_track_oval.glb
```

## Adding More Assets

To add more large assets to R2:

1. Add to `src/utils/assetLoader.ts`:
```typescript
export const ASSETS = {
  TRACK_OVAL: {
    localPath: '/tracks/cartoon_race_track_oval.glb',
    r2Path: '/maps/cartoon_race_track_oval.glb',
  },
  NEW_ASSET: {
    localPath: '/path/to/local.glb',
    r2Path: '/maps/new-asset.glb',
  },
} as const;
```

2. Upload to R2:
```bash
npx wrangler r2 object put racing-game/maps/new-asset.glb --file="public/path/to/local.glb"
```

3. Use in your component:
```typescript
const url = await loadAssetWithFallback(ASSETS.NEW_ASSET);
```

## Cost Considerations

Cloudflare R2:
- Storage: $0.015/GB/month
- Class A operations (writes): $4.50/million
- Class B operations (reads): $0.36/million
- No egress fees!

For a ~50MB map file with moderate traffic, costs should be minimal.
