import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { ingestDocument } from './ingest';

export const INGEST_QUEUE = 'documind-ingest';

let queue: Queue | null = null;
let worker: Worker | null = null;

function redisConnection() {
  const url = new URL(config.redisUrl);
  return new IORedis({
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null, // required by BullMQ
  });
}

/**
 * With REDIS_URL, ingestion runs as a BullMQ job (retries, backpressure).
 * Without it we process inline so the demo still works with zero services.
 */
export async function enqueueIngestion(documentId: string, text: string): Promise<void> {
  if (!config.redisUrl) {
    setImmediate(() =>
      ingestDocument(documentId, text).catch((e) => console.error('inline ingest failed:', e.message)),
    );
    return;
  }
  if (!queue) {
    queue = new Queue(INGEST_QUEUE, { connection: redisConnection() });
  }
  await queue.add('ingest', { documentId, text }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}

export function startIngestWorker(): void {
  if (!config.redisUrl || worker) return;
  worker = new Worker(
    INGEST_QUEUE,
    async (job) => ingestDocument(job.data.documentId as string, job.data.text as string),
    { connection: redisConnection(), concurrency: 2 },
  );
  worker.on('failed', (job, err) => console.error(`ingest job ${job?.id} failed:`, err.message));
}

export async function stopQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
}
