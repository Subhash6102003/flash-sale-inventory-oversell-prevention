import type { Stage, PipelineContext } from '../core/index.js';
import { InventoryConflictError } from '../core/index.js';
import type { OrderRequest, ReserveResult } from '../types.js';
import type { LeaseStore } from '../lease.js';

/**
 * Reserve Stage — acquires a Redis lease for the product.
 * This is the gatekeeper: only ONE request per product wins at a time.
 * All others are rejected immediately (no DB hit).
 */
export function createReserveStage(leaseStore: LeaseStore): Stage<OrderRequest, ReserveResult> {
  return {
    id: 'reserve',
    name: 'Reserve Inventory Lease',
    description: 'Atomically acquires a lease on the product via Redis SETNX',
    async run(input: OrderRequest, ctx: PipelineContext): Promise<ReserveResult> {
      const leaseKey = `inventory:lease:${input.productId}`;
      const acquired = await leaseStore.acquire(leaseKey, input.orderId, 10_000);

      if (!acquired) {
        throw new InventoryConflictError(
          `Product ${input.productId} is currently being processed by another order. Try again shortly.`,
          input.productId,
          input.quantity,
          0,
        );
      }

      ctx.logger.info(`Lease acquired for product ${input.productId}`, { orderId: input.orderId });

      return {
        ...input,
        leaseKey,
        leaseAcquiredAt: Date.now(),
      };
    },
    async rollback(input: OrderRequest, ctx: PipelineContext): Promise<void> {
      const leaseKey = `inventory:lease:${input.productId}`;
      await leaseStore.release(leaseKey, input.orderId);
      ctx.logger.info(`Lease released (rollback) for product ${input.productId}`);
    },
  };
}
