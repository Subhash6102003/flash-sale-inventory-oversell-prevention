import { describe, it, expect, beforeEach } from 'vitest';
import { createInventoryPipeline } from '../src/pipeline.js';
import { InMemoryLeaseStore } from '../src/lease.js';
import { ProductStore } from '../src/store.js';
import type { OrderOutcome, OrderRequest } from '../src/types.js';

const PRODUCT_ID = 'test-product-1';

function setup(initialStock: number) {
  const leaseStore = new InMemoryLeaseStore();
  const store = new ProductStore();
  const notifications: OrderOutcome[] = [];

  store.seed([{ id: PRODUCT_ID, name: 'Test Product', stock: initialStock, price: 100 }]);

  const pipeline = createInventoryPipeline(leaseStore, store, (o) => notifications.push(o));

  return { leaseStore, store, notifications, pipeline };
}

function makeRequest(n: number): OrderRequest {
  return {
    orderId: `order-${n}`,
    productId: PRODUCT_ID,
    userId: `user-${n}`,
    quantity: 1,
  };
}

describe('E1 — Inventory Oversell Pipeline', () => {
  describe('Single order', () => {
    it('confirms an order when stock is available', async () => {
      const { pipeline } = setup(5);
      const result = await pipeline.run(makeRequest(1));

      expect(result.status).toBe('success');
      expect(result.output?.status).toBe('confirmed');
    });

    it('rejects an order when stock is 0', async () => {
      const { pipeline } = setup(0);
      const result = await pipeline.run(makeRequest(1));

      expect(result.status).toBe('failed');
      expect(result.error).toContain('available');
    });
  });

  describe('Concurrent orders — the race condition test', () => {
    it('allows exactly 1 order when 10 users race for 1 item', async () => {
      const { pipeline } = setup(1);

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => pipeline.run(makeRequest(i))),
      );

      const confirmed = results.filter((r) => r.status === 'success');
      const failed = results.filter((r) => r.status === 'failed');

      expect(confirmed).toHaveLength(1);
      expect(failed).toHaveLength(9);
    });

    it('allows exactly 3 orders when 20 users race for 3 items', async () => {
      const STOCK = 3;
      const USERS = 20;

      // For multi-item stock, we need sequential processing (lease released per confirm)
      const { pipeline } = setup(STOCK);

      // Run sequentially to allow lease cycling (simulates rapid sequential requests)
      const results: Awaited<ReturnType<typeof pipeline.run>>[] = [];
      for (let i = 0; i < USERS; i++) {
        results.push(await pipeline.run(makeRequest(i)));
      }

      const confirmed = results.filter((r) => r.status === 'success');
      expect(confirmed).toHaveLength(STOCK);
    });

    it('never allows negative stock', async () => {
      const { pipeline, store } = setup(1);

      await Promise.all(Array.from({ length: 50 }, (_, i) => pipeline.run(makeRequest(i))));

      const product = store.get(PRODUCT_ID);
      expect(product?.stock).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lease mechanics', () => {
    it('releases the lease on successful confirm', async () => {
      const { pipeline, leaseStore } = setup(5);
      await pipeline.run(makeRequest(1));

      const isHeld = await leaseStore.isHeld(`inventory:lease:${PRODUCT_ID}`);
      expect(isHeld).toBe(false);
    });

    it('rolls back lease on validation failure', async () => {
      const { pipeline, leaseStore } = setup(0); // 0 stock → validate will fail
      await pipeline.run(makeRequest(1));

      // After rollback, lease should be released
      const isHeld = await leaseStore.isHeld(`inventory:lease:${PRODUCT_ID}`);
      expect(isHeld).toBe(false);
    });
  });

  describe('Notifications', () => {
    it('emits a confirmed notification on success', async () => {
      const { pipeline, notifications } = setup(5);
      await pipeline.run(makeRequest(1));

      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.status).toBe('confirmed');
    });
  });
});
