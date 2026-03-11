# ART SAFE PLACE: Полная методичка по коду проекта

Этот документ нужен не для быстрого онбординга, а для глубокого разбора репозитория. Цель: чтобы ты понимал систему так, как будто проект писал сам. Ниже не просто список файлов, а рабочая модель приложения: как оно стартует, где живут данные, как TypeScript организует границы, как запрос проходит от кнопки до базы, и как устроена каждая крупная подсистема.

---

## 0. Как читать эту методичку

Если хочешь понять проект до уровня автора, читай в таком порядке:

1. Сначала разделы `1-6`: они собирают общую ментальную модель.
2. Потом раздел `7`: это TypeScript-паттерны проекта.
3. Потом разделы `8-15`: они объясняют реальные подсистемы.
4. После каждого раздела открывай упомянутые файлы и читай код уже с правильным контекстом.

Ключевая идея: этот репозиторий нельзя понимать как "набор страниц". Это одна доменная система для артиста, где `Today`, `Goals`, `Songs`, `Learn`, `ID`, `Find`, `Community` и `AI` работают как связанные слои одного карьерного цикла.

---

## 1. Что это за продукт

`ART SAFE PLACE` это веб-приложение для артиста. Его ядро строится вокруг формулы:

- `PATH`: текущая стадия и логика движения артиста.
- `TODAY`: ежедневный рабочий цикл и фокус.
- `GOALS`: карьерные цели, факторы, задачи и траектория.
- `SONGS`: workspace музыки, демо, проектов, релизов и трекового прогресса.
- `FIND`: поиск специалистов и внутренние заявки.
- `LEARN`: контекстный каталог материалов.
- `ID`: SAFE ID и Artist World.
- `COMMUNITY`: друзья, ивенты, достижения, социальный feedback loop.
- `AI`: пока ограниченный слой навигации и поддержки, подключаемый через runtime-конфиг.

Важно: продукт не разбит на независимые "мини-приложения". Он построен как одна сквозная модель роста артиста:

1. У пользователя есть профиль и стадия пути.
2. Из стадии и профиля рождается цель.
3. Из цели рождается today focus.
4. Today focus связывается с задачей, а задача может ссылаться на трек, проект или специалиста.
5. Трек живёт в Songs и может породить feedback, запрос, релиз, community-пост, learn-контекст или AI-рекомендацию.

Если держать в голове эту цепочку, код читается намного легче.

---

## 2. Стек и его роль

### Frontend

- `Next.js 14 App Router`
- `React 18`
- `TypeScript strict mode`
- `TailwindCSS`
- `TanStack Query`

### Backend внутри того же репозитория

- `Next.js Route Handlers` в `src/app/api`
- `NextAuth` для авторизации
- `Prisma` для работы с БД
- `PostgreSQL`
- `zod` для runtime-валидации входа

### Почему это важно

Это не классический SPA + отдельный backend. Здесь:

- страницы лежат рядом с API;
- серверные и клиентские компоненты живут в одном дереве;
- Prisma используется прямо из route handlers;
- границы между UI, server-side логикой и доменными сервисами задаются структурой `src/app`, `src/components`, `src/lib`.

---

## 3. Карта репозитория

### Верхний уровень

- `src/app` — маршруты App Router, страницы и API route handlers.
- `src/components` — клиентские и презентационные компоненты.
- `src/lib` — инфраструктура и доменная логика.
- `src/contracts` — DTO и схемы, особенно для AI, community и recommendations.
- `src/types` — расширения типов, например `next-auth`.
- `prisma` — схема БД, миграции, сиды, тестовые данные.
- `docs` — документация.
- `scripts` — служебные сценарии.
- `uploads` — локальное хранилище файлов.

### Важнейшие файлы для первого чтения

- `package.json`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/components/layout/app-shell.tsx`
- `src/lib/auth.ts`
- `src/lib/server-auth.ts`
- `src/lib/api.ts`
- `src/lib/client-fetch.ts`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`

### Как распределена ответственность

- `src/app/.../page.tsx` отвечает за маршрут и композицию экрана.
- `src/components/...` отвечает за UI и клиентское взаимодействие.
- `src/app/api/.../route.ts` отвечает за HTTP-вход.
- `src/lib/...` отвечает за переиспользуемую логику, сериализацию, выборки и вычисления.

Это один из главных паттернов репозитория: тонкий HTTP-слой и вынос устойчивой логики в `src/lib`.

---

## 4. Как приложение загружается

### Корневой вход

- `/` редиректит на `/today`.
- `src/app/layout.tsx` подключает глобальные стили, `Providers` и `AppShell`.

Код старта очень короткий:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-[var(--font-space-grotesk)]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
```

### Глобальные провайдеры

`src/app/providers.tsx` поднимает:

- `SessionProvider`
- `ToastProvider`
- `QueryClientProvider`
- `ReactQueryDevtools`

Это означает:

- сессия доступна всему клиентскому дереву;
- тосты доступны всему UI;
- весь клиентский data fetching стандартно идёт через React Query.

### Middleware

`middleware.ts` защищает приватные разделы:

- `/today`
- `/find`
- `/songs`
- `/assistant`
- `/community`
- `/id`

Важно: `learn` защищён не middleware, а серверной проверкой роли на самой странице. Это означает, что в проекте используются оба уровня контроля:

- общий auth-gate на маршрут;
- точечные role-guards внутри серверных страниц и API.

---

## 5. Главная ментальная модель архитектуры

Чтобы читать код быстро, держи в голове 5 слоёв:

### Слой 1. Route

Примеры:

- `src/app/today/page.tsx`
- `src/app/learn/[slug]/page.tsx`
- `src/app/api/songs/route.ts`

Route либо:

- просто монтирует компонент страницы;
- либо принимает HTTP-запрос и передаёт его дальше.

### Слой 2. UI-компоненты

Примеры:

- `src/components/home/command-center-page.tsx`
- `src/components/songs/workspace-browser.tsx`
- `src/components/community/community-page.tsx`

Они держат:

- локальный UI state;
- формы;
- модалки;
- `useQuery` / `useMutation`;
- optimistic/refetch-поведение;
- рендер доменных DTO.

### Слой 3. API boundary

Примеры:

- `src/lib/api.ts`
- `src/lib/client-fetch.ts`

Это место, где фиксируются:

- HTTP-ошибки;
- формат ошибок;
- проверка тела запроса;
- поведение при `401`.

### Слой 4. Domain logic

Примеры:

- `src/lib/artist-growth.ts`
- `src/lib/track-workbench.ts`
- `src/lib/community/service.ts`
- `src/lib/learn/context.ts`
- `src/lib/workspace-tree.ts`

Здесь происходят:

- вычисления;
- сериализация Prisma-records в DTO;
- согласование нескольких таблиц;
- бизнес-правила.

### Слой 5. Persistence

Примеры:

- `src/lib/prisma.ts`
- `prisma/schema.prisma`
- миграции в `prisma/migrations/*`

Здесь живут:

- enums;
- relations;
- индексы и ограничения;
- source of truth доменной модели.

---

## 6. Поток запроса от кнопки до базы

Типовой сценарий в этом проекте выглядит так:

1. Пользователь нажимает кнопку в клиентском компоненте.
2. Компонент вызывает `apiFetch()` или `apiFetchJson()` из `src/lib/client-fetch.ts`.
3. Запрос попадает в `src/app/api/.../route.ts`.
4. Route handler обёрнут в `withApiHandler(...)` из `src/lib/api.ts`.
5. Внутри вызывается `requireUser()` из `src/lib/server-auth.ts`.
6. Тело запроса валидируется через `parseJsonBody(..., zodSchema)`.
7. Handler работает с `prisma` напрямую или вызывает доменные функции из `src/lib`.
8. Prisma читает/пишет PostgreSQL.
9. Данные сериализуются и возвращаются как JSON.
10. React Query кладёт результат в кэш и обновляет UI.

Минимальный паттерн route handler:

```ts
export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, schema);

  const result = await prisma.model.create({
    data: { ...body, userId: user.id }
  });

  return NextResponse.json(result, { status: 201 });
});
```

Паттерн обработки `401` на клиенте:

```ts
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (response.status === 401) {
    redirectToSignIn();
    throw new Error("Unauthorized");
  }

  return response;
}
```

Это один из ключевых архитектурных законов проекта: сервер отвечает `401`, клиент знает, как на него реагировать.

---

## 7. TypeScript в этом проекте: полный практический гайд

Этот раздел особенно важен. Если ты хочешь "чувствовать, что сам написал код", нужно понимать не только бизнес-логику, но и то, как здесь используется TypeScript.

### 7.1. `strict: true` это не формальность

`tsconfig.json` включает строгий режим:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Что это меняет:

- нельзя бездумно работать с `null` и `undefined`;
- нельзя неявно расширять типы;
- TypeScript заставляет фиксировать структуру DTO и границы слоя.

### 7.2. Алиас `@/`

Вместо длинных относительных импортов проект использует:

```ts
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
```

Это делает архитектуру читаемой: по импорту сразу видно, из какого слоя пришла зависимость.

### 7.3. Когда в проекте используют `type`, а когда literal unions

Частый паттерн:

```ts
type GoalMotionType = "CRAFT" | "CREATIVE";
type SaveState = "idle" | "saving" | "saved" | "error";
```

Почему это удобно:

- UI легко делает `switch` или сравнение по строкам;
- ты получаешь autocomplete;
- невозможно случайно подставить неподдерживаемое значение.

### 7.4. Когда берут типы из Prisma

Если значение уже является частью БД и должно строго соответствовать схеме, часто берут тип или enum из `@prisma/client`:

```ts
import { ArtistGoalType, GoalTaskStatus } from "@prisma/client";
```

Используй простое правило:

- если значение хранится в БД и уже описано в Prisma, лучше переиспользовать Prisma-тип;
- если это локальный UI-срез или DTO view-модели, можно объявить `type` рядом с компонентом.

### 7.5. `zod` как runtime-валидация поверх TypeScript

TypeScript проверяет код во время сборки, но не валидирует JSON из сети. Поэтому в API используется `zod`:

```ts
const createTrackSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable()
});
```

И дальше:

```ts
const body = await parseJsonBody(request, createTrackSchema);
```

Это даёт 3 вещи сразу:

- защита от мусорного input;
- автоматический вывод TypeScript-типа из схемы;
- единый формат ошибок для клиента.

### 7.6. `satisfies` для Prisma include/select

Очень важный паттерн из `src/lib/track-workbench.ts`:

```ts
export const trackListInclude = {
  folder: true,
  project: true,
  pathStage: true
} satisfies Prisma.TrackInclude;
```

Почему это сильный паттерн:

- объект остаётся литералом;
- TypeScript проверяет, что include валиден для Prisma;
- ты не теряешь точность типов.

Это лучше, чем просто `const x: Prisma.TrackInclude = ...`, потому что `satisfies` мягче и точнее.

### 7.7. Типы записей через `Prisma.ModelGetPayload`

Следующий важный шаг после `include`:

```ts
type TrackListRecord = Prisma.TrackGetPayload<{ include: typeof trackListInclude }>;
```

То есть:

1. сначала описывается include;
2. потом выводится точный тип записи;
3. потом этот тип используют в serializer functions.

Это один из главных паттернов всего репозитория.

### 7.8. Сериализация как отдельный слой

Типичный ход:

```ts
function serializeProject(project: TrackListRecord["project"] | null | undefined) {
  if (!project) return null;
  return {
    id: project.id,
    title: project.title
  };
}
```

Почему так сделано:

- Prisma-record нельзя отдавать прямо в UI;
- UI не должен зависеть от полной структуры БД;
- сериализатор превращает запись базы в публичную DTO.

### 7.9. Точный контроль `null`

Почти везде используются функции вида:

```ts
function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}
```

Или:

```ts
function trimOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
```

Это очень важная привычка проекта: пустые строки нормализуются, даты сериализуются, nullable-поля приводятся к предсказуемому виду.

### 7.10. Локальные DTO внутри компонента

Компоненты часто объявляют типы прямо в файле:

```ts
type Specialist = {
  id: string;
  safeId: string;
  nickname: string;
};
```

Это нормально, когда:

- тип нужен только одному экрану;
- нет смысла выносить его в общий контракт;
- тип отражает именно view-модель, а не domain model.

### 7.11. Когда тип нужно выносить в `src/contracts`

В `src/contracts` выносятся типы, которые служат стабильной границей между подсистемами:

- AI contracts
- community DTO
- recommendations
- feedback / requests

Выноси туда тип, если:

- он должен быть общим для клиента и сервера;
- он выражает публичный формат API;
- он нужен нескольким слоям сразу.

### 7.12. React Query и generic types

Типичный паттерн:

```ts
const { data } = useQuery({
  queryKey: ["community-overview"],
  queryFn: () => fetcher<CommunityOverviewDto>("/api/community/overview")
});
```

Где:

- `fetcher<T>()` типизирует JSON-ответ;
- `useQuery` получает уже точный тип `data`.

Это очень важный навык: дженерик у fetch-helper часто даёт больше пользы, чем явный generic у `useQuery`.

### 7.13. Union-driven UI

В проекте много UI, завязанного на enum или string union:

```ts
function getWorkbenchStateLabel(state: TrackWorkbenchState) {
  switch (state) {
    case "STUCK":
      return "Застрял";
    case "NEEDS_FEEDBACK":
      return "Нужен фидбек";
    default:
      return "В работе";
  }
}
```

Такие функции:

- централизуют перевод и label mapping;
- уменьшают хаос в JSX;
- делают поведение предсказуемым.

### 7.14. Транзакции и типовая безопасность

В проекте часто используется:

```ts
await prisma.$transaction(async (tx) => {
  // несколько связанных операций
});
```

Зачем:

- создать запись;
- записать action-log;
- создать achievement;
- обновить связанные сущности;
- не оставить БД в полусломанном состоянии.

Главное правило чтения: если операция меняет несколько сущностей, почти наверняка стоит искать `$transaction`.

### 7.15. Практический чеклист по TypeScript для этого проекта

Если пишешь новый код, держись таких правил:

1. Любой внешний JSON валидируй через `zod`.
2. Любой нетривиальный `include/select` описывай отдельно и типизируй через `satisfies`.
3. Prisma-records не отдавай напрямую в UI, а сериализуй.
4. Строковые статусы, режимы и роли оформляй как union или enum.
5. Пустые строки нормализуй.
6. Даты на клиент отправляй в ISO-строках.
7. Общие API DTO выноси в `src/contracts`.

---

## 8. Auth и доступ

### NextAuth

`src/lib/auth.ts` конфигурирует `CredentialsProvider`.

Процесс входа:

1. Пользователь вводит email и пароль на `/signin`.
2. `signIn("credentials")` идёт в `next-auth`.
3. `authorize()` ищет пользователя через Prisma.
4. Пароль сверяется через `bcrypt.compare`.
5. В JWT и session пробрасываются `id` и `role`.

### Server auth

`src/lib/server-auth.ts` даёт `requireUser()`.

Он:

- читает session через `getServerSession(authOptions)`;
- достаёт `user.id`;
- перепроверяет пользователя в БД;
- бросает `apiError(401, ...)`, если сессия невалидна.

Это критично: наличие session в cookie не считается достаточным. Система дополнительно убеждается, что пользователь реально существует.

### Client auth behavior

`src/lib/client-fetch.ts` делает redirect на `/signin`, если API вернул `401`.

### Роли

Роли лежат в Prisma enum `UserRole`:

- `ARTIST`
- `SPECIALIST`
- `STUDIO`
- `ADMIN`

Особенно важно:

- `learn` доступен только `ARTIST`;
- `find` и `requests` работают вокруг связки артист ↔ специалист;
- community затрагивает несколько ролей, но смысл системы всё равно центрирован вокруг артистского пути.

---

## 9. API-слой и обработка ошибок

### `withApiHandler`

`src/lib/api.ts` задаёт единый формат сервера:

- `ApiError`
- `apiError(status, message, details?)`
- `parseJsonBody`
- `withApiHandler`

### Почему это важно

Без такого слоя каждый route handler:

- по-разному обрабатывал бы ошибки;
- по-разному отвечал бы на Prisma-конфликты;
- по-разному валидировал бы body.

Здесь всё стандартизировано:

- `P2025` -> `404`
- `P2002` -> `409`
- непойманная ошибка -> `500`

### Практический вывод

Если ищешь, "почему фронт получил такой текст ошибки", почти всегда смотри:

1. `src/lib/api.ts`
2. конкретный `route.ts`
3. `readApiErrorMessage()` в `src/lib/client-fetch.ts`

---

## 10. База данных и Prisma-модель

Source of truth доменной модели: `prisma/schema.prisma`.

### Крупные группы сущностей

#### Пользователь и идентичность

- `User`
- `ArtistIdentityProfile`
- `ArtistWorldProject`
- `ArtistWorldReference`
- `ArtistWorldVisualBoard`
- `ArtistWorldVisualBoardImage`

#### PATH / daily loop / home

- `PathStage`
- `DailyCheckIn`
- `DailyMicroStep`
- `WeeklyActivity`
- `DailyFocus`
- `DailyTrackFocus`
- `DailyWrapUp`
- `UserOnboardingState`

#### Goals

- `ArtistGoal`
- `GoalPillar`
- `GoalTask`

#### Songs и release pipeline

- `Folder`
- `Project`
- `Track`
- `TrackIntent`
- `Demo`
- `TrackDistributionRequest`
- `TrackNextStep`
- `DemoVersionReflection`

#### Feedback

- `FeedbackRequest`
- `FeedbackItem`
- `FeedbackResolution`

#### Find / Requests

- `SpecialistProfile`
- `InAppRequest`
- `InAppRequestAction`

#### Learn

- `LearnMaterial`
- `LearnMaterialProgress`

#### Community

- `CommunityPost`
- `CommunityLike`
- `CommunityEvent`
- `CommunityEventAttendance`
- `CommunityAchievement`
- `CommunityFeedbackThread`
- `CommunityFeedbackReply`
- `Friendship`

### Как читать Prisma-схему

Не читай `schema.prisma` как один сплошной файл. Разбивай так:

1. enums;
2. core user/profile models;
3. songs/workspace models;
4. goals and home loop;
5. feedback/community/learn.

### Зачем смотреть миграции

`prisma/migrations/*` — это история эволюции продукта. По названиям миграций видно, как росла система:

- `community_mvp`
- `artist_world_site_builder`
- `track_workbench_core_loop`
- `feedback_layer`
- `learn_in_workflow`
- `ai_ready_infrastructure`

Это помогает понять не только "что есть", но и "в каком порядке это возникало".

---

## 11. Today, Command Center и day loop

Главный экран сейчас не просто "дашборд", а командный центр.

### Ключевые файлы

- `src/app/today/page.tsx`
- `src/components/home/command-center-page.tsx`
- `src/app/api/home/overview/route.ts`
- `src/app/api/home/today-focus/route.ts`
- `src/lib/day-loop.ts`
- `src/lib/artist-growth.ts`
- `src/lib/recommendations.ts`
- `src/lib/path-stages.ts`

### Что делает `/api/home/overview`

Этот handler собирает несколько срезов сразу:

- текущую PATH-стадию пользователя;
- daily check-in;
- micro-step;
- weekly activity;
- onboarding checklist;
- command center;
- day loop.

То есть это не "одна таблица -> один ответ", а агрегирующий endpoint.

### Почему это важно

Если экран показывает много блоков, не значит, что у него много endpoints. В этом проекте часто делают один orchestration-endpoint, который собирает несколько вычислений на сервере.

### Day loop

`src/lib/day-loop.ts` отвечает за:

- current daily track focus;
- daily wrap-up;
- список активных workshop tracks.

Фактически day loop это рабочий цикл над треками внутри дня.

### Today focus

`src/app/api/home/today-focus/route.ts` умеет:

- вручную закреплять задачу на сегодня;
- отмечать фокус выполненным;
- синхронно обновлять статус goal task.

Это важный паттерн проекта: действие над одной сущностью часто меняет вторую связанную сущность.

Пример:

- `DailyFocus.isCompleted = true`
- `GoalTask.status = DONE`

### Recommendations

`src/lib/recommendations.ts` не является AI-системой. Это инфраструктура карточек-рекомендаций и их event logging:

- source labels;
- future AI slot;
- dedupe view events;
- отправка событий на `/api/recommendations/events`.

То есть recommendation layer уже строится как отдельная система, даже когда часть карточек ещё purely system-driven.

---

## 12. Goals и artist growth

Это один из самых важных доменных центров проекта.

### Ключевые файлы

- `src/app/api/goals/route.ts`
- `src/app/api/goals/[id]/route.ts`
- `src/app/api/goals/[id]/tasks/route.ts`
- `src/lib/goals/templates.ts`
- `src/lib/goals/trajectory.ts`
- `src/lib/goals/daily-focus.ts`
- `src/lib/goals/diagnostics.ts`
- `src/lib/goals/types.ts`
- `src/lib/artist-growth.ts`
- `src/lib/id-integration.ts`

### Модель

Goal-система строится так:

- у пользователя есть `ArtistGoal`;
- цель состоит из `GoalPillar`;
- в каждом pillar лежат `GoalTask`.

Каждая цель имеет:

- тип;
- статус;
- primary-флаг;
- target date;
- success definition;
- связь со стадией пути, из которой она была создана.

### Шаблоны целей

`src/lib/goals/templates.ts` создаёт структуры задач исходя из:

- типа цели;
- stage order;
- миссии;
- identity statement;
- audience context.

Это означает: цель генерируется не пустой, а стартует из доменного шаблона.

### Trajectory review

В `src/lib/goals/trajectory.ts` вычисляется health траектории:

- balanced / craft-heavy / creative-heavy;
- centered / scattered;
- delivering / at risk / no finishing.

Это уже слой product intelligence: система не просто хранит задачи, а оценивает паттерн движения.

### Identity bridge

`src/lib/id-integration.ts` связывает Goal и Track с Artist World. Это очень важная мысль архитектуры:

- `ID` не отдельный "профиль ради профиля";
- он влияет на goals, today focus и tracks.

То есть профиль артиста используется как operational context.

### Практический вывод

Если хочешь понять product core, читай не с `Songs`, а с `artist-growth.ts`. Именно там видна попытка связать:

- identity,
- goal,
- task,
- today focus,
- diagnostics,
- recommendations.

---

## 13. Songs: workspace, проекты, треки, демо, workbench

Это самая насыщенная подсистема.

### Ключевые файлы

- `src/app/songs/page.tsx`
- `src/app/songs/[id]/page.tsx`
- `src/app/api/songs/route.ts`
- `src/app/api/songs/[id]/route.ts`
- `src/app/api/projects/*`
- `src/app/api/folders/*`
- `src/app/api/workspace/nodes/route.ts`
- `src/components/songs/workspace-browser.tsx`
- `src/lib/workspace-tree.ts`
- `src/lib/track-workbench.ts`
- `src/lib/song-stages.ts`
- `src/lib/songs-version-stage-map.ts`
- `src/lib/distribution-request.ts`
- `src/lib/audio/analysis.ts`

### 13.1. Workspace-структура

Workspace состоит из:

- папок;
- проектов;
- треков;
- демо и версий.

Папки поддерживают вложенность, но не бесконечную. `src/lib/workspace-tree.ts` явно ограничивает глубину:

- `MAX_FOLDER_DEPTH = 3`

И там же лежат функции:

- расчёт глубины;
- breadcrumbs;
- сбор subtree;
- защита от циклов;
- проверка допустимости move/create.

Это пример хорошего domain utility-модуля: правила дерева инкапсулированы отдельно от UI и HTTP.

### 13.2. Track как центральная сущность

Track в проекте не равен просто "аудиофайлу". У трека есть:

- title;
- lyrics;
- path stage;
- workbench state;
- intent;
- active next step;
- feedback summary;
- primary demo;
- distribution request;
- project relation;
- identity bridge.

Фактически Track — это operational object, вокруг которого строится креативный цикл.

### 13.3. Workbench

`src/lib/track-workbench.ts` это не просто helper. Это слой сериализации и доменных представлений трека:

- `trackListInclude`
- `trackDetailInclude`
- `dayLoopTrackInclude`
- `serializeTrackListItem`
- `serializeTrackDetail`
- `serializeDailyTrackFocus`
- `serializeDailyWrapUp`
- label mapping workbench state

Очень важный принцип: UI Songs почти никогда не работает с "сырым Prisma треком". Он работает с serialized DTO из workbench-слоя.

### 13.4. Создание трека

`POST /api/songs` умеет:

- создать трек;
- опционально привязать folder/project;
- при отсутствии project автоматически создать single-project;
- синхронизировать название single-проекта с треком;
- создать community achievement.

Это классический пример доменного endpoint, где одно действие пользователя запускает несколько побочных следствий.

### 13.5. Обновление трека

`PATCH /api/songs/[id]` умеет:

- менять title;
- двигать между folder/project;
- менять primary demo;
- обновлять path stage;
- менять lyrics;
- менять workbench state;
- создавать/обновлять/удалять track intent;
- обновлять project.updatedAt;
- создавать achievement "вернулся к треку" при специальных условиях.

Это важная мысль: PATCH тут не "просто обновление формы", а набор бизнес-правил.

### 13.6. Демо-версии

Enum `DemoVersionType`:

- `IDEA_TEXT`
- `DEMO`
- `ARRANGEMENT`
- `NO_MIX`
- `MIXED`
- `MASTERED`
- `RELEASE`

Это скелет музыкального pipeline.

### 13.7. Связь стадий и версий

`src/lib/songs-version-stage-map.ts` и `src/lib/song-stages.ts` связывают:

- продуктовые PATH-этапы;
- музыкальные стадии;
- тип версии демо.

То есть переход трека по этапам — это не произвольные строки, а нормализованная модель.

### 13.8. Distribution request

На detail-странице трека живёт релизный слой:

- форма дистрибуции;
- поля для release metadata;
- master demo;
- release date;
- distributor.

`src/lib/distribution-request.ts` даёт:

- DTO;
- options;
- label mappings.

### 13.9. Audio analysis

`src/lib/audio/analysis.ts` делает MVP-анализ аудио прямо в браузере:

- оценка BPM;
- оценка тональности;
- confidence;
- method version.

Это показательный кусок кода: в проекте есть не только CRUD, но и прикладная signal processing логика.

### 13.10. Multi-track recorder

Audio UI разбит на специализированные компоненты:

- `multi-track-recorder.tsx`
- `use-multi-track-recorder.ts`
- `audio-waveform-player.tsx`
- `recorder-transport.tsx`
- `recorder-fx-panel.tsx`

Это означает, что `Songs` — это не просто файловый каталог, а полноценный рабочий инструмент.

---

## 14. Find и In-App Requests

### Ключевые файлы

- `src/app/find/page.tsx`
- `src/app/api/hub/specialists/route.ts`
- `src/app/api/requests/route.ts`
- `src/app/api/requests/[id]/action/route.ts`
- `src/app/api/requests/request-utils.ts`
- `src/lib/in-app-requests.ts`

### Что такое Find

Это каталог специалистов и студий с фильтрами:

- service/category;
- city;
- availability;
- online/offline;
- budget;
- credits;
- contacts.

### Что такое In-App Request

Заявка это отдельная сущность с:

- типом;
- статусом;
- артистом;
- специалистом;
- треком;
- демо;
- brief;
- датой старта;
- remote/city контекстом;
- action-логом.

### Паттерн создания заявки

`POST /api/requests`:

1. валидирует body;
2. проверяет, что нельзя писать самому себе;
3. проверяет, что specialist существует;
4. проверяет валидность track/demo;
5. создаёт `InAppRequest`;
6. создаёт `InAppRequestAction` типа `SUBMIT`;
7. создаёт achievement.

То есть заявка здесь — не письмо и не внешний webhook, а first-class object внутри домена.

### Что важно в UI

`src/app/find/page.tsx` делает две большие вещи:

- каталог специалистов;
- вкладку с собственными заявками.

Это удобно как пример mixed-screen, где один экран работает сразу с двумя доменными потоками.

---

## 15. Learn: каталог и контекстный workflow

### Ключевые файлы

- `src/app/learn/page.tsx`
- `src/app/learn/[slug]/page.tsx`
- `src/app/api/learn/materials/route.ts`
- `src/app/api/learn/materials/[slug]/route.ts`
- `src/app/api/learn/materials/[slug]/progress/route.ts`
- `src/app/api/learn/context/route.ts`
- `src/lib/learn/repository.ts`
- `src/lib/learn/context.ts`
- `src/lib/learn/filtering.ts`
- `src/lib/learn/progress.ts`
- `src/lib/learn/providers.ts`
- `src/components/learn/*`

### Главная идея

Learn в текущем состоянии это не "CMS с уроками". Это curated catalog + context layer.

### Repository layer

`src/lib/learn/repository.ts` отвечает за:

- чтение материалов из БД;
- преобразование Prisma `LearnMaterial` в public record;
- соединение материалов с user progress;
- фильтрацию каталога.

### Context layer

`src/lib/learn/context.ts` делает намного более интересную работу:

- смотрит на stage;
- смотрит на goal;
- смотрит на track workbench state;
- смотрит на problem types;
- исключает уже применённые или временно скрытые материалы;
- считает score;
- выдаёт context block.

То есть Learn уже встроен в основной workflow, а не существует отдельно.

### Artist-only access

`src/app/learn/[slug]/page.tsx` явно проверяет:

- есть ли сессия;
- является ли пользователь артистом.

Это хороший пример серверной page-guard логики.

### Progress

Материал может быть:

- открыт;
- отложен на потом;
- помечен как нерелевантный;
- применён.

Это важно: каталог строится не вокруг "прочитал/не прочитал", а вокруг usefulness in workflow.

---

## 16. ID и Artist World

### Ключевые файлы

- `src/app/id/page.tsx`
- `src/app/api/id/route.ts`
- `src/app/api/id/avatar/route.ts`
- `src/app/api/id/world/assets/route.ts`
- `src/app/api/id/world/onboarding/route.ts`
- `src/lib/artist-world.ts`
- `src/lib/artist-growth.ts`
- `src/components/id/*`

### Что такое ID в архитектуре

`ID` это не "настройки аккаунта". Это operational profile артиста:

- nickname;
- safeId;
- links;
- avatar;
- mission;
- identity statement;
- philosophy;
- values;
- themes;
- aesthetics;
- fashion signals;
- audience core;
- differentiator;
- playlist;
- visual boards;
- block ordering и visibility.

### Почему Artist World важен

Он влияет на:

- goal templates;
- goal identity bridge;
- track identity bridge;
- diagnostics;
- command center.

То есть Artist World участвует в продуктовой логике, а не только в витрине профиля.

### Нормализация

`src/lib/artist-world.ts` — очень важный модуль. Он задаёт:

- canonical block ids;
- default order;
- theme presets;
- background modes;
- normalizers;
- visual board guarantees;
- readiness helpers.

Пример ключевого паттерна:

```ts
export function normalizeArtistWorldPayload(input: ArtistWorldInput) {
  return {
    mission: trimOrNull(input.mission),
    values: uniqueStrings(input.values),
    worldBlockOrder: normalizeBlockIds(input.worldBlockOrder),
    visualBoards: ensureArtistWorldVisualBoards(input.visualBoards)
  };
}
```

То есть вход из UI сначала canonicalize-нормализуется, и только потом пишется в БД.

### PATCH `/api/id`

Этот endpoint один из самых насыщенных в проекте. Он:

- валидирует данные;
- нормализует ссылки;
- мерджит новые данные с existing profile;
- upsert-ит `ArtistIdentityProfile`;
- обновляет связанные коллекции `projects`, `references`, `visualBoards`.

Это пример сложного write-model endpoint.

### UI страницы

`src/app/id/page.tsx` — большая клиентская форма-редактор. Там видны важные паттерны:

- локальные draft states;
- преобразование строк в массивы;
- drag-and-drop block ordering;
- autosave-ish подход;
- preview and editor together.

---

## 17. Community

### Ключевые файлы

- `src/app/community/page.tsx`
- `src/app/community/creators/[safeId]/page.tsx`
- `src/app/api/community/*`
- `src/lib/community/service.ts`
- `src/lib/community/achievements.ts`
- `src/contracts/community.ts`
- `src/components/community/*`

### Что делает community-система

Она объединяет:

- профиль креатора;
- friendships;
- achievements feed;
- events;
- likes;
- feedback threads;
- social support around music workflow.

### Service layer

`src/lib/community/service.ts` — один из самых больших доменных сервисов. Он делает:

- cursor pagination;
- actor DTO mapping;
- like summaries;
- event DTO;
- post DTO;
- feedback thread DTO;
- friendship state;
- overview counters.

Это отличный файл для понимания того, как в проекте строят насыщенные DTO из нескольких таблиц.

### Achievements

Achievements создаются не только в community-разделе. Их создают и другие доменные потоки:

- трек создан;
- демо загружено;
- заявка отправлена;
- артист вернулся к треку.

Это значит, что community — это не изолированная соцсеть, а событийный слой поверх основного продукта.

### Events

Community events имеют:

- attendance;
- like summary;
- online/offline mode;
- host label.

На UI это видно в `src/components/community/community-page.tsx`.

---

## 18. AI-слой

### Ключевые файлы

- `src/app/api/ai/navigation/suggest/route.ts`
- `src/app/api/ai/support/respond/route.ts`
- `src/lib/ai/config.ts`
- `src/lib/ai/provider.ts`
- `src/lib/ai/navigation-service.ts`
- `src/lib/ai/support-service.ts`
- `src/lib/ai-service.ts`
- `src/contracts/ai-navigation.ts`
- `src/contracts/ai-support.ts`

### Как AI встроен

AI в проекте сделан как опциональный runtime-layer.

Проверка:

1. route получает пользователя;
2. читает `getAiRuntimeConfig()`;
3. если AI выключен, отвечает `403`;
4. если включён, валидирует input по контракту;
5. вызывает сервис.

Это правильный паттерн для feature-flagged AI:

- contracts отдельно;
- config отдельно;
- provider abstraction отдельно;
- route thin.

### Важная мысль

Даже когда AI выключен, структура вокруг него уже real:

- есть DTO;
- есть маршруты;
- есть сервисы;
- есть telemetry и safety-модули.

Это значит, что AI не "прибит сбоку", а заранее включён в архитектуру.

---

## 19. Общие UI-паттерны

### Базовые UI-компоненты

В `src/components/ui` лежат:

- `button`
- `card`
- `badge`
- `input`
- `textarea`
- `select`
- `modal`
- `toast`
- `inline-action-message`

Их задача:

- стабилизировать look and feel;
- не размножать низкоуровневую разметку;
- упростить экраны.

### Экран как composition root

Практически каждый большой экран делает так:

1. описывает локальные типы;
2. поднимает query/mutation;
3. держит локальный form state;
4. использует `Card`, `Button`, `Badge`, `Modal`;
5. рендерит DTO.

Это делает страницы крупными, но читаемыми: доменный сценарий обычно находится в одном файле экрана.

### Toast и inline error handling

Проект использует две формы обратной связи:

- `toast` для действия;
- `InlineActionMessage` для состояния экрана или блока.

---

## 20. Качество, тесты, CI

### Скрипты

Из `package.json`:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e:smoke`

### Что тестируется

В `src/lib` уже есть unit-level тесты для:

- API helpers
- diagnostics
- artist world
- audio analysis
- fx chain
- community service

То есть проект проверяет не только UI, а именно доменные функции и инфраструктурные helper-модули.

### CI

`.github/workflows/ci.yml` прогоняет:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. `npx prisma migrate deploy`
7. `npm run prisma:seed`
8. `npm run start`
9. `npm run test:e2e:smoke`

Это означает: репозиторий проверяется не только на синтаксис, но и на жизнеспособность после миграций и сида.

---

## 21. Как реально изучать код, чтобы понимать его "как автор"

Ниже лучший маршрут чтения.

### Этап 1. Понять каркас

Открой:

- `package.json`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `middleware.ts`
- `src/lib/prisma.ts`
- `src/lib/api.ts`
- `src/lib/client-fetch.ts`
- `src/lib/auth.ts`
- `src/lib/server-auth.ts`

После этого ты поймёшь:

- как стартует приложение;
- как устроен auth;
- как устроены API;
- как работает Prisma;
- как клиент разговаривает с сервером.

### Этап 2. Понять доменную модель

Открой:

- `prisma/schema.prisma`
- `src/lib/path-stages.ts`
- `src/lib/artist-world.ts`
- `src/lib/track-workbench.ts`
- `src/lib/goals/templates.ts`

После этого ты увидишь:

- главные сущности;
- какие enum управляют системой;
- как артиста связывают с целями и треками.

### Этап 3. Понять Today и Goals

Открой:

- `src/app/api/home/overview/route.ts`
- `src/app/api/home/today-focus/route.ts`
- `src/lib/day-loop.ts`
- `src/lib/artist-growth.ts`
- `src/lib/goals/trajectory.ts`

Это даст тебе product core.

### Этап 4. Понять Songs

Открой:

- `src/app/api/songs/route.ts`
- `src/app/api/songs/[id]/route.ts`
- `src/components/songs/workspace-browser.tsx`
- `src/app/songs/[id]/page.tsx`
- `src/lib/workspace-tree.ts`
- `src/lib/track-workbench.ts`
- `src/lib/audio/analysis.ts`

Это даст тебе самую активную operational часть продукта.

### Этап 5. Понять контекстные слои

Открой:

- `src/lib/learn/context.ts`
- `src/lib/community/service.ts`
- `src/lib/id-integration.ts`
- `src/lib/recommendations.ts`

Тут видно, как отдельные зоны продукта начинают работать как одна система.

---

## 22. Что важно запомнить как главный итог

Если сжать весь репозиторий до нескольких тезисов, получится так:

1. Это monorepo-style Next.js приложение, где UI, API и доменная логика живут рядом.
2. Реальная бизнес-логика вынесена не в страницы, а в `src/lib`.
3. Prisma-сущности не отдаются напрямую в UI, а сериализуются в DTO.
4. `zod` защищает серверную границу.
5. Today, Goals, Songs, ID, Learn, Find, Community и AI связаны между собой, а не существуют отдельно.
6. Artist identity используется как operational context для целей, задач, треков и рекомендаций.
7. Songs — это не каталог файлов, а рабочая система прогресса трека.
8. Community — это событийный слой, встроенный в остальной продукт.
9. Learn — это не просто библиотека, а контекстный помощник в workflow.
10. TypeScript здесь используется не ради типизации "вообще", а для фиксации архитектурных границ.

---

## 23. Короткая шпаргалка по файлам

Если нужно быстро вспомнить, где что лежит:

- Auth: `src/lib/auth.ts`, `src/lib/server-auth.ts`, `src/app/signin/page.tsx`
- API base: `src/lib/api.ts`, `src/lib/client-fetch.ts`
- Prisma: `src/lib/prisma.ts`, `prisma/schema.prisma`
- Today/Home: `src/app/api/home/*`, `src/components/home/*`, `src/lib/day-loop.ts`
- Goals: `src/app/api/goals/*`, `src/lib/goals/*`, `src/lib/artist-growth.ts`
- Songs: `src/app/api/songs/*`, `src/app/api/projects/*`, `src/app/api/folders/*`, `src/lib/track-workbench.ts`
- Find: `src/app/find/page.tsx`, `src/app/api/hub/specialists/route.ts`, `src/app/api/requests/*`
- Learn: `src/app/learn/*`, `src/lib/learn/*`
- ID: `src/app/id/page.tsx`, `src/app/api/id/route.ts`, `src/lib/artist-world.ts`
- Community: `src/app/community/*`, `src/app/api/community/*`, `src/lib/community/service.ts`
- AI: `src/app/api/ai/*`, `src/lib/ai/*`, `src/contracts/ai-*`

---

## 24. Как поддерживать эту методичку актуальной

Обновляй этот файл, если меняется хотя бы одно из:

- крупная подсистема;
- схема БД;
- auth flow;
- глобальный request flow;
- структура goal/track/identity связей;
- Learn / Community / AI contracts;
- CI и quality pipeline.

Минимальное правило: если ты добавил новую доменную сущность или новый workflow, в методичке должно появиться объяснение:

1. зачем это существует;
2. где лежит код;
3. какие файлы являются входной точкой;
4. как это связано с остальной системой.

Тогда документ останется не "конспектом", а настоящей картой проекта.
