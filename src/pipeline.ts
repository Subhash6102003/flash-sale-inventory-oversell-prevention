import { Pipeline } from './core/index.js';
import type { OrderRequest, OrderOutcome } from './types.js';
import type { LeaseStore } from './lease.js';
import type { ProductStore } from './store.js';
import type { NotifyFn } from './stages/notify.js';
import { createReserveStage } from './stages/reserve.js';
import { createValidateStage } from './stages/validate.js';
import { createConfirmStage } from './stages/confirm.js';
import { createNotifyStage } from './stages/notify.js';
import type { PipelineResult } from './core/index.js';

export function createInventoryPipeline(
  leaseStore: LeaseStore,
  productStore: ProductStore,
  notify: NotifyFn,
): {
  run(request: OrderRequest): Promise<PipelineResult<OrderOutcome>>;
  on(event: 'event', listener: (e: import('./core/index.js').PipelineEvent) => void): void;
} {
  const pipeline = new Pipeline<OrderRequest, OrderOutcome>('inventory-oversell');

  const stages = [
    createReserveStage(leaseStore),
    createValidateStage(productStore),
    createConfirmStage(productStore, leaseStore),
    createNotifyStage(notify),
  ];

  return {
    run: (request) => pipeline.run(stages as import('./core/index.js').Stage<unknown, unknown>[], request),
    on: (event, listener) => pipeline.on(event, listener),
  };
}
