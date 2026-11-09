export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly runId: string,
    override readonly cause?: Error,
  ) {
    super(message, { cause });
    this.name = 'PipelineError';
  }
}

export class StageError extends Error {
  constructor(
    message: string,
    public readonly stageId: string,
    public readonly stageName: string,
    override readonly cause?: Error,
  ) {
    super(message, { cause });
    this.name = 'StageError';
  }
}

export class IdempotencyError extends Error {
  constructor(
    message: string,
    public readonly key: string,
  ) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

export class InventoryConflictError extends Error {
  constructor(
    message: string,
    public readonly productId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(message);
    this.name = 'InventoryConflictError';
  }
}

export class DuplicateEntityError extends Error {
  constructor(
    message: string,
    public readonly canonicalId: string,
    public readonly duplicateId: string,
  ) {
    super(message);
    this.name = 'DuplicateEntityError';
  }
}
