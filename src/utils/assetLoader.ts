/**
 * Asset loader with local fallback to R2 storage
 * Tries local file first for development speed, falls back to R2 if not available
 */

// Hardcoded R2 public URL for production deployment
const R2_BASE_URL = 'https://pub-7fa6d731a60d4c07a4dcba1d906002be.r2.dev';
const isDevelopment = import.meta.env.DEV;

interface AssetConfig {
  localPath: string;
  r2Path: string;
}

// Cache resolved URLs to avoid repeated checks
const urlCache = new Map<string, string>();

/**
 * Load an asset with local-first strategy
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

  // In development, always use local path (Vite dev server handles it)
  if (isDevelopment) {
    console.log(`[AssetLoader] ✓ Using local asset: ${localPath}`);
    urlCache.set(cacheKey, localPath);
    return localPath;
  }

  // In production, try local first, then fall back to R2
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);
    
    const response = await fetch(localPath, { 
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`[AssetLoader] ✓ Using local asset: ${localPath}`);
      urlCache.set(cacheKey, localPath);
      return localPath;
    }
  } catch {
    console.warn(`[AssetLoader] ⚠ Local asset not available, using R2`);
  }

  // Fall back to R2 in production
  const r2Url = `${R2_BASE_URL}${r2Path}`;
  console.log(`[AssetLoader] → Using R2 asset: ${r2Url}`);
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
} as const;

// Preload critical assets immediately (only in browser)
if (typeof window !== 'undefined') {
  // Start loading track as soon as module loads
  loadAssetWithFallback(ASSETS.TRACK_OVAL).catch(err => 
    console.error('[AssetLoader] Failed to preload track:', err)
  );
}
