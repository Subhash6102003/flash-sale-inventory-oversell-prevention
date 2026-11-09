import type { Stage, PipelineContext } from '../core/index.js';
import { InventoryConflictError } from '../core/index.js';
import type { ReserveResult, ValidateResult } from '../types.js';
import type { ProductStore } from '../store.js';

/**
 * Validate Stage — checks actual stock in DB.
 * Runs AFTER lease acquisition, so no race here.
 */
export function createValidateStage(store: ProductStore): Stage<ReserveResult, ValidateResult> {
  return {
    id: 'validate',
    name: 'Validate Stock',
    description: 'Reads current stock and validates sufficient quantity',
    async run(input: ReserveResult, ctx: PipelineContext): Promise<ValidateResult> {
      const product = store.get(input.productId);

      if (!product) {
        throw new Error(`Product ${input.productId} not found`);
      }

      if (product.stock < input.quantity) {
        throw new InventoryConflictError(
          `Only ${product.stock} units of "${product.name}" available, ${input.quantity} requested`,
          input.productId,
          input.quantity,
          product.stock,
        );
      }

      ctx.logger.info(`Stock validated: ${product.stock} available`, { productId: product.id });

      return { ...input, product };
    },
  };
}
