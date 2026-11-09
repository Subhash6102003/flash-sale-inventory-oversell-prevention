/** Unique identifier for a pipeline run */
export type PipelineRunId = string & { readonly brand: unique symbol };

/** Unique identifier for a pipeline stage */
export type StageId = string & { readonly brand: unique symbol };

/** Status of a single stage execution */
export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/** Status of a full pipeline run */
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

/** A single stage in a pipeline */
export interface Stage<TInput, TOutput> {
  id: string;
  name: string;
  description: string;
  run(input: TInput, ctx: PipelineContext): Promise<TOutput>;
  rollback?(input: TInput, ctx: PipelineContext): Promise<void>;
}

/** Runtime context passed to every stage */
export interface PipelineContext {
  runId: string;
  startedAt: Date;
  metadata: Record<string, unknown>;
  emit(event: PipelineEvent): void;
  logger: import('./logger.js').Logger;
}

/** Events emitted during pipeline execution */
export type PipelineEvent =
  | { type: 'stage:start'; stageId: string; stageName: string; runId: string; ts: number }
  | { type: 'stage:success'; stageId: string; stageName: string; runId: string; durationMs: number; ts: number }
  | { type: 'stage:failure'; stageId: string; stageName: string; runId: string; error: string; ts: number }
  | { type: 'pipeline:start'; runId: string; ts: number }
  | { type: 'pipeline:success'; runId: string; durationMs: number; ts: number }
  | { type: 'pipeline:failure'; runId: string; error: string; ts: number };

/** Result from running a pipeline */
export interface PipelineResult<T> {
  runId: string;
  status: PipelineStatus;
  output?: T;
  error?: string;
  stages: StageResult[];
  durationMs: number;
  startedAt: Date;
  completedAt: Date;
}

/** Result from a single stage */
export interface StageResult {
  stageId: string;
  stageName: string;
  status: StageStatus;
  durationMs: number;
  error?: string;
}
