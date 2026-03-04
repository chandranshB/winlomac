/**
 * Asset loader with local fallback to R2 storage
 * Tries local file first for development speed, falls back to R2 if not available
 */

const R2_BASE_URL = import.meta.env.VITE_R2_BASE_URL || 'https://racing-game.YOUR_ACCOUNT.workers.dev';
const isDevelopment = import.meta.env.DEV;

interface AssetConfig {
  localPath: string;
  r2Path: string;
}

/**
 * Load an asset with local-first strategy
 * @param config Asset configuration with local and R2 paths
 * @returns URL to use for loading the asset
 */
export async function loadAssetWithFallback(config: AssetConfig): Promise<string> {
  const { localPath, r2Path } = config;

  // In development, try local first
  if (isDevelopment) {
    try {
      const response = await fetch(localPath, { method: 'HEAD' });
      if (response.ok) {
        console.log(`[AssetLoader] Using local asset: ${localPath}`);
        return localPath;
      }
    } catch {
      console.warn(`[AssetLoader] Local asset not found: ${localPath}, falling back to R2`);
    }
  }

  // Fall back to R2 (or use R2 directly in production)
  const r2Url = `${R2_BASE_URL}${r2Path}`;
  console.log(`[AssetLoader] Using R2 asset: ${r2Url}`);
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
