# ART SAFE PLACE: Методичка по проекту (текущий этап MVP)

Этот документ объясняет, как устроен проект сейчас, как проходит запрос через систему, и в каком порядке изучать код, чтобы уверенно работать в репозитории.

## 1. Что это за приложение

`ART SAFE PLACE` это MVP для артиста:
- `HOME (today)` для PATH-стадии, чек-ина и микро-шага.
- `FIND` для поиска специалистов/студий.
- `SONGS` для треков, версий и демо.
- `ID` для профиля и SAFE ID.
- `AI ASSIST` пока заглушка.

Главный пользовательский сценарий:
1. Логин.
2. Домашняя страница и дневная активность.
3. Создание трека и демо.
4. Поиск специалистов.
5. Редактирование профиля.

## 2. Технологический стек

- Frontend: `Next.js 14 (App Router)`, `React 18`, `TypeScript`.
- UI: `TailwindCSS`, простые UI-компоненты в `src/components/ui`.
- Data fetching: `@tanstack/react-query`.
- Auth: `next-auth` с `CredentialsProvider`.
- Backend: API routes в `src/app/api`.
- ORM/DB: `Prisma` + `PostgreSQL`.
- Валидация API: `zod`.
- Хранение аудио: локально в `uploads/` через `src/lib/storage.ts`.

## 3. Карта репозитория

Ключевые директории:
- `src/app` страницы и API роуты.
- `src/components` layout и UI-компоненты.
- `src/lib` инфраструктура: auth, prisma, API helpers, storage, AI abstractions.
- `prisma` схема БД, миграции, seed.
- `docs` документация.
- `uploads` локальные аудиофайлы.

Критичные файлы:
- `prisma/schema.prisma` модели и связи.
- `prisma/seed.ts` стартовые данные.
- `src/lib/auth.ts` настройка NextAuth.
- `src/lib/server-auth.ts` `requireUser()` для API авторизации.
- `src/lib/api.ts` единая обработка ошибок/валидации API.
- `src/app/layout.tsx` глобальная оболочка приложения.
- `middleware.ts` защита приватных маршрутов.

Примечание по неймингу:
- Продуктовое название: `ART SAFE PLACE`.
- Техническое имя репозитория/пакета может оставаться `artsafehubapp` (это нормально и не влияет на UI/бренд).

## 4. Как приложение запускается

1. `src/app/layout.tsx` подключает `Providers` и `AppShell`.
2. `src/app/providers.tsx` поднимает `SessionProvider` и `QueryClientProvider`.
3. `middleware.ts` защищает роуты `/today`, `/find`, `/songs`, `/assistant`, `/id`.
4. Пользователь логинится через `src/app/signin/page.tsx`.
5. `next-auth` обрабатывает вход через `src/app/api/auth/[...nextauth]/route.ts`.

## 5. Поток запроса от кнопки до базы

Пример универсального потока:
1. Пользователь нажимает кнопку на странице (например `src/app/today/page.tsx`).
2. Компонент вызывает `apiFetch` или `apiFetchJson` из `src/lib/client-fetch.ts`.
3. Запрос уходит в API route (`src/app/api/.../route.ts`).
4. В API вызывается `requireUser()` из `src/lib/server-auth.ts`.
5. `requireUser()` читает серверную сессию (`getServerSession(authOptions)`).
6. При успехе API работает с БД через `prisma` (`src/lib/prisma.ts`).
7. Ответ возвращается в UI, React Query обновляет кэш.

Если сессии нет:
- API возвращает `401`.
- На клиенте `apiFetch` делает редирект на `/signin`.

## 6. Авторизация и роли

Логика в `src/lib/auth.ts`:
- Тип auth: `JWT session`.
- Провайдер: `Credentials` (email/password).
- Пароль сверяется через `bcrypt.compare`.
- В JWT и session добавляются `id` и `role`.

Типизация расширения next-auth:
- `src/types/next-auth.d.ts`.

Роли в БД (`prisma/schema.prisma`):
- `ARTIST`, `SPECIALIST`, `STUDIO`, `ADMIN`.

## 7. Доменные сущности БД

Основные таблицы:
- `User` профиль, настройки, роль, SAFE ID, текущая PATH-стадия.
- `SpecialistProfile` данные для раздела FIND.
- `Folder` папка треков пользователя.
- `Track` трек пользователя, связь с папкой и PATH-стадией.
- `Demo` аудио-версия трека и комментарий.
- `PathStage` стадии пути (идея, демо, продакшн и т.д.).
- `DailyCheckIn` ежедневный mood check.
- `DailyMicroStep` микро-шаг на день.
- `WeeklyActivity` активные дни недели.

Связи:
- `User 1 -> N Track`.
- `User 1 -> N Folder`.
- `Folder 1 -> N Track`.
- `Track 1 -> N Demo`.
- `PathStage 1 -> N User/Track/MicroStep`.

## 8. Страницы и их API

`/today` (`src/app/today/page.tsx`):
- `GET /api/home/overview`
- `PUT /api/home/check-in`
- `POST /api/home/micro-step`
- `PATCH /api/home/micro-step`

`/find` (`src/app/find/page.tsx`):
- `GET /api/hub/specialists` с фильтрами query/category/mode/city/availableNow.

`/songs` (`src/app/songs/page.tsx`):
- `GET /api/songs`
- `POST /api/songs`
- `PATCH /api/songs/:id`
- `GET /api/folders`
- `POST /api/folders`
- `DELETE /api/folders/:id`
- `GET /api/path/stages`
- `POST /api/audio-clips`

`/songs/[id]` (`src/app/songs/[id]/page.tsx`):
- `GET /api/songs/:id`
- `PATCH /api/songs/:id`
- `DELETE /api/songs/:id`
- `POST /api/audio-clips`
- `PATCH /api/audio-clips/:id`
- `DELETE /api/audio-clips/:id`
- `GET /api/audio-clips/:id/stream`

`/id` (`src/app/id/page.tsx`):
- `GET /api/id`
- `PATCH /api/id`

`/assistant`:
- заглушка без API-вызовов.

Важно по PATH-этапам в UI:
- В seed создаются стадии `1..9` (включая промо-этапы).
- В `SONGS` часть UI скрывает промо-этапы (фильтр по названию, если stage содержит `промо`).
- Это сделано, чтобы в MVP рабочий фокус треков оставался на музыкальном продакшне, а не на промо-пайплайне.

## 9. Слой API: единые правила

Все route handlers используют `withApiHandler` из `src/lib/api.ts`.

Что он делает:
- Ловит `ApiError` и возвращает JSON со статусом.
- Переводит Prisma-коды `P2025` в `404`, `P2002` в `409`.
- Для неожиданных ошибок возвращает `500`.

Валидация тела запроса:
- `parseJsonBody(request, zodSchema)`.
- При невалидном body возвращается `400`.

## 10. Storage аудио

Файл: `src/lib/storage.ts`.

Правила:
- Лимит: `25MB`.
- MIME whitelist для аудио.
- Имя файла очищается (`normalizeUploadFilename`).
- Генерируется ключ вида `YYYY/MM/DD/uuid-filename`.

Провайдеры:
- `LocalStorageProvider` активен по умолчанию.
- `S3StorageProvider` пока заглушка.

Загрузка:
- API `POST /api/audio-clips` получает `FormData` с `file`, `durationSec`, `trackId`, `noteText`, `versionType`.

Стрим:
- API `GET /api/audio-clips/:id/stream` читает файл из `uploads/<storageKey>`.

## 11. Seed-данные и начальное окружение

`prisma/seed.ts` создаёт:
- PATH стадии (1..9), включая промо-этапы:
  - `Промо-съёмка`
  - `Выпуск промо`
- Demo пользователя `demo@artsafehub.app / demo1234`.
- Папку, трек и 2 демо.
- check-in, micro-step и weekly activity.
- Несколько специалистов для FIND.

Важно:
- Seed в начале делает `deleteMany()` для ключевых таблиц.

## 12. UI и стили

- Оболочка и навигация: `src/components/layout/app-shell.tsx`.
- Базовые UI-компоненты: `src/components/ui/*`.
- Цвета и темы: `tailwind.config.ts`.
- Глобальные стили: `src/app/globals.css`.

## 13. AI-слой в MVP

Сейчас это инфраструктурный каркас:
- Контракт: `src/lib/ai-contract.ts`.
- Провайдер: `src/lib/ai-service.ts`.
- Реализация по умолчанию: `MockAIProvider` в `src/lib/ai-mock-provider.ts`.
- Телеметрия: `src/lib/ai-telemetry.ts`.
- UI-раздел AI: заглушка `src/app/assistant/page.tsx`.

Post-MVP контракты лежат в:
- `src/contracts/*.ts`
- описание: `docs/post-mvp-contracts.md`.

## 13.1. Микро-шаги PATH (документ vs runtime)

В проекте есть два уровня работы с микро-шагами:

- Runtime (то, что сейчас реально работает в MVP):
  - `src/app/api/home/micro-step/route.ts`
  - там хранится небольшой встроенный словарь `stagePrompts` и логика генерации/перегенерации микро-шага на сегодня.

- Контентная база (расширенный список идей):
  - `docs/microsteps.md`
  - это большой справочный документ с наборами микро-шагов по PATH-этапам.

Важно понимать:
- `docs/microsteps.md` сейчас не подключён напрямую к API.
- Это методическая/контентная база для будущего расширения генератора микро-шагов.
- Если захочешь, можно следующим этапом вынести `stagePrompts` из кода в структурированный JSON/TS-словарь и генерировать шаги из общей базы.

## 14. Как изучить проект построчно (практический план)

Шаг 1. Прочитай модель данных:
- `prisma/schema.prisma`
- `prisma/seed.ts`

Шаг 2. Прочитай auth и инфраструктуру:
- `src/lib/auth.ts`
- `src/lib/server-auth.ts`
- `src/lib/api.ts`
- `src/lib/prisma.ts`

Шаг 3. Прочитай одну фичу end-to-end:
- UI: `src/app/today/page.tsx`
- API: `src/app/api/home/*`
- Таблицы: `DailyCheckIn`, `DailyMicroStep`, `WeeklyActivity`.

Шаг 4. Повтори для `SONGS`:
- UI: `src/app/songs/page.tsx`, `src/app/songs/[id]/page.tsx`
- API: `src/app/api/songs/*`, `src/app/api/audio-clips/*`, `src/app/api/folders/*`
- Storage: `src/lib/storage.ts`

Шаг 5. Повтори для `FIND` и `ID`:
- UI: `src/app/find/page.tsx`, `src/app/id/page.tsx`
- API: `src/app/api/hub/specialists/route.ts`, `src/app/api/id/route.ts`

Шаг 6. Закрепи понимание через изменения:
- Добавь новое поле в `Track`.
- Сделай миграцию Prisma.
- Добавь поле в API и UI.
- Проверь `typecheck`, `lint`, `build`.

## 15. Команды для ежедневной работы

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run prisma:migrate`
- `npm run prisma:seed`

## 16. Что в коде особенно важно понимать

- Почему почти каждый API route начинает с `requireUser()`.
- Почему все ошибки проходят через `withApiHandler`.
- Почему UI и API жёстко синхронизированы через типы и формы данных.
- Почему в `SONGS` много клиентского состояния: это сложная форма с несколькими режимами.
- Почему `uploads` хранит только `storageKey`, а не абсолютный путь.
- Почему часть бизнес-логики пока содержится прямо в route handlers (быстро для MVP), и что потом стоит вынести в сервисный слой.

## 17. Ограничения текущего MVP

- AI-чат не активен.
- Нет отдельного Notes-раздела.
- Нет боевого S3-адаптера.
- Нет расширенного RBAC по ролям в API.
- Нет отдельного audit-лога изменений.

---

Если хочешь, следующим шагом можно сделать вторую версию методички в формате "файл-за-файлом", где на каждый файл будет:
1. Назначение.
2. Входы/выходы.
3. Что сломается при изменении этого файла.
