# wenay-common2 1.0.75 — adoption audit (ultracode, 2026-07-13)

Аудит рабочей копии после бампа 1.0.74 → 1.0.75 (RPC/Replay reconnect contract): 4 параллельных аудитора
(новая карточка 47 / хуки useReplay / старые стенды / тест+доки), каждая находка прошла адверсариальную
верификацию отдельным агентом по реальному коду `node_modules/wenay-common2`. Итог: 26 подтверждено, 0 ложных.

## Что уже сделано в рабочей копии (некоммичено)

- Бамп `wenay-common2` до `^1.0.75`, фикс `useReplaySubscribe` (флаг `failed`: `off.ready` в 1.0.75 резолвится
  даже при терминальном `onError`, гонка ready=true закрыта), карточка 47 `ReplayRpcReconnectDemo`,
  Socket.IO QA-эндпоинт `/__qa/replay-rpc` в vite.config.ts, тест `__test/useReplayRpcReconnect.test.tsx`, доки.
- Проверено сейчас: tsc qa-check чистый; jest 26 suites / 91 tests зелёные (reconnect-suite 4/4).

## Подтверждено корректным (менять не надо)

- Ядро карточки 47: `hub.setToken(null)` — легитимный первичный connect (первый вызов не рвёт поколение);
  `io({reconnection: false})` + ручные `socket.disconnect()/connect()` — настоящий транзиентный reconnect
  для хаба; `connectListen/disconnectListen` без утечек под StrictMode; серверная обвязка в vite.config
  (SocketTmpl-адаптер, `replay: 'auto'`, `line.count()`, один io на httpServer) корректна.
- Старые стенды НЕ содержат устаревших restart/remount-обходов: remount-via-since (карточка 23),
  remount client (33), restart (24) — легитимные API-паттерны и при 1.0.75 (авто-восстановление покрывает
  только transient reconnect живой подписки). Single-slot `onConnect/onDisconnect` нигде не используется.
- Хуки не сбрасывают состояние при транзиентном reconnect (эффекты завязаны на identity remote — она
  в 1.0.75 стабильна); stale-логика контракту не противоречит; useReplayHistory не затронут.
- Карточка 25 — эталон, не затрагивалась.

## Баги (код хуков)

1. **`useStoreReplaySync` без `failed`-фикса** (`src/common/src/hooks/useReplay.ts:389`; наследуют
   `useStoreReplayMirror`/`useStoreReplayEach`, карточки 24/33). `off.ready` у `syncStoreReplay` РЕЗОЛВИТСЯ
   при терминальном `onError` (settleReady внутри closeSubscription) → `ready=true` на мёртвой подписке.
   Фикс: `failed`-флаг + `if (!alive || failed) return` в `ready.then` **и** `setReady(false)` в `onError`
   (иначе ошибка после уже наступившего ready оставляет true). На in-proc карточках 24/33 почти
   не воспроизводится (keyframe всегда есть), но хуки публичные и принимают RPC-remote.
2. **Route-хуки после post-ready смерти линии оставляют `ready=true`** (`useReplay.ts:268` —
   `useReplayRouteSubscribe`, `:464` — `useStoreReplayRouteSync`): `onError` делает только `setError`,
   React-состояние `ready=true`/`phase=='ready'` при `active()==false`. Геттер `active()` снаружи честен
   (subRef), рассинхронизировано именно React-state. Поведение библиотеки не ново (с 1.0.67).

## Карточка 47 — недоделки QA-стенда

3. **Индикатор «stable remote» тавтологичен** (`replayVideo.tsx:444`): сравниваются два присваивания
   одного объекта при первом setToken; `hub.facade.qaReplay.func.events` после reconnect не перечитывается —
   главная новая гарантия 1.0.75 (identity прокси через reconnect) карточкой НЕ проверяется.
   Фикс: в `connectListen` перечитывать `func.events` и сравнивать с `firstRemote`.
4. **«mount consumer» после unmount необратимо ломает PASS** (`replayVideo.tsx:479`): фиксированный
   `since: 0` + заглушка `onSeq: () => {}` → повторный маунт заливает всю историю в append-only метрики
   (duplicates>0, ordered=false, reset нет). Фикс: remount-via-since (паттерн карточки 23 и doc-комментария
   useReplay.ts:24-25) либо сброс metrics при mount.
5. **do-текст «wait until it is green» невыполним** (`qa.tsx:1667` + `replayVideo.tsx:469` «wait for
   delivery»): авто-refresh нет, снапшот обновляется только по кликам/connect-событиям. Фикс: текст
   «press refresh metrics until green» либо периодический refresh.
6. minor: счётчик errors append-only и смешивает три источника (офлайн-отказы обычных RPC из `run()` —
   контрактное поведение 1.0.75, терминальный onError подписки, провал setToken) — случайный клик
   start/stop/burst офлайн навсегда красит карточку; нужен reset или разделение источников
   (`replayVideo.tsx:462`).
7. minor: офлайн-ветка `refresh()` обнуляет серверные числа (`produced 0 · seq N/-1`) вместо last-known
   со stale-пометкой; требование `listeners == 1` ломается вторым открытым табом QA-борда — нигде
   не оговорено (`replayVideo.tsx:419`).
8. minor: `vite.config.ts:213` — close-хук не делает `clearInterval(qaReplayTimer)`: при рестарте конфига
   запущенный продюсер утекает (вечный 50мс-тик + удержание осиротевшей линии на каждое поколение).
9. minor: qaReplay — sacred-линия (нет current/keyframe) с history 20000: после >20000 событий свежий
   маунт с since:0 получает терминальный onError; рестарт dev-сервера при живом клиенте → seq>head →
   терминальная ошибка после reconnect. Оба поведения контрактно правильные, но note карточки 47
   их не оговаривает — QA увидит необъяснимый красный (`vite.config.ts:10`).

## Гэпы адаптации хуков

10. **`useReplayFrame`** (`useReplay.ts:691`): любая ошибка pull терминальна (clearInterval до ручного
    `restart()`) — транзиентный блип останавливает опрос навсегда, хотя identity remote теперь стабильна
    и есть `connectListen`/lifecycle для re-arm. Не различает sacred eviction и transient disconnect.
    JSDoc подаёт как by-design — позиция 1.0.74-эпохи.
11. **`useStoreMirror`** (`useObserveStore.ts:263`): неудачный `sync()` при disconnect терминален,
    reconnect-ресинка нет. Хук намеренно транспорт-агностичен — минимум: задокументировать внешний
    паттерн `hub.connectListen(() => controller.sync())` и/или опциональный параметр.
12. doc: JSDoc хуков не фиксирует контракт 1.0.75 — терминальность `onError` и то, что transport
    reconnect common2 восстанавливает сам (шапка useReplay.ts:15-36 неполна аддитивно; `onError` на :52
    и `error` на :81 вовсе без JSDoc).
13. minor: мёртвые rejection-ветки `off.ready.then(..., e => ...)` в `useReplaySubscribe` (:162) и
    `useStoreReplaySync` (:395) — ready в 1.0.75 никогда не реджектится (у route-хуков ветка рабочая).

## Гэпы теста `__test/useReplayRpcReconnect.test.tsx`

Тест честный (реальный Socket.IO, без моков), но не покрывает на уровне React-обёртки:
14. hard teardown: живая подписка → `dispose()`/`setToken()` → подписка не воскресает через effect (:72);
15. стабильная identity прокси: `expect(clients.replay.func.ticks).toBe(remote)` после reconnect —
    сейчас проверяется только физический сокет; assert нужен внутри fixture.reconnect, где clients
    в замыкании (:50);
16. eviction внутри офлайн-дыры: доставка до seq N → disconnect → эмит сверх маленького history →
    reconnect → терминальная ошибка (ready true→false), без ложного продолжения (:225 покрывает только
    initial subscribe);
17. «unsubscribing offline prevents resurrection»: disconnect → unmount → reconnect → consumers==0 (:158);
18. multi-consumer dedup recovery (два хука на одном remote → serverConsumers()==1, оба точны после
    reconnect) и 2-3 повторных reconnect-поколения (:117).

## Доки

19. Шапка `replayVideo.tsx:3` «Everything is in-proc» устарела — карточка 47 в этом же файле на реальном
    Socket.IO (docstring самой карточки корректен; поправить только охват шапки: in-proc — карточки 40-46).
20. `doc/wenay-react2-rare.md:558` — осиротевшая строка `**Identity matrix**` без содержимого (обрубок).
21. `doc/changes/v1.0.50.md:5` — Changed замалчивает фикс `useReplaySubscribe` (критично), карточку 47 и
    QA-эндпоинт (упомянуты лишь косвенно в Verification).
22. Карточка 47 не добавлена в списки live-примеров (`doc/wenay-react2.md:481` «cards 23…26»,
    `doc/wenay-react2-rare.md:577`).
23. `doc/EXAMPLE_USAGE.md:819` — retention журнала ошибочно приписан policy `queue` (retention задаёт
    продюсер `replayListen({history})`; `queue` — только «wire-подписка ничего не пропускает при лаге»).
24. minor: лишняя вторая пустая строка после `## Replay Feed Into A Grid` (`doc/EXAMPLE_USAGE.md:834`).
25. gap стенда: терминальный sacred-onError + восстановление явным `restart(since)` не демонстрируется
    ни одной интерактивной карточкой (автотест покрывает только терминальность на initial subscribe);
    все линии стендов имеют keyframe/history с запасом (`replayVideo.tsx:32`).

## Порядок работ (предложение)

1. Баги хуков (№1-2) — фикс + симметричные тесты (по образцу eviction-теста 4).
2. Карточка 47 до честного PASS (№3-9: stable remote, mount consumer, do-текст; minor — по ходу).
3. Тестовые гэпы (№14-18) — один batch в reconnect-suite.
4. Доки (№19-24) одним доко-проходом; №10-12 (useReplayFrame re-arm, mirror resync, JSDoc) — отдельный
   осознанный pass, №25 (sacred-карточка) — опционально после него.

Verify каждого шага: tsc qa-check, jest, build, стенд 3010 (карточки 23/24/33/47).
