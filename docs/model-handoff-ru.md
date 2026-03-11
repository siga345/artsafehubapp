# ART SAFE PLACE: Полный Handoff для перехода на другую нейросеть

Дата фиксации: 2026-03-04

## 1. Краткое резюме

`ART SAFE PLACE` это веб-приложение для артиста, которое помогает вести музыкальный путь как управляемую систему, а не как хаотичный набор идей. Историческая формула из `README`: `PATH + FIND + SONGS + SAFE ID`.

По исходной задумке продукт должен был сопровождать артиста от демо до релиза и промо. По фактическому состоянию кода проект уже шире исходного MVP и сейчас включает:

- `TODAY / HOME`: PATH, daily loop, check-in, onboarding, фокус на день, wrap-up, command center.
- `SONGS`: workspace с папками, проектами, треками, версиями, аудио, next steps, feedback, distribution.
- `FIND`: каталог специалистов и in-app заявки.
- `ID`: SAFE ID, профиль, Artist World, ссылки, настройки.
- `LEARN`: каталог обучающих материалов и прогресс.
- `COMMUNITY`: лента, дружбы, посты, feedback threads, community support.
- `AI ASSIST`: AI Navigation + AI Support под feature flag, но по умолчанию на mock-провайдере.

Главная мысль продукта: артисту нужна не просто база файлов, а связанная система движения, где музыка, идентичность, цели, команда, обучение и поддержка собираются в один контур.

## 2. Идея и философия приложения

### 2.1 Исходная философия

Философия проекта строится вокруг нескольких идей:

- музыкальная карьера рассматривается как путь по стадиям, а не как разовые релизы;
- артисту нужен безопасный, структурированный контур работы;
- маленькие ежедневные действия важнее перегруженных планов;
- музыка, образ, команда, обучение и поддержка должны быть связаны между собой;
- AI рассматривается как усиление навигации и поддержки, но не как замена творческого ядра.

### 2.2 PATH как основа продукта

В приложении канонически используется 7 PATH-стадий:

1. `Искра`
2. `Формирование`
3. `Выход в свет`
4. `Прорыв`
5. `Признание`
6. `Широкая известность`
7. `Наследие`

Эти стадии не просто декоративные. Они влияют на:

- daily micro-step;
- контекст home/today;
- диагностику роста;
- goal planning;
- интерпретацию пользовательского прогресса;
- AI context;
- community-achievements.

Legacy-названия этапов (`Идея`, `Демо`, `Продакшн`, `Запись`, `Сведение`, `Мастеринг`, `Релиз`) мапятся в канонические через `src/lib/path-stages.ts`.

### 2.3 Текущий продуктовый сдвиг

Важно: `README.md` всё ещё описывает замороженный MVP с `AI ASSIST` как заглушкой. Это уже не полная картина. Реальный runtime ушёл дальше:

- AI route handlers уже реализованы;
- появились goals/command center;
- появился community-модуль;
- появился learn-модуль;
- появилась расширенная Artist World-логика;
- у Songs появился полноценный workbench с фидбеком и next steps.

Для другой нейросети нужно считать `README` историческим уровнем концепции, а source of truth брать из текущего кода и схемы БД.

## 3. Кому предназначено приложение

Основная целевая роль сейчас: `ARTIST`.

Но в системе есть роли:

- `ARTIST`
- `SPECIALIST`
- `STUDIO`
- `ADMIN`

Роли `SPECIALIST` и `STUDIO` нужны прежде всего для:

- каталога FIND;
- получения заявок;
- community-взаимодействий;
- будущих и частично реализованных сценариев поддержки и фидбека.

## 4. Что реально реализовано сейчас

### 4.1 Today / Home

Это уже не просто домашний экран, а центр ежедневного управления.

Реализовано:

- текущая PATH-стадия пользователя;
- daily check-in по настроению;
- rhythm на базе micro-step и daily to-do;
- onboarding-чеклист;
- micro-step;
- daily to-do;
- command center с primary goal, diagnostics и today focus;
- day loop по трекам: focus -> work -> wrap-up.

Ключевая логика:

- `GET /api/home/overview` собирает единый home payload из check-in, micro-step, daily to-do, rhythm, onboarding, track/project/request counts и day loop.
- если включён `NEXT_PUBLIC_COMMAND_CENTER_ENABLED`, overview дополнительно достраивает command center на базе целей, identity profile и daily focus.
- onboarding-чеклист завязан на фактические действия: профиль, первая песня, первая версия, первая заявка, daily check-in.
- onboarding показывается только на ранней стадии (`Искра`) и скрывается после dismiss.

### 4.2 Legacy micro-step

Это старая логика home-подсказок, но она всё ещё живая.

Реализовано:

- контентный runtime-источник: `src/lib/micro-step-prompts.ts`;
- выдача микро-шагов по PATH-стадии;
- ротация пула шагов с исключением повторов внутри недели;
- хранение `stepPool`, `stepCursor`, `completedStepIndexes`.

Ключевая логика:

- на каждый день генерируется пул шагов по текущей стадии и всем предыдущим стадиям;
- приоритет получает текущая стадия;
- система старается не повторять шаги в пределах текущей недели;
- при повторном POST курсор двигается к следующему шагу;
- если stage/pool изменились, пул регенерируется;
- micro-step живёт отдельно от goal-driven today focus и доступен даже при активной primary goal.

Итог: micro-step остаётся отдельным ежедневным импульсом, а goal-driven today focus и daily to-do сосуществуют рядом как самостоятельные слои.

### 4.3 Goals / Command Center

Это одна из самых важных новых подсистем.

Реализовано:

- цели артиста (`ArtistGoal`);
- стратегические блоки/пиллары (`GoalPillar`);
- задачи цели (`GoalTask`);
- primary goal;
- today focus на базе задачи цели;
- диагностика слабых мест;
- bridge между goal и Artist World;
- связь целей с треками, проектами и категориями специалистов.

Ключевая логика:

- `POST /api/goals` создаёт цель по шаблону в зависимости от `ArtistGoalType` и stage context пользователя.
- для каждой цели создаются стратегические блоки: direction, artist world, catalog, audience, live, team, operations в зависимости от типа цели.
- `POST /api/goals/[id]/tasks` добавляет задачу в конкретный pillar, может привязать трек, проект и нужную категорию специалиста.
- `PUT /api/home/today-focus` выбирает задачу главной цели как фокус дня. Если задача была `TODO`, она переводится в `IN_PROGRESS`.
- `PATCH /api/home/today-focus` отмечает фокус выполненным или невыполненным и синхронизирует статус задачи (`DONE` или `IN_PROGRESS`).
- `GET /api/home/overview` строит diagnostics и выявляет biggest risk по траектории.

Итог: приложение пытается переводить артиста из режима "случайные действия" в режим "цель -> стратегический блок -> задача -> фокус дня".

### 4.4 Songs / Workspace

Это самый насыщенный модуль.

Реализовано:

- папки с вложенностью;
- проекты;
- треки;
- версии/демо;
- primary demo;
- трековый workbench state;
- track intent;
- distribution request;
- feedback requests;
- next steps;
- audio upload + stream;
- mini-player + full-screen player;
- быстрый flow создания демо;
- логика single-project и album-project.

Ключевая логика:

- `GET /api/songs` возвращает список треков с проектом, primary demo, goal links, active next step, feedback summary и distribution summary.
- `POST /api/songs` создаёт новый трек. Если `projectId` не передан, автоматически создаётся новый `SINGLE` project под этот трек.
- если трек создаётся внутри `SINGLE` project, название проекта синхронизируется с названием трека.
- `PATCH /api/songs/[id]` обновляет title, folder, project, primary demo, path stage, lyrics, workbench state и track intent.
- primary demo нельзя назначить из чужого трека и нельзя назначить версию типа `IDEA_TEXT`.
- если пользователь вернулся к отложенному треку или давно не трогал его и изменил lyrics/intent, создаётся `TRACK_RETURNED` achievement.
- `DELETE /api/songs/[id]` удаляет трек и обновляет `updatedAt` проекта.

Содержательная логика Songs:

- `TrackWorkbenchState`: `IN_PROGRESS`, `STUCK`, `NEEDS_FEEDBACK`, `DEFERRED`, `READY_FOR_NEXT_STEP`.
- у трека есть active next step и история решений.
- есть day loop-связка с today focus и wrap-up.
- feedback-механика позволяет просить фидбек по тексту, демо, аранжировке или общему впечатлению.
- distribution-модуль хранит данные по релизу и мастеру.

### 4.5 Day Loop внутри Songs

Это отдельный слой логики поверх треков.

Реализовано:

- daily track focus;
- daily wrap-up;
- next steps;
- журнал решений по треку (`TrackDecision`);
- обновление состояния трека по итогам дня.

Ключевая логика wrap-up:

- при завершении дня текущий active next step закрывается как `DONE` или `CANCELED` в зависимости от `endState`;
- создаётся новый next step;
- состояние трека обновляется;
- фиксируется, что изменилось и что не сработало;
- создаются decision-логи для аналитики и истории;
- touch-логика обновляет `updatedAt` трека и проекта.

Итог: Songs в текущем виде это уже не просто хранилище аудио, а рабочая среда принятия решений.

### 4.6 Find / Requests

Реализовано:

- каталог специалистов;
- фильтры по категории, городу, remote, availability;
- встроенные заявки артист -> специалист;
- заявка может ссылаться на track/demo;
- история действий по заявке;
- участие заявок в community-achievements.

Ключевая логика:

- `POST /api/requests` создаёт заявку сразу в статусе `SUBMITTED`.
- нельзя отправить заявку самому себе.
- можно приложить трек и/или конкретную демо-версию, но только свою.
- создаётся action `SUBMIT`.
- создаётся community-achievement `REQUEST_SUBMITTED`.

Итог: FIND уже не просто каталог, а operational layer для коммуникации с продюсерами, студиями и другими специалистами.

### 4.7 ID / SAFE ID / Artist World

Реализовано:

- базовый профиль пользователя;
- `safeId`;
- nickname;
- avatar;
- bandlink и ссылки;
- настройки уведомлений;
- настройка приватности демо;
- Artist Identity Profile;
- Artist World с темой, background, блоками, референсами и проектами.

Ключевая логика:

- `GET /api/id` возвращает базовый профиль плюс сериализованный Artist World.
- `PATCH /api/id` обновляет nickname, avatar, bandlink, privacy-настройки и artist world.
- ссылки нормализуются и валидируются;
- references и projects в Artist World ограничены по количеству;
- artist world хранится как комбинация текстового identity-profile и отдельных сущностей references/projects.

Смысл модуля:

- это не только профиль для отображения;
- это источник контекста для goals, tracks, recommendations и AI;
- через `id-integration.ts` строятся мосты между identity, track и goal.

### 4.8 Learn

Реализовано:

- каталог материалов;
- фильтрация;
- карточки и detail pages;
- progress state;
- применение материала к goal или track;
- learn-context в home/goal flows.

Но источник данных сейчас моковый:

- материалы лежат в `src/lib/learn/mock-materials.ts`;
- `repository.ts` только фильтрует, сортирует и подмешивает пользовательский прогресс.

Итог: UI и доменная оболочка Learn уже есть, но контентный backend пока локальный и статический.

### 4.9 Community

Это тоже уже реальный модуль, а не идея на будущее.

Реализовано:

- community feed;
- featured creators;
- friendships;
- community posts;
- likes;
- events;
- feedback threads и replies;
- профиль community creator;
- support surface внутри community.

Сервис `src/lib/community/service.ts` собирает:

- actor DTO;
- feed items;
- thread DTO;
- track refs;
- friendship state;
- helpful interactions;
- event/system actors.

Итог: community не полностью документирован в `README`, но в коде это уже отдельная функциональная зона.

### 4.10 AI Assist

Текущее состояние более зрелое, чем написано в `README`.

Реализовано:

- runtime-конфиг AI;
- `AI Navigation`;
- `AI Support`;
- schemas/contracts;
- logging;
- safety layer;
- fallback-ответы;
- provider abstraction;
- mock structured provider.

Ключевая логика AI Navigation:

- получает objective, path context, city, preferRemote, budget, topK;
- загружает специалистов из БД;
- присваивает heuristic score по совпадению категории, remote/city, availability, budget, services;
- передаёт top candidates провайдеру;
- при сбое провайдера возвращает fallback draft;
- на выходе отдаёт summary, recommendations и next actions.

Ключевая логика AI Support:

- принимает mood, note, path context и recent activity;
- перед генерацией делает safety check по note;
- если уровень риска высокий, сразу возвращает безопасный fallback с ресурсами;
- если риск не критический, пробует провайдера;
- unsafe provider output не выпускается наружу;
- на выходе: `tone`, `responseText`, `suggestedSteps`, `escalation`.

Важно:

- AI включается через `AI_ASSIST_ENABLED` и `NEXT_PUBLIC_AI_ASSIST_ENABLED`;
- по умолчанию в `.env.example` AI выключен;
- даже при включении провайдер по умолчанию `mock`.

Итог: AI в коде уже рабочий как продуктовый контур, но пока не интегрирован с реальным внешним AI-провайдером.

## 5. Архитектура приложения

### 5.1 Технологии

- `Next.js 14` с App Router
- `React 18`
- `TypeScript`
- `TailwindCSS`
- локальные UI-компоненты
- `TanStack Query`
- `NextAuth` c `CredentialsProvider`
- `Prisma`
- `PostgreSQL`
- `zod`

### 5.2 Общая схема исполнения

Поток запроса:

1. Клиент вызывает `apiFetch` / `apiFetchJson`.
2. Запрос попадает в route handler `src/app/api/**`.
3. Handler оборачивается в `withApiHandler`.
4. Идёт `requireUser()` через NextAuth session.
5. Request body валидируется `zod`.
6. Обращение идёт в Prisma.
7. Ответ сериализуется и возвращается в UI.

### 5.3 Общие инфраструктурные правила

- `src/lib/api.ts` унифицирует ошибки и Prisma-mapping.
- `src/lib/server-auth.ts` жёстко требует серверную сессию.
- `middleware.ts` защищает `/today`, `/find`, `/songs`, `/assistant`, `/community`, `/id`.
- `/learn` дополнительно ограничен логикой роли.

### 5.4 Storage

Локальное хранилище:

- аудио сохраняется в `uploads/`;
- в БД хранится относительный `storageKey`;
- stream route поддерживает `Range`;
- есть адаптерная база для будущего S3.

## 6. Основная доменная модель БД

Базовые сущности:

- `User`
- `PathStage`
- `SpecialistProfile`
- `Folder`
- `Project`
- `Track`
- `Demo`
- `TrackDistributionRequest`
- `DailyCheckIn`
- `DailyMicroStep`
- `WeeklyActivity`
- `UserOnboardingState`
- `ArtistIdentityProfile`
- `ArtistWorldProject`
- `ArtistWorldReference`
- `ArtistGoal`
- `GoalPillar`
- `GoalTask`
- `DailyFocus`
- `DailyTrackFocus`
- `DailyWrapUp`
- `TrackNextStep`
- `TrackDecision`
- `FeedbackRequest`
- `FeedbackItem`
- `FeedbackResolution`
- `CommunityPost`
- `CommunityFeedbackThread`
- `CommunityFeedbackReply`
- `CommunityAchievement`
- `CommunityLike`
- `CommunityEvent`
- `Friendship`
- `LearnMaterialProgress`
- `RecommendationEvent`
- `LearnApplication`
- `InAppRequest`
- `InAppRequestAction`

Смысл модели:

- `User` является центром почти всех подсистем;
- треки, цели, identity и community связаны напрямую;
- система строится вокруг того, чтобы путь артиста был наблюдаем, сериализуем и пригоден для рекомендаций.

## 7. Что сделано

Если смотреть по коду, а не по старому описанию MVP, сейчас уже сделано следующее:

- приватная авторизация и role-aware продуктовый каркас;
- полноценная база моделей Prisma под творческий workflow;
- home/today с двумя слоями: legacy micro-step и новый command center;
- трековый workspace с проектами, папками и аудио;
- next steps и day loop;
- feedback-система по трекам;
- distribution request;
- каталог специалистов и заявки;
- SAFE ID и Artist World;
- community feed и friendships;
- learn-catalog и progress;
- AI navigation/support под feature flags;
- achievements/recommendation logging;
- seed-данные и локальная среда разработки;
- CI с `lint + typecheck + build + e2e smoke`.

## 8. Что не сделано или не доведено до продакшн-уровня

### 8.1 AI не подключён к внешнему боевому провайдеру

Сейчас:

- AI по умолчанию выключен;
- provider по умолчанию `mock`;
- реального внешнего LLM-провайдера в коде пока нет.

### 8.2 Learn пока контентно моковый

Сейчас:

- материалы хранятся локально в коде;
- нет внешнего каталога, CMS или отдельного хранилища контента.

### 8.3 Документация частично отстаёт от runtime

Сейчас:

- `README.md` описывает старый frozen MVP;
- `docs/post-mvp-contracts.md` говорит о части вещей как о будущем, хотя runtime уже есть;
- `docs/microsteps_fixed.md` не является прямым source of truth для runtime.

### 8.4 E2E smoke не автономен

Сейчас:

- тест требует доступную БД на `localhost:5432`;
- без поднятого Postgres тест сразу падает.

### 8.5 Есть следы переходного состояния продукта

Сейчас:

- coexistence legacy micro-step и нового command center;
- часть home-логики живёт как fallback для отсутствующих таблиц;
- система явным образом переживает миграцию от более раннего MVP к более сложной архитектуре.

## 9. Текущие проблемы и риски

### 9.1 Инженерные проблемы

1. `npm run typecheck` до сборки падает, если отсутствуют `.next/types`.
Причина: `tsconfig.json` включает `.next/types/**/*.ts`.
Практический эффект: typecheck зависит от предварительного `next build` или от уже существующей `.next`.

2. `npm run test:e2e:smoke` падает без локальной БД.
Фактическая ошибка на 2026-03-04: `Can't reach database server at localhost:5432`.

3. Репозиторий находится в состоянии крупного незакоммиченного WIP.
На момент осмотра `git diff --stat` показывает большой объём правок: новые API, новые страницы, изменения схемы Prisma, расширение `today`, `songs`, `community`, `id`.

### 9.2 Продуктовые риски

1. У проекта два конкурирующих уровня правды:
- старый MVP-нарратив в `README`;
- фактический runtime в коде.

2. Command center и legacy micro-step сосуществуют.
Это работает, но усложняет продуктовую модель и handoff.

3. Community и Learn уже есть в коде, но не полностью описаны в верхнеуровневой документации.

4. AI воспринимается как присутствующая фича, но без реального внешнего провайдера его возможности ограничены mock-runtime.

## 10. Текущее качество и фактический статус проверок

Проверено 2026-03-04:

- `npm run lint`: проходит
- `npm run build`: проходит
- `npm run typecheck`: проходит после генерации `.next/types` сборкой
- `npm run test:e2e:smoke`: не проходит без поднятой БД

Точное замечание:

- typecheck-проблема сейчас инфраструктурная, а не типовая ошибка кода;
- e2e-проблема сейчас средовая, а не обязательно баг приложения.

## 11. Feature flags и окружение

Ключевые переменные из `.env.example`:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AI_ASSIST_ENABLED`
- `NEXT_PUBLIC_AI_ASSIST_ENABLED`
- `NEXT_PUBLIC_COMMAND_CENTER_ENABLED`
- `AI_PROVIDER`
- `AI_MODEL_NAVIGATION`
- `AI_MODEL_SUPPORT`
- `AI_REQUEST_TIMEOUT_MS`

Смысл:

- `NEXT_PUBLIC_COMMAND_CENTER_ENABLED=true` включает новый home/goal-driven flow;
- `AI_ASSIST_ENABLED` и `NEXT_PUBLIC_AI_ASSIST_ENABLED` должны быть синхронно включены для AI UI/API;
- `AI_PROVIDER=mock` означает, что AI слой остаётся локальным мок-слоем.

## 12. Seed и локальная среда

Seed создаёт:

- 7 PATH-стадий;
- демо-артиста `demo@artsafehub.app / demo1234`;
- `SAFE-DEMO-001`;
- базовый Artist Identity Profile;
- папку;
- трек `Night Ride`;
- две demo-версии;
- записи HOME;
- тестовых специалистов FIND;
- featured creators, friendship и community seed-данные.

Это значит, что локальная среда уже заточена под демонстрацию нескольких подсистем сразу, а не только песен.

## 13. Самые важные файлы для новой нейросети

### 13.1 Продуктовая философия

- `README.md`
- `docs/project-study-guide-ru.md`
- `docs/microsteps_fixed.md`

### 13.2 Источник правды по доменной модели

- `prisma/schema.prisma`
- `prisma/seed.ts`

### 13.3 Инфраструктура

- `src/lib/api.ts`
- `src/lib/server-auth.ts`
- `src/lib/auth.ts`
- `src/lib/prisma.ts`
- `middleware.ts`

### 13.4 Home / Goals / Daily loop

- `src/app/api/home/overview/route.ts`
- `src/app/api/home/micro-step/route.ts`
- `src/app/api/home/today-focus/route.ts`
- `src/app/api/home/wrap-up/route.ts`
- `src/app/api/goals/route.ts`
- `src/app/api/goals/[id]/tasks/route.ts`
- `src/lib/day-loop.ts`
- `src/lib/artist-growth.ts`

### 13.5 Songs

- `src/app/api/songs/route.ts`
- `src/app/api/songs/[id]/route.ts`
- `src/lib/track-workbench.ts`
- `src/lib/track-next-steps.ts`
- `src/lib/feedback.ts`
- `src/lib/storage.ts`

### 13.6 Find / Requests

- `src/app/api/hub/specialists/route.ts`
- `src/app/api/requests/route.ts`
- `src/app/api/requests/[id]/action/route.ts`
- `src/lib/in-app-requests.ts`

### 13.7 ID / Artist World

- `src/app/api/id/route.ts`
- `src/lib/id-integration.ts`

### 13.8 Community

- `src/app/api/community/**`
- `src/lib/community/service.ts`
- `src/lib/community/achievements.ts`

### 13.9 Learn

- `src/app/api/learn/**`
- `src/lib/learn/repository.ts`
- `src/lib/learn/mock-materials.ts`

### 13.10 AI

- `src/app/api/ai/navigation/suggest/route.ts`
- `src/app/api/ai/support/respond/route.ts`
- `src/lib/ai/config.ts`
- `src/lib/ai/provider.ts`
- `src/lib/ai/navigation-service.ts`
- `src/lib/ai/support-service.ts`
- `src/contracts/ai-navigation.ts`
- `src/contracts/ai-support.ts`

## 14. Как объяснять проект другой нейросети в одном абзаце

`ART SAFE PLACE` это Next.js/Prisma-приложение для артистов, где музыкальный путь управляется как система: PATH-стадии задают контекст, Today/Command Center управляет ежедневным движением, Songs хранит и продвигает треки через версии, next steps, feedback и релизный контур, Find связывает артиста со специалистами через заявки, ID хранит Artist World и SAFE ID, Learn даёт материалы и прогресс, Community добавляет социальный слой, а AI Assist под feature flags помогает навигацией и поддержкой, но сейчас в основном работает через mock-provider и fallback-логику.

## 15. Короткий вывод

Проект уже не является "простым MVP песен и поиска". Это развивающаяся career-operating-system для артиста с несколькими переплетёнными доменными слоями:

- творческий контур;
- операционный контур;
- карьерный контур;
- идентичность;
- обучение;
- сообщество;
- AI-помощь.

Для перехода на другую нейросеть правильнее считать текущий runtime и `prisma/schema.prisma` главным источником истины, а `README.md` и часть docs использовать как историко-концептуальный контекст.
