import type { Stage, PipelineContext } from '../core/index.js';
import type { ConfirmResult, OrderOutcome } from '../types.js';

export type NotifyFn = (outcome: OrderOutcome) => void;

/**
 * Notify Stage — broadcasts order outcome to WebSocket clients.
 */
export function createNotifyStage(notify: NotifyFn): Stage<ConfirmResult, OrderOutcome> {
  return {
    id: 'notify',
    name: 'Notify Client',
    description: 'Sends order confirmation via WebSocket',
    async run(input: ConfirmResult, ctx: PipelineContext): Promise<OrderOutcome> {
      const outcome: OrderOutcome = {
        status: 'confirmed',
        orderId: input.orderId,
        userId: input.userId,
        newStock: input.newStock,
      };

      notify(outcome);
      ctx.logger.info(`Order confirmation sent`, { orderId: input.orderId });

      return outcome;
    },
  };
}
