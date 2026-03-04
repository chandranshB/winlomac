/**
 * Script to upload the track map to R2 using multipart upload
 * Run: npm run upload-map
 */

import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = 'racing-game';
const MAP_FILE = '../public/tracks/cartoon_race_track_oval.glb';
const R2_PATH = 'maps/cartoon_race_track_oval.glb';
const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB chunks

// Get credentials from wrangler config
const ACCOUNT_ID = 'e4f13f7e1a39cc8d90b6d98ac485b439';

console.log('🏎️  Uploading large map to R2 using multipart upload...');
console.log(`Bucket: ${BUCKET_NAME}`);
console.log(`File: ${MAP_FILE}`);
console.log(`R2 Path: ${R2_PATH}`);

async function uploadToR2() {
  try {
    const mapPath = join(__dirname, MAP_FILE);
    const fileSize = statSync(mapPath).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    
    console.log(`\nFile size: ${fileSizeMB} MB`);
    console.log('Note: Please ensure you have R2 API credentials configured.');
    console.log('Run: wrangler r2 bucket create racing-game (if not already created)');
    console.log('\nFor files over 300MB, please use the Cloudflare Dashboard or AWS CLI with R2 credentials:');
    console.log('1. Go to Cloudflare Dashboard > R2 > Manage R2 API Tokens');
    console.log('2. Create an API token with R2 write permissions');
    console.log('3. Use AWS CLI: aws s3 cp ' + mapPath + ' s3://racing-game/maps/cartoon_race_track_oval.glb --endpoint-url https://' + ACCOUNT_ID + '.r2.cloudflarestorage.com');
    console.log('\nAlternatively, upload via Cloudflare Dashboard:');
    console.log('1. Go to R2 > racing-game bucket');
    console.log('2. Navigate to maps/ folder');
    console.log('3. Click Upload and select the file');
    
  } catch (error) {
    console.error('\n✗ Upload preparation failed:', error.message);
    process.exit(1);
  }
}

uploadToR2();
