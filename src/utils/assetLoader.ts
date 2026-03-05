/**
 * Asset loader with R2 storage for production
 * In development: uses local files from /public
 * In production: always uses R2 (files are NOT deployed)
 */

// Hardcoded R2 public URL for production deployment
const R2_BASE_URL = 'https://pub-7fa6d731a60d4c07a4dcba1d906002be.r2.dev';

// Detect if we're in development (localhost or dev server)
const isDevelopment = import.meta.env.DEV || 
                      (typeof window !== 'undefined' && 
                       (window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1'));

interface AssetConfig {
  localPath: string;
  r2Path: string;
}

// Cache resolved URLs to avoid repeated checks
const urlCache = new Map<string, string>();

/**
 * Load an asset with local-first strategy in dev, R2-only in production
 * @param config Asset configuration with local and R2 paths
 * @returns URL to use for loading the asset
 */
export async function loadAssetWithFallback(config: AssetConfig): Promise<string> {
  const { localPath, r2Path } = config;
  
  // Check cache first
  const cacheKey = localPath + r2Path;
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey)!;
  }

  // In development, use local path (Vite dev server handles it)
  if (isDevelopment) {
    console.log(`[AssetLoader] 🔧 DEV: Using local asset: ${localPath}`);
    urlCache.set(cacheKey, localPath);
    return localPath;
  }

  // In production, ALWAYS use R2 (files are NOT deployed to Vercel)
  const r2Url = `${R2_BASE_URL}${r2Path}`;
  console.log(`[AssetLoader] 🌐 PROD: Using R2 asset: ${r2Url}`);
  urlCache.set(cacheKey, r2Url);
  return r2Url;
}

/**
 * Preload an asset to check availability
 */
export async function preloadAsset(config: AssetConfig): Promise<void> {
  const url = await loadAssetWithFallback(config);
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`Asset not available: ${url}`);
    }
  } catch (err) {
    console.error('[AssetLoader] Failed to preload asset:', err);
    throw err;
  }
}

// Asset configurations
export const ASSETS = {
  TRACK_OVAL: {
    localPath: '/tracks/cartoon_race_track_oval.glb',
    r2Path: '/maps/cartoon_race_track_oval.glb',
  },
  // Car models
  TOYOTA_FORTUNER: {
    localPath: '/models/toyota_fortuner_2021.glb',
    r2Path: '/models/toyota_fortuner_2021.glb',
  },
  MARUTI_800: {
    localPath: '/models/maruti_800_ac.glb',
    r2Path: '/models/maruti_800_ac.glb',
  },
  HYUNDAI_I20: {
    localPath: '/models/2022_hyundai_i20_n_line.glb',
    r2Path: '/models/2022_hyundai_i20_n_line.glb',
  },
} as const;

// Preload critical assets immediately (only in browser and production)
if (typeof window !== 'undefined' && !isDevelopment) {
  // In production, start preloading from R2 immediately
  console.log('[AssetLoader] 🚀 Starting background asset preload from R2...');
  
  Promise.all([
    loadAssetWithFallback(ASSETS.TRACK_OVAL),
    loadAssetWithFallback(ASSETS.TOYOTA_FORTUNER),
    loadAssetWithFallback(ASSETS.MARUTI_800),
    loadAssetWithFallback(ASSETS.HYUNDAI_I20),
  ]).then(() => {
    console.log('[AssetLoader] ✅ All critical assets preloaded from R2');
  }).catch(err => {
    console.error('[AssetLoader] ❌ Failed to preload assets:', err);
  });
}
