/** Simple in-memory metrics collector. In prod, swap this for Prometheus. */
export interface MetricLabels {
  [key: string]: string | number;
}

interface Counter {
  increment(labels?: MetricLabels): void;
  value(labels?: MetricLabels): number;
}

interface Histogram {
  observe(value: number, labels?: MetricLabels): void;
  percentile(p: number, labels?: MetricLabels): number;
}

class InMemoryCounter implements Counter {
  private counts = new Map<string, number>();

  private key(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return '__default__';
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  increment(labels?: MetricLabels): void {
    const k = this.key(labels);
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }

  value(labels?: MetricLabels): number {
    return this.counts.get(this.key(labels)) ?? 0;
  }
}

class InMemoryHistogram implements Histogram {
  private observations = new Map<string, number[]>();

  private key(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return '__default__';
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  observe(value: number, labels?: MetricLabels): void {
    const k = this.key(labels);
    const existing = this.observations.get(k) ?? [];
    existing.push(value);
    this.observations.set(k, existing);
  }

  percentile(p: number, labels?: MetricLabels): number {
    const values = [...(this.observations.get(this.key(labels)) ?? [])].sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const idx = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, idx)] ?? 0;
  }
}

export function createCounter(_name: string, _description: string): Counter {
  return new InMemoryCounter();
}

export function createHistogram(_name: string, _description: string): Histogram {
  return new InMemoryHistogram();
}
