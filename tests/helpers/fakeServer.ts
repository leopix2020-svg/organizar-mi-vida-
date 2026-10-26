/* api/state.js real corriendo sobre un MongoDB falso en memoria, más un fetch que lo usa. */
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

type Doc = Record<string, any>;
function matches(doc: Doc, filter: Doc): boolean {
  return Object.keys(filter).every(k => {
    const f = filter[k];
    if (k === '$or') return f.some((sub: Doc) => matches(doc, sub));
    if (f && typeof f === 'object' && !Array.isArray(f)) {
      if ('$exists' in f) return f.$exists ? (k in doc) : !(k in doc);
      if ('$in' in f) return f.$in.some((v: unknown) => String(v) === String(doc[k]));
    }
    return doc[k] === f;
  });
}

let seq = 0;
function makeCollection() {
  const docs: Doc[] = [];
  return {
    docs,
    async findOne(filter: Doc) { const d = docs.find(x => matches(x, filter)); return d ? clone(d) : null; },
    async insertOne(doc: Doc) {
      if (doc._id === undefined) doc = Object.assign({ _id: 'h' + (++seq), _seq: seq }, doc);
      else if (docs.some(x => x._id === doc._id)) { const e: any = new Error('dup'); e.code = 11000; throw e; }
      docs.push(clone(doc)); return { insertedId: doc._id };
    },
    async updateOne(filter: Doc, upd: Doc) {
      const d = docs.find(x => matches(x, filter));
      if (!d) return { matchedCount: 0 };
      Object.assign(d, clone(upd.$set)); return { matchedCount: 1 };
    },
    find(filter: Doc) {
      let res = docs.filter(x => matches(x, filter));
      const cur = {
        sort() { res = res.slice().sort((a, b) => (b._seq || 0) - (a._seq || 0)); return cur; },
        skip(n: number) { res = res.slice(n); return cur; },
        project() { return cur; },
        async toArray() { return clone(res); }
      };
      return cur;
    },
    async deleteMany(filter: Doc) { let n = 0; for (let i = docs.length - 1; i >= 0; i--) { if (matches(docs[i], filter)) { docs.splice(i, 1); n++; } } return { deletedCount: n }; }
  };
}

const collections: Record<string, ReturnType<typeof makeCollection>> = {};
const fakeDb = { collection(name: string) { return collections[name] || (collections[name] = makeCollection()); } };

const Module = require('module');
const origLoad = Module._load;
Module._load = function (req: string, ...rest: unknown[]) {
  if (req === 'mongodb') return { MongoClient: class { async connect() { /* nada */ } db() { return fakeDb; } get topology() { return { isConnected: () => true }; } } };
  return origLoad.apply(this, [req, ...rest]);
};
process.env.MONGODB_URI = 'mongodb://fake';
process.env.APP_SECRET = 'clave-leo';
process.env.APP_SECRET_TIZIBIZI = 'clave-tizi';
const handler = require(path.resolve(__dirname, '../../api/state.js'));

export const stateCol = fakeDb.collection('state');
export const historyCol = fakeDb.collection('state_history');

export async function callApi(method: string, headers: Record<string, string>, body?: unknown) {
  let status = 200; let payload: any = null;
  const res: any = { status(c: number) { status = c; return res; }, json(b: unknown) { payload = b; return res; }, setHeader() { /* nada */ } };
  await handler({ method, headers, body, query: {} }, res);
  return { status, body: payload };
}

export function seed(user: 'leo' | 'tizi', value: unknown, version?: number) {
  stateCol.docs.length = 0; historyCol.docs.length = 0;
  const doc: Doc = { _id: user === 'tizi' ? 'state-tizi' : 'app-state', value: JSON.stringify(value) };
  if (version !== undefined) doc.version = version;
  stateCol.docs.push(doc);
}
export function dbDoc(user: 'leo' | 'tizi' = 'leo') { return stateCol.docs.find(d => d._id === (user === 'tizi' ? 'state-tizi' : 'app-state')) as Doc; }
export function dbState(user: 'leo' | 'tizi' = 'leo') { return JSON.parse(dbDoc(user).value); }

/* fetch del navegador conectado al handler real. */
export const server = { failGet: false, failQuotes: false, puts: 0, quoteCalls: 0 };
export async function fakeFetch(url: string, opts: RequestInit = {}) {
  const method = opts.method || 'GET';
  if (url.indexOf('/api/quote') === 0) {
    server.quoteCalls++;
    if (server.failQuotes) return { ok: false, status: 500, json: async () => ({ error: 'x' }) };
    return { ok: true, status: 200, json: async () => ({ quotes: {} }) };
  }
  if (server.failGet && method === 'GET') return { ok: false, status: 500, json: async () => ({}) };
  if (method === 'PUT') server.puts++;
  const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
  const r = await callApi(method, (opts.headers || {}) as Record<string, string>, body);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
}
