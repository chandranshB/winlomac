/**
 * Upload large files to R2 using S3 SDK
 * This bypasses the 300MB Wrangler limit
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const ACCOUNT_ID = 'e4f13f7e1a39cc8d90b6d98ac485b439';
const BUCKET_NAME = 'racing-game';
const MAP_FILE = '../public/tracks/cartoon_race_track_oval.glb';
const R2_PATH = 'maps/cartoon_race_track_oval.glb';

console.log('🏎️  Uploading large map to R2...');
console.log('=====================================\n');

// Check for R2 credentials
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error('❌ Error: R2 credentials not found!\n');
  console.log('Please set up R2 API credentials:');
  console.log('1. Go to: https://dash.cloudflare.com/?to=/:account/r2/api-tokens');
  console.log('2. Click "Create API Token"');
  console.log('3. Give it a name (e.g., "Racing Game Upload")');
  console.log('4. Permissions: Object Read & Write');
  console.log('5. Copy the credentials and run:\n');
  console.log('   set R2_ACCESS_KEY_ID=your_access_key_id');
  console.log('   set R2_SECRET_ACCESS_KEY=your_secret_access_key');
  console.log('   npm run upload-map\n');
  process.exit(1);
}

async function uploadToR2() {
  try {
    // Initialize S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Read the file
    const mapPath = join(__dirname, MAP_FILE);
    console.log(`📁 Reading file: ${mapPath}`);
    const fileBuffer = readFileSync(mapPath);
    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`📊 File size: ${fileSizeMB} MB\n`);

    // Upload to R2
    console.log(`☁️  Uploading to R2: ${BUCKET_NAME}/${R2_PATH}`);
    console.log('⏳ This may take a few minutes...\n');

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: R2_PATH,
      Body: fileBuffer,
      ContentType: 'model/gltf-binary',
    });

    await s3Client.send(command);

    console.log('✅ Upload successful!\n');
    console.log('Next steps:');
    console.log('1. Deploy the worker: npm run deploy');
    console.log('2. Update .env with your worker URL');
    console.log('3. Test: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    if (error.Code === 'InvalidAccessKeyId') {
      console.log('\n💡 Tip: Check your R2_ACCESS_KEY_ID is correct');
    } else if (error.Code === 'SignatureDoesNotMatch') {
      console.log('\n💡 Tip: Check your R2_SECRET_ACCESS_KEY is correct');
    }
    process.exit(1);
  }
}

uploadToR2();
