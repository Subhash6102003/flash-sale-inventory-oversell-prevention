import type { Stage, PipelineContext } from '../core/index.js';
import type { ValidateResult, ConfirmResult } from '../types.js';
import type { ProductStore } from '../store.js';
import type { LeaseStore } from '../lease.js';

/**
 * Confirm Stage — commits the inventory decrement and releases the lease.
 * This is the "write" step — happens exactly once per successful order.
 */
export function createConfirmStage(store: ProductStore, leaseStore: LeaseStore): Stage<ValidateResult, ConfirmResult> {
  return {
    id: 'confirm',
    name: 'Confirm Order',
    description: 'Decrements inventory atomically and releases the lease',
    async run(input: ValidateResult, ctx: PipelineContext): Promise<ConfirmResult> {
      const newStock = store.decrementStock(input.productId, input.quantity);

      // Release the lease — we're done writing
      await leaseStore.release(input.leaseKey, input.orderId);

      ctx.logger.info(`Order confirmed. New stock: ${newStock}`, {
        orderId: input.orderId,
        productId: input.productId,
      });

      return {
        orderId: input.orderId,
        productId: input.productId,
        userId: input.userId,
        confirmedAt: Date.now(),
        newStock,
      };
    },
  };
}
