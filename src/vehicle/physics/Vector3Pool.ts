import { Vector3 } from 'three';

/**
 * Object pool for Vector3 instances to avoid allocations in hot paths.
 * Pre-allocates a pool of Vector3 objects that can be acquired and released.
 */
export class Vector3Pool {
  private pool: Vector3[] = [];
  private readonly maxSize: number;

  constructor(initialSize: number = 100, maxSize: number = 100) {
    this.maxSize = maxSize;
    
    // Pre-allocate initial pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Vector3());
    }
  }

  /**
   * Acquire a Vector3 from the pool. If pool is empty, creates a new instance.
   */
  acquire(): Vector3 {
    return this.pool.pop() || new Vector3();
  }

  /**
   * Release a Vector3 back to the pool. Resets the vector to (0, 0, 0).
   */
  release(vector: Vector3): void {
    if (this.pool.length < this.maxSize) {
      vector.set(0, 0, 0); // Reset
      this.pool.push(vector);
    }
  }

  /**
   * Acquire multiple vectors at once.
   */
  acquireMultiple(count: number): Vector3[] {
    const vectors: Vector3[] = [];
    for (let i = 0; i < count; i++) {
      vectors.push(this.acquire());
    }
    return vectors;
  }

  /**
   * Release multiple vectors at once.
   */
  releaseMultiple(vectors: Vector3[]): void {
    vectors.forEach(v => this.release(v));
  }

  /**
   * Get current pool size (for debugging/monitoring).
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Clear the pool (for cleanup).
   */
  clear(): void {
    this.pool = [];
  }
}

// Global pool instance for use across the physics system
export const vectorPool = new Vector3Pool(100, 100);
