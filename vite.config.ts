import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Observe } from 'wenay-common2';

type QaObserveState = {
  value: number;
  nested: { label: string };
  updatedAt: string;
  events: number;
  bag: Record<string, number>;
  deep: {
    level1: {
      level2: {
        leaf: string;
        counters: Record<string, number>;
      };
    };
  };
};

const createQaObserveInitial = (): QaObserveState => ({
  value: 1,
  nested: { label: 'server initial' },
  updatedAt: new Date().toISOString(),
  events: 0,
  bag: { a: 1, b: 2 },
  deep: {
    level1: {
      level2: {
        leaf: 'server deep initial',
        counters: { x: 10, y: 20 },
      },
    },
  },
});

const qaObserveStore = Observe.createStore<QaObserveState>(createQaObserveInitial());
const qaObserveApi = Observe.exposeStore(qaObserveStore);
const qaObserveClients = new Set<ServerResponse>();
const qaObservePathClients = new Set<ServerResponse>();

function sendQaObserveChanged() {
  const data = JSON.stringify({ time: Date.now() });
  for (const res of [...qaObserveClients]) {
    try {
      res.write(`event: changed\ndata: ${data}\n\n`);
    } catch {
      qaObserveClients.delete(res);
    }
  }
}

qaObserveApi.changed.on(sendQaObserveChanged);

function sendQaObservePathChanged(change: { paths: PropertyKey[][] }) {
  const data = JSON.stringify(change);
  for (const res of [...qaObservePathClients]) {
    try {
      res.write(`event: changedPaths\ndata: ${data}\n\n`);
    } catch {
      qaObservePathClients.delete(res);
    }
  }
}

qaObserveApi.changedPaths.on(sendQaObservePathChanged);

function readJsonBody(req: IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function mutateQaObserveState(action: any) {
  if (action?.type == 'reset') {
    qaObserveStore.replace(createQaObserveInitial());
    return;
  }

  qaObserveStore.state.updatedAt = new Date().toISOString();
  qaObserveStore.state.events += 1;

  if (action?.type == 'label') {
    qaObserveStore.state.nested.label = String(action.label ?? 'server label');
  } else if (action?.type == 'set') {
    qaObserveStore.state.value = Number(action.value ?? qaObserveStore.state.value);
  } else if (action?.type == 'bag-add') {
    qaObserveStore.state.bag[String(action.key ?? 'c')] = Number(action.value ?? Date.now());
  } else if (action?.type == 'bag-delete') {
    delete qaObserveStore.state.bag[String(action.key ?? 'b')];
  } else if (action?.type == 'deep-leaf') {
    qaObserveStore.state.deep.level1.level2.leaf = String(action.value ?? `deep ${Date.now()}`);
  } else if (action?.type == 'deep-add') {
    qaObserveStore.state.deep.level1.level2.counters[String(action.key ?? 'z')] = Number(action.value ?? Date.now());
  } else if (action?.type == 'deep-delete') {
    delete qaObserveStore.state.deep.level1.level2.counters[String(action.key ?? 'y')];
  } else {
    qaObserveStore.state.value += 1;
  }
}

async function handleQaObserve(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url) return next();
  const url = new URL(req.url, 'http://qa.local');
  if (!url.pathname.startsWith('/__qa/observe-store')) return next();

  if (url.pathname == '/__qa/observe-store/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    qaObserveClients.add(res);
    res.write(`event: ready\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    req.on('close', () => qaObserveClients.delete(res));
    return;
  }

  if (url.pathname == '/__qa/observe-store/events-paths') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    qaObservePathClients.add(res);
    res.write(`event: ready\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    req.on('close', () => qaObservePathClients.delete(res));
    return;
  }

  if (url.pathname == '/__qa/observe-store/get' && req.method == 'GET') {
    const maskRaw = url.searchParams.get('mask');
    const mask = maskRaw ? JSON.parse(maskRaw) : undefined;
    sendJson(res, 200, qaObserveApi.get(mask));
    return;
  }

  if (url.pathname == '/__qa/observe-store/mutate' && req.method == 'POST') {
    const body = await readJsonBody(req);
    mutateQaObserveState(body);
    await Observe.flushReactive(qaObserveStore.state);
    sendJson(res, 200, qaObserveApi.get());
    return;
  }

  sendJson(res, 404, { error: 'unknown qa observe endpoint' });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'qa-observe-store-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          handleQaObserve(req, res, next).catch(error => {
            console.error(error);
            sendJson(res, 500, { error: String(error?.message ?? error) });
          });
        });
      },
    },
  ],
  resolve: {
    alias: {
      // Polyfill for the Node.js path module that was used in Webpack.
      'path': 'path-browserify',
    },
  },
  server: {
    host: true,
    port: 3010,
    open: true,
    watch: {
      // lib/ is the tsc build output (incl. a copied tsconfig.json); watching it
      // caused a chronic "changed tsconfig file detected" full-reload loop
      ignored: ['**/lib/**', '**/dist/**'],
    },
  },
});
