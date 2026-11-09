/**
 * InventoryLease — wraps Redis SETNX semantics.
 * In production: uses ioredis SET key value NX PX ttl.
 * In tests: uses in-memory Map for deterministic behavior.
 */
export interface LeaseStore {
  acquire(key: string, holder: string, ttlMs: number): Promise<boolean>;
  release(key: string, holder: string): Promise<void>;
  isHeld(key: string): Promise<boolean>;
}

export class InMemoryLeaseStore implements LeaseStore {
  private leases = new Map<string, { holder: string; expiresAt: number }>();

  async acquire(key: string, holder: string, ttlMs: number): Promise<boolean> {
    const existing = this.leases.get(key);
    const now = Date.now();

    // If exists and not expired, acquisition fails
    if (existing && existing.expiresAt > now) {
      return false;
    }

    // Atomic set
    this.leases.set(key, { holder, expiresAt: now + ttlMs });
    return true;
  }

  async release(key: string, holder: string): Promise<void> {
    const existing = this.leases.get(key);
    // Only release if we still hold it (compare-and-delete)
    if (existing?.holder === holder) {
      this.leases.delete(key);
    }
  }

  async isHeld(key: string): Promise<boolean> {
    const existing = this.leases.get(key);
    return existing !== undefined && existing.expiresAt > Date.now();
  }

  /** For testing: expire all leases */
  clear(): void {
    this.leases.clear();
  }
}

/** Redis-backed lease for production use */
export class RedisLeaseStore implements LeaseStore {
  constructor(private readonly redis: import('ioredis').Redis) {}

  async acquire(key: string, holder: string, ttlMs: number): Promise<boolean> {
    // SET key holder PX ttlMs NX — atomically sets ONLY if key doesn't exist
    const result = await this.redis.set(key, holder, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async release(key: string, holder: string): Promise<void> {
    // Compare-and-delete via Lua script — atomic
    const luaScript = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(luaScript, 1, key, holder);
  }

  async isHeld(key: string): Promise<boolean> {
    const val = await this.redis.exists(key);
    return val === 1;
  }
}
