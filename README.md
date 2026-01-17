# ART SAFE HUB

Веб‑ориентированный MVP‑воркспейс для начинающих артистов в СНГ. Проект фокусируется на структурированном прогрессе трека и росте по PATH (не социальная лента и не DAW).

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
Аудио‑клипы сохраняются в `./uploads`. Слой хранения находится в `src/lib/storage.ts` и может быть заменён на S3 позже.

## Интеграция AI (заглушка)
AI‑интерфейс намеренно замокан.
- Интерфейс `AIProvider`: `src/lib/ai.ts`
- Мок‑реализация: `MockAIProvider`
- API:
  - `POST /api/assistant/message`
  - `POST /api/assistant/next-step`

Замените `MockAIProvider` на реальную реализацию в отдельном AI‑проекте без изменения UI/API‑контрактов.

## Docker
Запуск всего стека:
```bash
docker-compose up --build
```

## Примечания
- Обратная связь и обсуждения проходят в Telegram (вне приложения).
- MVP ориентирован на веб; мобильный клиент появится позже.
