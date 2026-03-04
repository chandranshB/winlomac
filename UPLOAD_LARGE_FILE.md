# Uploading Large Files to R2 (>300MB)

Your track file is 328 MB, which exceeds Wrangler's 300 MB upload limit. Here are the options:

## Option 1: Cloudflare Dashboard (Easiest)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 > `racing-game` bucket
3. Click on `maps` folder (or create it if it doesn't exist)
4. Click "Upload" button
5. Select `public/tracks/cartoon_race_track_oval.glb`
6. Wait for upload to complete

## Option 2: AWS CLI with R2 (Recommended for automation)

### Setup

1. Install AWS CLI:
   - Windows: Download from https://aws.amazon.com/cli/
   - Or use: `winget install Amazon.AWSCLI`

2. Get R2 API credentials:
   - Go to Cloudflare Dashboard > R2 > Manage R2 API Tokens
   - Click "Create API Token"
   - Give it a name (e.g., "Racing Game Upload")
   - Permissions: Object Read & Write
   - Copy the Access Key ID and Secret Access Key

3. Configure AWS CLI:
```cmd
aws configure
AWS Access Key ID: [Your R2 Access Key ID]
AWS Secret Access Key: [Your R2 Secret Access Key]
Default region name: auto
Default output format: json
```

### Upload

```cmd
aws s3 cp public\tracks\cartoon_race_track_oval.glb s3://racing-game/maps/cartoon_race_track_oval.glb --endpoint-url https://e4f13f7e1a39cc8d90b6d98ac485b439.r2.cloudflarestorage.com --content-type model/gltf-binary
```

Replace `e4f13f7e1a39cc8d90b6d98ac485b439` with your actual account ID if different.

## Option 3: Rclone (Alternative)

1. Install rclone: https://rclone.org/downloads/
2. Configure for Cloudflare R2
3. Upload with: `rclone copy public/tracks/cartoon_race_track_oval.glb r2:racing-game/maps/`

## Verify Upload

After uploading, verify the file is accessible:

```cmd
curl -I https://racing-game.YOUR_ACCOUNT.workers.dev/maps/cartoon_race_track_oval.glb
```

## Next Steps

Once uploaded:
1. Deploy the worker: `cd workers && npx wrangler deploy`
2. Update `.env` with your worker URL
3. Test the game: `npm run dev`
