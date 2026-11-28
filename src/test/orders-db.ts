import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { OrdersDb, Statement } from "../../worker/orders";
import type { ProofBucket } from "../../worker/order-actions";

/** A real SQLite, loaded from every migration, behind the interface the Worker uses. */
export function makeDb(): { db: OrdersDb; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  const dir = resolve(__dirname, "../../migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    raw.exec(readFileSync(resolve(dir, file), "utf8"));
  }
  const stmt = (sql: string, params: unknown[] = []): Statement & { exec: () => { changes: number } } => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    first: async <T,>() => (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
    all: async <T,>() => ({ results: raw.prepare(sql).all(...(params as never[])) as T[] }),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(params as never[])).changes) } }),
    exec: () => ({ changes: Number(raw.prepare(sql).run(...(params as never[])).changes) }),
  });
  const db: OrdersDb = {
    prepare: (sql) => stmt(sql),
    batch: async (statements) => {
      raw.exec("BEGIN");
      try {
        const out = statements.map((s) => ({ meta: (s as ReturnType<typeof stmt>).exec() }));
        raw.exec("COMMIT");
        return out;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
  };
  return { db, raw };
}

/** An in-memory stand-in for the private proofs bucket. */
export function makeBucket() {
  const files = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const bucket: ProofBucket = {
    put: async (key, value, options) => {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      files.set(key, { bytes: bytes.slice(), contentType: options?.httpMetadata?.contentType });
    },
    delete: async (key) => {
      files.delete(key);
    },
  };
  return { bucket, files };
}
