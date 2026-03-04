# ART SAFE PLACE: Методичка по проекту

Этот документ описывает текущее состояние проекта на уровне кода: что уже реализовано, как проходит запрос через систему и в каком порядке изучать репозиторий.

## 1. Что это за приложение

`ART SAFE PLACE` это MVP для артиста с шестью основными зонами:
- `HOME (/today)` для PATH-стадии, daily check-in, weekly rhythm, микро-шага и onboarding-чеклиста.
- `FIND (/find)` для каталога специалистов и встроенных заявок.
- `SONGS (/songs)` для workspace с папками, проектами, треками, версиями и релизной логикой.
- `LEARN (/learn)` для каталога обучающих материалов.
- `AI ASSIST (/assistant)` для AI-навигации и AI-support, если фича включена флагом.
- `ID (/id)` для SAFE ID, ссылок и настроек профиля.

Главный пользовательский сценарий сейчас выглядит так:
1. Пользователь логинится.
2. Попадает на `/today` и видит текущую PATH-стадию.
3. Создаёт трек или проект в `/songs`.
4. Загружает аудио-версию, демо или релиз.
5. Находит специалиста в `/find` и при необходимости отправляет заявку.
6. Заполняет профиль в `/id`.
7. При включённом AI может получить рекомендации и поддержку в `/assistant`.

## 2. Технологический стек

- Frontend: `Next.js 14 (App Router)`, `React 18`, `TypeScript`.
- UI: `TailwindCSS`, локальные UI-компоненты в `src/components/ui`.
- Data fetching: `@tanstack/react-query`.
- Auth: `next-auth` с `CredentialsProvider`.
- Backend: route handlers в `src/app/api`.
- ORM/DB: `Prisma` + `PostgreSQL`.
- Валидация API: `zod`.
- Хранение аудио: локально через `src/lib/storage.ts`.
- AI-слой: runtime-конфиг в `src/lib/ai/config.ts`, провайдеры и сервисы в `src/lib/ai/*`.

## 3. Карта репозитория

Ключевые директории:
- `src/app` страницы и API routes.
- `src/components` layout, UI и feature-компоненты.
- `src/lib` инфраструктура, сервисы, клиентские хелперы и доменная логика.
- `src/contracts` схемы AI и связанных контрактов.
- `prisma` схема БД, миграции, seed и тестовые профили для FIND.
- `docs` проектная документация.
- `scripts` служебные скрипты.
- `uploads` локальное файловое хранилище.

Критичные файлы:
- `prisma/schema.prisma` полная доменная модель.
- `prisma/seed.ts` стартовые данные для локальной среды.
- `src/lib/auth.ts` конфигурация NextAuth.
- `src/lib/server-auth.ts` серверная авторизация через `requireUser()`.
- `src/lib/api.ts` единая обвязка API, ошибки и валидация.
- `src/components/layout/app-shell.tsx` общая оболочка и навигация.
- `middleware.ts` защита части приватных маршрутов.

Примечание по неймингу:
- Брендовое имя продукта: `ART SAFE PLACE`.
- Имя пакета и репозитория: `artsafehubapp`.

## 4. Как приложение запускается

1. Корневой `/` редиректит на `/today`.
2. `src/app/layout.tsx` подключает `Providers` и `AppShell`.
3. `src/app/providers.tsx` поднимает `SessionProvider`, `QueryClientProvider` и проектные провайдеры.
4. `middleware.ts` защищает `/today`, `/find`, `/songs`, `/assistant`, `/id`.
5. `/learn` защищён не middleware, а серверной проверкой роли внутри страницы.
6. Логин проходит через `src/app/signin/page.tsx` и `src/app/api/auth/[...nextauth]/route.ts`.

## 5. Поток запроса: от UI до базы

Типовой поток выглядит так:
1. Клиентский экран вызывает `apiFetch` или `apiFetchJson` из `src/lib/client-fetch.ts`.
2. Запрос приходит в route handler внутри `src/app/api/...`.
3. Handler обычно обёрнут в `withApiHandler(...)`.
4. Внутри вызывается `requireUser()` из `src/lib/server-auth.ts`.
5. После авторизации handler валидирует body/query и работает с `prisma`.
6. JSON-ответ возвращается в UI.
7. React Query обновляет кэш и синхронизирует экран.

Если сессии нет:
- API возвращает `401`.
- Клиентский fetch-helper переводит пользователя на `/signin`.

## 6. Авторизация и роли

Текущее состояние auth:
- Сессия основана на `JWT`.
- Провайдер только `Credentials`.
- Проверка пароля идёт через `bcrypt.compare`.
- В JWT и session пробрасываются `id` и `role`.

Роли в системе:
- `ARTIST`
- `SPECIALIST`
- `STUDIO`
- `ADMIN`

Важно:
- Большая часть продукта ориентирована на `ARTIST`.
- `/learn` дополнительно ограничен только артистами.
- В `FIND` и заявках участвуют также пользователи со specialist/studio-профилем.

## 7. PATH-стадии

В проекте сейчас канонически используется 7 PATH-стадий, а не 9:
1. `Искра`
2. `Формирование`
3. `Выход в свет`
4. `Прорыв`
5. `Признание`
6. `Широкая известность`
7. `Наследие`

Нормализация лежит в `src/lib/path-stages.ts`:
- новые названия берутся по `order`;
- старые названия вроде `Идея`, `Демо`, `Продакшн`, `Релиз` мапятся в канонические.

Это важно, потому что часть старой логики и части документации ещё могут ссылаться на legacy-названия.

## 8. Доменные сущности БД

Основные модели:
- `User` профиль, SAFE ID, роль, ссылки, настройки, текущая PATH-стадия.
- `SpecialistProfile` FIND-профиль специалиста или студии.
- `Folder` иерархия папок в песенном workspace.
- `Project` музыкальный проект или релизная сущность.
- `Track` трек внутри workspace или проекта.
- `Demo` аудио-версии, включая `IDEA_TEXT`, `DEMO`, `ARRANGEMENT`, `NO_MIX`, `MIXED`, `MASTERED`, `RELEASE`.
- `TrackDistributionRequest` данные на дистрибуцию релиза.
- `PathStage` стадии пути.
- `DailyCheckIn`, `DailyMicroStep`, `WeeklyActivity` данные HOME.
- `InAppRequest`, `InAppRequestAction` встроенные заявки между артистом и специалистом.
- `UserOnboardingState` состояние скрытия onboarding-чеклиста.

Ключевые связи:
- `User -> Folder[]`
- `User -> Project[]`
- `User -> Track[]`
- `Folder -> Folder[]` через self-relation
- `Folder -> Project[]`
- `Folder -> Track[]`
- `Project -> Track[]`
- `Track -> Demo[]`
- `Track -> TrackDistributionRequest?`
- `Track -> InAppRequest[]`
- `User -> InAppRequest[]` в двух ролях: артист и специалист

## 9. Страницы и их API

### `/today`

UI:
- PATH-карточка
- daily check-in
- микро-шаг
- onboarding-чеклист
- weekly activity

API:
- `GET /api/home/overview`
- `PUT /api/home/check-in`
- `POST /api/home/micro-step`
- `PATCH /api/home/micro-step`
- `PATCH /api/home/onboarding`

### `/find`

UI:
- каталог специалистов
- фильтры по услуге, городу и доступности
- модалки отправки трека и бронирования
- отдельная вкладка заявок

API:
- `GET /api/hub/specialists`
- `GET /api/requests`
- `POST /api/requests`
- `PATCH /api/requests/:id/action`
- косвенно использует `GET /api/songs` и `GET /api/songs/:id` для выбора трека и версии

### `/songs`

Это уже не просто список треков, а workspace:
- папки с вложенностью;
- проекты;
- треки;
- релизный архив;
- быстрый сценарий создания новой песни;
- загрузка и проигрывание версий.

Основные API:
- `GET /api/songs`
- `POST /api/songs`
- `GET /api/songs/stages`
- `GET /api/songs/:id`
- `PATCH /api/songs/:id`
- `DELETE /api/songs/:id`
- `POST /api/songs/:id/distribution-request`
- `POST /api/songs/:id/demos/reorder`
- `GET /api/folders`
- `POST /api/folders`
- `PATCH /api/folders/:id`
- `DELETE /api/folders/:id`
- `POST /api/folders/:id/empty`
- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `POST /api/projects/:id/tracks/reorder`
- `GET /api/workspace/nodes`
- `POST /api/workspace/group`
- `POST /api/audio-clips`
- `PATCH /api/audio-clips/:id`
- `DELETE /api/audio-clips/:id`
- `GET /api/audio-clips/:id/stream`

Отдельные страницы внутри Songs:
- `/songs/[id]` карточка трека и версии.
- `/songs/projects/[id]` страница проекта.
- `/songs/folders/[id]` просмотр содержимого папки.
- `/songs/new/demo` упрощённый flow быстрого добавления.

### `/learn`

Это artist-only раздел с каталогом материалов.

API:
- `GET /api/learn/materials`
- `GET /api/learn/materials/:slug`

Важно:
- источник сейчас локальный и моковый: `src/lib/learn/mock-materials.ts`;
- `repository.ts` только фильтрует и сортирует этот набор.

### `/assistant`

Состояние зависит от env-флага `AI_ASSIST_ENABLED` и клиентского `NEXT_PUBLIC_AI_ASSIST_ENABLED`.

Если AI выключен:
- UI показывает заглушку.

Если AI включён:
- доступны блоки `AI Navigation` и `AI Support`.

API:
- `POST /api/ai/navigation/suggest`
- `POST /api/ai/support/respond`

### `/id`

UI:
- SAFE ID
- данные профиля
- ссылки
- настройки уведомлений и приватности демо

API:
- `GET /api/id`
- `PATCH /api/id`

## 10. Слой API: общие правила

Почти все route handlers используют `withApiHandler` из `src/lib/api.ts`.

Что делает этот слой:
- приводит ошибки к единообразному JSON-ответу;
- поддерживает `ApiError` с явным HTTP-статусом;
- мапит часть Prisma-ошибок на `404` и `409`;
- возвращает `500` для непредвиденных сбоев.

Инструменты слоя:
- `parseJsonBody(request, schema)` для body + `zod`;
- `apiError(status, message)` для контролируемых ошибок;
- `requireUser()` для обязательной серверной авторизации.

## 11. Storage и аудио

Файл: `src/lib/storage.ts`.

Текущее состояние:
- локальный провайдер пишет в каталог `uploads/`;
- в БД хранится относительный `storageKey`;
- путь строится как `YYYY/MM/DD/uuid-filename`;
- MIME whitelist ограничен аудиоформатами;
- лимит файла сейчас `5 GB`, а не `25 MB`.

Важно по API загрузки:
- `POST /api/audio-clips` принимает `FormData`;
- обязательны `file`, `trackId`, `durationSec`;
- `versionType` поддерживает весь набор от `IDEA_TEXT` до `RELEASE`;
- для `RELEASE` обязательна дата релиза;
- при загрузке можно передавать и результаты автоанализа аудио.

Важно по чтению:
- `GET /api/audio-clips/:id/stream` поддерживает `Range`-запросы;
- файл читается из `uploads/<storageKey>`.

## 12. Seed-данные и локальная среда

`prisma/seed.ts` сейчас создаёт:
- 7 PATH-стадий;
- демо-артиста `demo@artsafehub.app / demo1234`;
- SAFE ID `SAFE-DEMO-001`;
- одну папку;
- один трек;
- две демо-версии;
- записи HOME: check-in, micro-step, weekly activity;
- тестовых специалистов из `prisma/test-find-profiles.ts`.

Текущее демо-состояние:
- пользователь стартует на PATH-стадии `Прорыв`;
- сам трек seeded на стадии `Формирование`.

Нюанс:
- сид очищает базовые таблицы и годится прежде всего для локальной разработки, а не для частичного дозаполнения данных.

## 13. UI и навигация

Основная оболочка находится в `src/components/layout/app-shell.tsx`.

Что важно:
- нижняя навигация содержит `Сегодня`, `Поиск`, `Песни`, `Обучение`, `Ассистент`, `Профиль`;
- `Обучение` видно только артисту;
- в оболочку встроен глобальный playback-слой Songs через `SongsPlaybackProvider`;
- у Songs есть mini-player и full-screen player.

## 14. AI-слой

AI в проекте уже не просто абстрактный контракт.

Сейчас есть:
- runtime-конфиг в `src/lib/ai/config.ts`;
- navigation service в `src/lib/ai/navigation-service.ts`;
- support service в `src/lib/ai/support-service.ts`;
- провайдеры и safety/logging в `src/lib/ai/*`;
- входные схемы в `src/contracts/ai-navigation.ts` и `src/contracts/ai-support.ts`.

Поведение:
- если AI выключен, API возвращает `403`, а UI показывает заглушку;
- если AI включен, `/assistant` делает реальные POST-запросы в соответствующие route handlers;
- по умолчанию проект ориентирован на mock-runtime через `.env`.

Нюанс документации:
- `docs/post-mvp-contracts.md` уже частично отстаёт от runtime, потому что заявки и AI route handlers в проекте уже существуют.

## 15. Микро-шаги PATH

В проекте есть два уровня работы с микро-шагами:

- Runtime-уровень:
  - `src/app/api/home/micro-step/route.ts`
  - именно он отвечает за то, что пользователь видит сегодня.

- Контентный уровень:
  - `docs/microsteps.md`
  - это большая библиотека идей по стадиям PATH.

Важно:
- `docs/microsteps.md` не подключён напрямую к runtime;
- это справочная контентная база для дальнейшего развития генератора.

## 16. Как изучать проект по порядку

Шаг 1. Сначала прочитай модель данных:
- `prisma/schema.prisma`
- `prisma/seed.ts`

Шаг 2. Затем инфраструктуру:
- `src/lib/auth.ts`
- `src/lib/server-auth.ts`
- `src/lib/api.ts`
- `src/lib/prisma.ts`
- `src/lib/path-stages.ts`

Шаг 3. Разбери HOME end-to-end:
- `src/app/today/page.tsx`
- `src/app/api/home/overview/route.ts`
- `src/app/api/home/check-in/route.ts`
- `src/app/api/home/micro-step/route.ts`
- `src/app/api/home/onboarding/route.ts`

Шаг 4. Разбери SONGS как самую насыщенную зону:
- `src/app/songs/page.tsx`
- `src/app/songs/[id]/page.tsx`
- `src/app/songs/projects/[id]/page.tsx`
- `src/app/api/songs/*`
- `src/app/api/projects/*`
- `src/app/api/workspace/*`
- `src/app/api/audio-clips/*`
- `src/lib/storage.ts`

Шаг 5. Затем FIND и заявки:
- `src/app/find/page.tsx`
- `src/app/api/hub/specialists/route.ts`
- `src/app/api/requests/route.ts`
- `src/app/api/requests/[id]/action/route.ts`
- `src/lib/in-app-requests.ts`

Шаг 6. Потом ID и LEARN:
- `src/app/id/page.tsx`
- `src/app/api/id/route.ts`
- `src/app/learn/page.tsx`
- `src/app/api/learn/materials/*`
- `src/lib/learn/*`

Шаг 7. В конце разбери AI:
- `src/app/assistant/page.tsx`
- `src/app/api/ai/navigation/suggest/route.ts`
- `src/app/api/ai/support/respond/route.ts`
- `src/lib/ai/*`
- `src/contracts/*`

## 17. Команды для ежедневной работы

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e:smoke`
- `npm run prisma:migrate`
- `npm run prisma:generate`
- `npm run prisma:seed`
- `npm run demo:stage -- 2`

## 18. Что особенно важно понимать в коде

- Почти каждый API route начинается с `requireUser()`, и это центральная точка приватности.
- `withApiHandler` задаёт единый формат ошибок, поэтому его нельзя обходить без причины.
- В проекте есть канонизация PATH-стадий, и на неё завязаны UI и часть бизнес-логики.
- `SONGS` это уже workspace-модель, а не просто CRUD по трекам.
- Файловое хранилище держит относительный ключ, а не абсолютный путь.
- `LEARN` пока работает на локальном моковом каталоге.
- `AI ASSIST` зависит от feature flags и env, поэтому надо всегда проверять конфиг перед отладкой.

## 19. Ограничения текущего состояния

- `LEARN` не подключён к внешнему CMS или реальной БД.
- AI не является полноценным чат-продуктом: нет истории диалога и долгоживущих тредов.
- S3-адаптер объявлен, но не подключён.
- Часть бизнес-логики всё ещё живёт прямо в route handlers, особенно в `songs/*` и `requests/*`.
- Документация в `docs/post-mvp-contracts.md` уже не полностью совпадает с runtime.

---

Если потребуется, следующим шагом можно сделать вторую методичку в формате "по файлам", где для каждого ключевого файла будут:
1. Назначение.
2. Основные входы и выходы.
3. Инварианты и риски при изменении.
