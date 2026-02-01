/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 *
 * Single-flight mechanism for coordinating concurrent snapshot generation.
 *
 * Two-layer approach:
 * 1. In-memory promise map (module-level): Prevents duplicate work within the same Node process.
 *    - Shared across all FhirSnapshotGenerator instances regardless of cache path.
 *    - No TTL needed since it's promise-based; completes or fails naturally.
 *
 * 2. On-disk lockfiles (file-based): Prevents duplicate work across separate Node processes.
 *    - Only effective when processes share the same cache path.
 *    - 3-minute TTL to handle stale locks from crashed processes.
 */

import fs from 'fs-extra';
import path from 'path';

/** TTL for disk-based locks in milliseconds (3 minutes) */
const DISK_LOCK_TTL_MS = 3 * 60 * 1000;

/** Poll interval when waiting for another process's lock */
const LOCK_POLL_INTERVAL_MS = 100;

/** Maximum time to wait for another process's lock before giving up */
const LOCK_WAIT_TIMEOUT_MS = DISK_LOCK_TTL_MS + 10_000; // TTL + 10 seconds buffer

/**
 * Module-level in-memory promise map for single-flighting within the same Node process.
 * Key format: `${packageId}#${packageVersion}/${filename}` (cache-path independent)
 */
const inflightPromises = new Map<string, Promise<any>>();

/**
 * Lock file content structure
 */
interface LockFileContent {
  pid: number;
  timestamp: number;
  hostname: string;
}

/**
 * Generates a unique key for the in-memory single-flight map.
 * This key is cache-path independent since all instances in the same process
 * will generate the same snapshot for the same file.
 */
export function getInflightKey(filename: string, packageId: string, packageVersion: string): string {
  return `${packageId}#${packageVersion}/${filename}`;
}

/**
 * Gets the path for the disk-based lockfile.
 * Located alongside where the cached snapshot would be stored.
 */
export function getLockFilePath(cacheFilePath: string): string {
  return `${cacheFilePath}.lock`;
}

/**
 * Check if a lock file is stale (exceeded TTL or process no longer exists).
 */
async function isLockStale(lockPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(lockPath, 'utf8');
    const lockData: LockFileContent = JSON.parse(content);
    const age = Date.now() - lockData.timestamp;

    // If lock is older than TTL, it's stale
    if (age > DISK_LOCK_TTL_MS) {
      return true;
    }

    // On the same machine, check if the locking process is still alive
    // This is a best-effort check; cross-machine locks rely solely on TTL
    if (lockData.hostname === getHostname()) {
      try {
        // Sending signal 0 checks if process exists without killing it
        process.kill(lockData.pid, 0);
        return false; // Process is still alive
      } catch {
        return true; // Process no longer exists
      }
    }

    return false; // Different machine, trust TTL
  } catch {
    // If we can't read the lock file, treat it as stale
    return true;
  }
}

/**
 * Get the hostname for lock identification.
 */
function getHostname(): string {
  try {
    return require('os').hostname();
  } catch {
    return 'unknown';
  }
}

/**
 * Create lock file content.
 */
function createLockContent(): LockFileContent {
  return {
    pid: process.pid,
    timestamp: Date.now(),
    hostname: getHostname()
  };
}

/**
 * Attempt to acquire a disk-based lock.
 * Uses atomic file operations to prevent race conditions.
 *
 * @returns true if lock was acquired, false if another process holds the lock
 */
async function tryAcquireDiskLock(lockPath: string): Promise<boolean> {
  try {
    await fs.ensureDir(path.dirname(lockPath));

    // Check if lock exists and is not stale
    if (await fs.exists(lockPath)) {
      if (!(await isLockStale(lockPath))) {
        return false; // Another process holds a valid lock
      }
      // Lock is stale, try to remove it
      try {
        await fs.remove(lockPath);
      } catch {
        // Another process might have removed it or acquired it
      }
    }

    // Try to create lock file atomically using exclusive flag
    const lockContent = JSON.stringify(createLockContent());
    const uniqueSuffix = `${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
    const tmpPath = `${lockPath}.${uniqueSuffix}.tmp`;

    try {
      await fs.writeFile(tmpPath, lockContent);
      // Attempt atomic move with no overwrite
      await fs.move(tmpPath, lockPath, { overwrite: false });
      return true;
    } catch (e) {
      // Clean up temp file
      try {
        await fs.remove(tmpPath);
      } catch {
        // Ignore cleanup errors
      }

      // If EEXIST, another process won the race
      if ((e as any)?.code === 'EEXIST') {
        return false;
      }

      // Check if lock exists now (race condition)
      if (await fs.exists(lockPath)) {
        return false;
      }

      throw e;
    }
  } catch {
    // On any error, assume we didn't get the lock
    return false;
  }
}

/**
 * Release a disk-based lock.
 * Only removes the lock if we own it (same PID).
 */
async function releaseDiskLock(lockPath: string): Promise<void> {
  try {
    // Verify we own the lock before removing
    const content = await fs.readFile(lockPath, 'utf8');
    const lockData: LockFileContent = JSON.parse(content);

    if (lockData.pid === process.pid && lockData.hostname === getHostname()) {
      await fs.remove(lockPath);
    }
  } catch {
    // Ignore errors during lock release
  }
}

/**
 * Wait for another process's lock to be released (cache file to appear).
 * Returns true if cache file appeared, false if timeout/lock became stale.
 */
async function waitForExternalLock(
  lockPath: string,
  cacheFilePath: string
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_WAIT_TIMEOUT_MS) {
    // Check if cache file exists (the other process finished successfully)
    if (await fs.exists(cacheFilePath)) {
      return true;
    }

    // Check if lock is gone or stale (process finished or crashed)
    if (!(await fs.exists(lockPath)) || (await isLockStale(lockPath))) {
      return false; // Lock is gone/stale, we should try to generate
    }

    // Wait a bit before polling again
    await new Promise(resolve => setTimeout(resolve, LOCK_POLL_INTERVAL_MS));
  }

  // Timeout reached
  return false;
}

/**
 * Result of single-flight execution
 */
export interface SingleFlightResult<T> {
  /** The result value (either from generation or cache) */
  value: T;
  /** Whether this call performed the actual generation (vs waiting for another) */
  wasGenerator: boolean;
}

/**
 * Options for single-flight execution
 */
export interface SingleFlightOptions<T> {
  /** Unique identifier for this operation (cache-path independent for in-memory) */
  key: string;
  /** Path where the cached result would be stored (for disk locking). Pass undefined to skip disk locking. */
  cacheFilePath?: string;
  /** Async function that generates the result */
  generator: () => Promise<T>;
  /** Optional function to get cached result (called when waiting for external lock) */
  getCached?: () => Promise<T | undefined>;
}

/**
 * Execute a function with single-flight semantics.
 * Ensures only one execution happens at a time for the same key,
 * both within the process (in-memory) and across processes (disk locks).
 *
 * @param options - Configuration for single-flight execution
 * @returns The result from the generator or from waiting on another execution
 */
export async function singleFlight<T>(options: SingleFlightOptions<T>): Promise<SingleFlightResult<T>> {
  const { key, cacheFilePath, generator, getCached } = options;
  const useDiskLocking = cacheFilePath !== undefined;

  // Layer 1: In-memory single-flight (same process)
  const existingPromise = inflightPromises.get(key);
  if (existingPromise) {
    // Another call in this process is already generating
    const value = await existingPromise;
    return { value, wasGenerator: false };
  }

  // Layer 2: Disk-based single-flight (cross-process) - only if caching is enabled
  let lockPath: string | undefined;
  let acquiredLock = false;

  if (useDiskLocking) {
    lockPath = getLockFilePath(cacheFilePath);

    // Try to acquire disk lock
    acquiredLock = await tryAcquireDiskLock(lockPath);

    if (!acquiredLock) {
      // Another process is generating, wait for it
      const cacheAppeared = await waitForExternalLock(lockPath, cacheFilePath);

      if (cacheAppeared && getCached) {
        // The other process finished, try to read the cached result
        const cached = await getCached();
        if (cached !== undefined) {
          return { value: cached, wasGenerator: false };
        }
      }

      // Either timeout, lock became stale, or cache read failed
      // Fall through to try generating ourselves
      acquiredLock = await tryAcquireDiskLock(lockPath);
      if (!acquiredLock) {
        // Still can't acquire lock, recursively try single-flight again
        // This handles the case where another process picked up the stale lock
        return singleFlight(options);
      }
    }
  }

  // We have the disk lock (or don't need one), now execute with in-memory dedup
  const executionPromise = (async () => {
    try {
      return await generator();
    } finally {
      // Release disk lock if we acquired one
      if (useDiskLocking && lockPath) {
        await releaseDiskLock(lockPath);
      }
    }
  })();

  // Register in-memory promise
  inflightPromises.set(key, executionPromise);

  try {
    const value = await executionPromise;
    return { value, wasGenerator: true };
  } finally {
    // Clean up in-memory promise
    inflightPromises.delete(key);
  }
}

/**
 * Check if there's an in-flight operation for the given key.
 * Useful for testing or debugging.
 */
export function hasInflightOperation(key: string): boolean {
  return inflightPromises.has(key);
}

/**
 * Get the number of in-flight operations.
 * Useful for testing or debugging.
 */
export function getInflightCount(): number {
  return inflightPromises.size;
}

/**
 * Clear all in-flight operations.
 * WARNING: Only use for testing. Does not cancel running operations.
 */
export function clearInflightOperations(): void {
  inflightPromises.clear();
}
