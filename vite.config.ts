import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {Server as SocketIOServer} from 'socket.io';
import {createRpcServerAuto, listen, Observe, Peer, Replay} from 'wenay-common2';

/* Real Socket.IO/RPC source for the reconnect QA card. This deliberately lives in
 * the Vite-only stand: React receives the normal common2 RPC remote and does not
 * know about the socket or its reconnect lifecycle. */
const [emitQaReplay, qaReplay] = Replay.replayListen<[number]>({history: 20_000});
let qaReplayProduced = 0;
let qaReplayTimer: ReturnType<typeof setInterval> | null = null;
const qaReplayEmit = (count = 1) => {
  for (let i = 0; i < count; i++) emitQaReplay(++qaReplayProduced);
  return qaReplayProduced;
};
const qaReplayStats = () => ({
  produced: qaReplayProduced,
  head: qaReplay.head(),
  // RPC Replay uses the envelope `line` surface, not the legacy payload `on` surface.
  listeners: qaReplay.line.count(),
  producing: qaReplayTimer != null,
});
const qaReplayApi = {
  events: qaReplay,
  start: () => {
    if (!qaReplayTimer) qaReplayTimer = setInterval(() => qaReplayEmit(), 50);
    return qaReplayStats();
  },
  stop: () => {
    if (qaReplayTimer) clearInterval(qaReplayTimer);
    qaReplayTimer = null;
    return qaReplayStats();
  },
  burst: (count: number) => qaReplayEmit(Math.max(0, Math.min(10_000, Math.floor(count)))),
  stats: qaReplayStats,
};

type VideoRoomMember = {
  id: string;
  name: string;
  joinedAt: number;
  host: boolean;
  canSpeak: boolean;
  camera: boolean;
  microphone: boolean;
  screen: boolean;
};

type VideoRoomMessage = {id: string; authorId: string; author: string; text: string; sentAt: number};
type VideoRoom = {
  id: string;
  title: string;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
  members: Map<string, VideoRoomMember>;
  messages: VideoRoomMessage[];
};

const videoRooms = new Map<string, VideoRoom>();
const videoAccountRooms = new Map<string, Set<string>>();
const videoAccountConnections = new Map<string, number>();
const videoAccountCleanup = new Map<string, ReturnType<typeof setTimeout>>();
const [emitVideoRoomsChanged, videoRoomsChanged] = listen<[{roomId: string; revision: number; closed?: boolean}]>();

const cleanVideoText = (value: unknown, fallback: string, max: number) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return text || fallback;
};
const publicVideoRoom = (room: VideoRoom) => ({
  id: room.id,
  title: room.title,
  hostId: room.hostId,
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
  revision: room.revision,
  participants: [...room.members.values()].sort((a, b) => Number(b.host) - Number(a.host) || a.joinedAt - b.joinedAt),
  messages: room.messages.slice(-100),
});
const videoRoomId = () => {
  let id = '';
  do id = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
  while (videoRooms.has(id));
  return id;
};
const touchVideoRoom = (room: VideoRoom) => {
  room.revision += 1;
  room.updatedAt = Date.now();
  emitVideoRoomsChanged({roomId: room.id, revision: room.revision});
  return publicVideoRoom(room);
};
const rememberVideoMembership = (account: string, roomId: string) => {
  const rooms = videoAccountRooms.get(account) ?? new Set<string>();
  rooms.add(roomId);
  videoAccountRooms.set(account, rooms);
};
const forgetVideoMembership = (account: string, roomId: string) => {
  const rooms = videoAccountRooms.get(account);
  rooms?.delete(roomId);
  if (!rooms?.size) videoAccountRooms.delete(account);
};
const videoAccountsShareRoom = (watcher: string, owner: string) => {
  const rooms = videoAccountRooms.get(watcher);
  if (!rooms) return false;
  for (const roomId of rooms) if (videoRooms.get(roomId)?.members.has(owner)) return true;
  return false;
};

const videoPeerHost = Peer.createPeerHost({accounts: account => /^seat-[a-z0-9-]{8,80}$/i.test(account)});
const videoMediaRelay = Peer.createMediaRelay({
  lines: {camera: 'video', microphone: 'audio', screen: 'video'},
  videoHistory: 8,
  audioHistory: 64,
  canWatch: (watcher, owner) => watcher !== owner && videoAccountsShareRoom(watcher, owner),
});

function videoRoomApi(account: string) {
  const requireRoom = (roomId: unknown) => {
    const id = String(roomId ?? '');
    const room = videoRooms.get(id);
    if (!room) throw new Error('Комната не найдена или уже завершена');
    return room;
  };
  const requireMember = (room: VideoRoom) => {
    const member = room.members.get(account);
    if (!member) throw new Error('Сначала присоединитесь к комнате');
    return member;
  };
  return {
    changed: videoRoomsChanged,
    create(input: {title?: string; name?: string} = {}) {
      const now = Date.now();
      const room: VideoRoom = {
        id: videoRoomId(),
        title: cleanVideoText(input.title, 'Новая встреча', 80),
        hostId: account,
        createdAt: now,
        updatedAt: now,
        revision: 0,
        members: new Map(),
        messages: [],
      };
      room.members.set(account, {id: account, name: cleanVideoText(input.name, 'Организатор', 48), joinedAt: now, host: true, canSpeak: true, camera: false, microphone: false, screen: false});
      videoRooms.set(room.id, room);
      rememberVideoMembership(account, room.id);
      return touchVideoRoom(room);
    },
    get(roomId: string) {
      const room = videoRooms.get(String(roomId ?? ''));
      return room ? publicVideoRoom(room) : null;
    },
    join(roomId: string, name: string) {
      const room = requireRoom(roomId);
      const previous = room.members.get(account);
      room.members.set(account, {
        id: account,
        name: cleanVideoText(name, previous?.name ?? 'Участник', 48),
        joinedAt: previous?.joinedAt ?? Date.now(),
        host: account === room.hostId,
        canSpeak: previous?.canSpeak ?? true,
        camera: previous?.camera ?? false,
        microphone: previous?.microphone ?? false,
        screen: previous?.screen ?? false,
      });
      rememberVideoMembership(account, room.id);
      return touchVideoRoom(room);
    },
    leave(roomId: string) {
      const room = requireRoom(roomId);
      if (room.members.delete(account)) {
        forgetVideoMembership(account, room.id);
        try { videoMediaRelay.dropAccount(account); } catch { /* already retired */ }
        touchVideoRoom(room);
      }
      return true;
    },
    close(roomId: string) {
      const room = requireRoom(roomId);
      if (room.hostId !== account) throw new Error('Только организатор может завершить встречу');
      videoRooms.delete(room.id);
      for (const participant of room.members.values()) {
        forgetVideoMembership(participant.id, room.id);
        try { videoMediaRelay.dropAccount(participant.id); } catch { /* already retired */ }
      }
      emitVideoRoomsChanged({roomId: room.id, revision: room.revision + 1, closed: true});
      return true;
    },
    sendMessage(roomId: string, text: string) {
      const room = requireRoom(roomId);
      const member = requireMember(room);
      const message: VideoRoomMessage = {id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, authorId: account, author: member.name, text: cleanVideoText(text, '', 600), sentAt: Date.now()};
      if (!message.text) return publicVideoRoom(room);
      room.messages.push(message);
      if (room.messages.length > 100) room.messages.splice(0, room.messages.length - 100);
      return touchVideoRoom(room);
    },
    setSpeak(roomId: string, participantId: string, allowed: boolean) {
      const room = requireRoom(roomId);
      if (room.hostId !== account) throw new Error('Только организатор управляет правом голоса');
      const participant = room.members.get(String(participantId));
      if (!participant || participant.host) return publicVideoRoom(room);
      participant.canSpeak = Boolean(allowed);
      if (!participant.canSpeak) participant.microphone = false;
      return touchVideoRoom(room);
    },
    setMedia(roomId: string, patch: {camera?: boolean; microphone?: boolean; screen?: boolean}) {
      const room = requireRoom(roomId);
      const member = requireMember(room);
      if (patch.camera !== undefined) member.camera = Boolean(patch.camera);
      if (patch.microphone !== undefined) member.microphone = member.canSpeak && Boolean(patch.microphone);
      if (patch.screen !== undefined) {
        if (patch.screen) for (const participant of room.members.values()) participant.screen = false;
        member.screen = Boolean(patch.screen);
      }
      return touchVideoRoom(room);
    },
  };
}

function removeVideoAccount(account: string) {
  for (const roomId of [...(videoAccountRooms.get(account) ?? [])]) {
    const room = videoRooms.get(roomId);
    if (!room?.members.delete(account)) continue;
    forgetVideoMembership(account, roomId);
    touchVideoRoom(room);
  }
  try { videoMediaRelay.dropAccount(account); } catch { /* already retired */ }
}

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
        const io = new SocketIOServer(server.httpServer, {path: '/__qa/replay-rpc', cors: {origin: true}});
        const videoIo = new SocketIOServer(server.httpServer, {path: '/__video-call-rpc', cors: {origin: true}, maxHttpBufferSize: 1e7});
        io.on('connection', socket => {
          const [disconnect, disconnectListen] = listen();
          socket.on('disconnect', disconnect);
          createRpcServerAuto({
            socket: {emit: (key, data) => socket.emit(key, data), on: (key, cb) => socket.on(key, cb)},
            socketKey: 'qaReplay',
            object: qaReplayApi,
            disconnectListen,
          });
        });
        videoIo.on('connection', socket => {
          const supplied = String(socket.handshake.auth?.account ?? '');
          const account = /^seat-[a-z0-9-]{8,80}$/i.test(supplied) ? supplied : `seat-${Math.random().toString(36).slice(2, 14)}`;
          const cleanupTimer = videoAccountCleanup.get(account);
          if (cleanupTimer) clearTimeout(cleanupTimer);
          videoAccountCleanup.delete(account);
          videoAccountConnections.set(account, (videoAccountConnections.get(account) ?? 0) + 1);

          const peer = videoPeerHost.connection(account);
          const publish = videoMediaRelay.publishOf(account);
          const [disconnect, disconnectListen] = listen();
          socket.on('disconnect', () => {
            disconnect();
            peer.close();
            const left = Math.max(0, (videoAccountConnections.get(account) ?? 1) - 1);
            if (left) videoAccountConnections.set(account, left);
            else {
              videoAccountConnections.delete(account);
              const timer = setTimeout(() => {
                videoAccountCleanup.delete(account);
                if (!videoAccountConnections.has(account)) removeVideoAccount(account);
              }, 15_000);
              timer.unref?.();
              videoAccountCleanup.set(account, timer);
            }
          });
          createRpcServerAuto({
            socket: {emit: (key, data) => socket.emit(key, data), on: (key, cb) => socket.on(key, cb)},
            socketKey: 'videoCall',
            object: {
              peer: peer.fragment,
              rooms: videoRoomApi(account),
              media: {
                publish(line: 'camera' | 'microphone' | 'screen', frame: Uint8Array, sentAt?: number) {
                  const member = [...(videoAccountRooms.get(account) ?? [])]
                    .map(roomId => videoRooms.get(roomId)?.members.get(account))
                    .find(Boolean);
                  if (!member || (line === 'microphone' && !member.canSpeak)) return false;
                  return publish(line, frame, sentAt ?? Date.now());
                },
                watch: videoMediaRelay.watchOf(account),
              },
            },
            disconnectListen,
          });
        });
        server.httpServer?.once('close', () => {
          io.close();
          videoIo.close();
          videoPeerHost.close();
          videoMediaRelay.close();
        });
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
