# ART SAFE PLACE

MVP‑приложение для артистов СНГ: путь от демо до релиза и промо через формулу `PATH + FIND + SONGS + SAFE ID`.

## Этап 0: Scope Freeze (MVP 1.0)

### Границы MVP (заморожено)
- `HOME` (PATH в центре)
- `FIND`
- `SONGS`
- `AI ASSIST` (только заглушка)
- `ID` (SAFE ID артиста)

### Явно исключено из MVP
- Жанры (`genres`) в продуктовой логике и UI
- Комментарии к трекам
- Отдельный раздел заметок (заметки живут внутри `SONGS` как демки/текст к демке)
- Активный AI‑чат и AI‑генерация контента (вкладка `AI ASSIST` недоступна в MVP)

## Acceptance Checklist (MVP)

MVP считается готовым, если артист может:
1. Залогиниться.
2. Увидеть `HOME` с кругом PATH и текущим уровнем.
3. Записать демо через диктофон и сохранить в `SONGS`.
4. Создать трек и прикрепить к нему демо + текст.
5. Выставить/увидеть этап трека.
6. Найти специалиста/студию в `FIND` и нажать `Связаться`.
7. Открыть `ID` и увидеть свой `SAFE ID`.

## Технологии
- Next.js (App Router) + TypeScript
- TailwindCSS + подход shadcn/ui
- Prisma ORM + PostgreSQL
- NextAuth (Credentials)
- TanStack Query

## Установка

### 1) Установить зависимости
```bash
npm install
```

### 2) Настроить окружение
```bash
cp .env.example .env
```

### 3) Запустить базу
```bash
docker-compose up -d db
```

### 4) Миграции и сиды
```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5) Запустить dev‑сервер
```bash
npm run dev
```

Демо‑доступ:
- **Email:** demo@artsafehub.app
- **Password:** demo1234

## Prisma и миграции
- Схема: `prisma/schema.prisma`
- Начальная миграция: `prisma/migrations/0001_init`

## Локальные загрузки файлов
Аудио‑клипы сохраняются в `./uploads` через storage key (относительный ключ), а не через абсолютный путь.
Слой хранения находится в `src/lib/storage.ts`.
- Валидация загрузок: whitelist MIME + лимит размера (`MAX_AUDIO_UPLOAD_BYTES`).
- Имя файла нормализуется и очищается перед сохранением.
- Для будущего S3 уже добавлен адаптерный класс `S3StorageProvider` с тем же контрактом `StorageProvider`.

## AI ASSIST в MVP
Вкладка `AI ASSIST` в MVP работает как заглушка:
- показывает статус `скоро появится`;
- не предоставляет активный чат;
- не используется для генерации текстов.

## Этап 8: Post-MVP Contracts (без реализации)
Для расширения без переделки ядра подготовлены технические контракты:
- `src/contracts/in-app-requests.ts` (in-app заявки)
- `src/contracts/ai-navigation.ts` (AI-навигация)
- `src/contracts/ai-support.ts` (AI-поддержка)
- `src/contracts/reviews.ts` (отзывы)
- `src/contracts/common.ts` (общие схемы)

Подробности: `docs/post-mvp-contracts.md`.

## Docker
Запуск всего стека:
```bash
docker-compose up --build
```

## Качество кода и CI
- ESLint конфиг зафиксирован в `.eslintrc.json` (без интерактивного мастера).
- Скрипты:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- CI (`.github/workflows/ci.yml`) запускает `lint + typecheck + build`.

### Опционально: pre-commit hook
```bash
npm run hooks:install
```
После установки перед коммитом будут выполняться `lint` и `typecheck`.

## Примечания
- Обратная связь и обсуждения проходят в Telegram (вне приложения).
- MVP ориентирован на веб; мобильный клиент появится позже.
