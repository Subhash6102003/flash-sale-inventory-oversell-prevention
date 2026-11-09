import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type {
  Stage,
  PipelineContext,
  PipelineEvent,
  PipelineResult,
  StageResult,
} from './types.js';
import { createLogger } from './logger.js';
import { PipelineError, StageError } from './errors.js';

/**
 * Pipeline — a typed, ordered sequence of stages that execute in series.
 * Each stage receives the output of the previous stage as its input.
 * On any stage failure, compensating rollbacks run in reverse order.
 */
export class Pipeline<TInitial, TFinal> {
  private readonly emitter = new EventEmitter();
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Subscribe to pipeline events (stage:start, stage:success, stage:failure, etc.)
   */
  on(event: 'event', listener: (e: PipelineEvent) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  /**
   * Run a linear pipeline — stages run in order, output flows as input.
   */
  async run<T>(
    stages: Stage<unknown, unknown>[],
    initialInput: TInitial,
    metadata: Record<string, unknown> = {},
  ): Promise<PipelineResult<TFinal>> {
    const runId = randomUUID();
    const startedAt = new Date();
    const stageResults: StageResult[] = [];
    const completedStages: Array<{ stage: Stage<unknown, unknown>; input: unknown }> = [];
    const logger = createLogger(`pipeline:${this.name}`);

    const ctx: PipelineContext = {
      runId,
      startedAt,
      metadata,
      logger,
      emit: (event: PipelineEvent) => this.emitter.emit('event', event),
    };

    ctx.emit({ type: 'pipeline:start', runId, ts: Date.now() });
    logger.info(`Pipeline "${this.name}" started`, { runId });

    let current: unknown = initialInput;

    for (const stage of stages) {
      const stageStart = Date.now();
      ctx.emit({ type: 'stage:start', stageId: stage.id, stageName: stage.name, runId, ts: stageStart });

      try {
        const output = await stage.run(current, ctx);
        const durationMs = Date.now() - stageStart;

        completedStages.push({ stage, input: current });
        stageResults.push({ stageId: stage.id, stageName: stage.name, status: 'success', durationMs });
        ctx.emit({ type: 'stage:success', stageId: stage.id, stageName: stage.name, runId, durationMs, ts: Date.now() });
        logger.info(`Stage "${stage.name}" succeeded`, { durationMs });

        current = output;
      } catch (err) {
        const durationMs = Date.now() - stageStart;
        const errorMsg = err instanceof Error ? err.message : String(err);

        stageResults.push({ stageId: stage.id, stageName: stage.name, status: 'failed', durationMs, error: errorMsg });
        ctx.emit({ type: 'stage:failure', stageId: stage.id, stageName: stage.name, runId, error: errorMsg, ts: Date.now() });
        logger.error(`Stage "${stage.name}" failed: ${errorMsg}`);

        // Compensating rollbacks in reverse order
        await this.runRollbacks(completedStages, ctx);

        const totalDuration = Date.now() - startedAt.getTime();
        ctx.emit({ type: 'pipeline:failure', runId, error: errorMsg, ts: Date.now() });

        return {
          runId,
          status: 'failed',
          error: errorMsg,
          stages: stageResults,
          durationMs: totalDuration,
          startedAt,
          completedAt: new Date(),
        };
      }
    }

    const totalDuration = Date.now() - startedAt.getTime();
    ctx.emit({ type: 'pipeline:success', runId, durationMs: totalDuration, ts: Date.now() });
    logger.info(`Pipeline "${this.name}" succeeded`, { durationMs: totalDuration });

    return {
      runId,
      status: 'success',
      output: current as TFinal,
      stages: stageResults,
      durationMs: totalDuration,
      startedAt,
      completedAt: new Date(),
    };
  }

  private async runRollbacks(
    completedStages: Array<{ stage: Stage<unknown, unknown>; input: unknown }>,
    ctx: PipelineContext,
  ): Promise<void> {
    const reversed = [...completedStages].reverse();
    for (const { stage, input } of reversed) {
      if (stage.rollback) {
        try {
          await stage.rollback(input, ctx);
          ctx.logger.info(`Rollback succeeded for stage "${stage.name}"`);
        } catch (rollbackErr) {
          ctx.logger.error(`Rollback FAILED for stage "${stage.name}": ${rollbackErr}`);
        }
      }
    }
  }
}
