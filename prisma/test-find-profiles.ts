import type { FindCategory, UserRole } from "@prisma/client";

export type FindTestProfile = {
  email: string;
  nickname: string;
  safeId: string;
  role: UserRole;
  category: FindCategory;
  city: string;
  metro?: string;
  isOnline: boolean;
  isAvailableNow: boolean;
  budgetFrom: number;
  bio: string;
  services: string[];
  credits: string[];
  portfolioLinks: string[];
  contactTelegram?: string;
  contactUrl?: string;
};

export const findTestProfiles: FindTestProfile[] = [
  {
    email: "producer@artsafehub.app",
    nickname: "Misha Prod",
    safeId: "SAFE-SP-001",
    role: "SPECIALIST",
    category: "PRODUCER",
    city: "Москва",
    metro: "Курская",
    isOnline: true,
    isAvailableNow: true,
    budgetFrom: 15000,
    bio: "Продюсер и аранжировщик. Делаю трек от идеи до финального референса.",
    services: ["Продакшн", "Аранжировка", "Саунд-дизайн"],
    credits: ["Marta Ray", "NEONVIBE", "KAIA"],
    portfolioLinks: ["https://example.com/misha-prod", "https://soundcloud.com/misha-prod"],
    contactTelegram: "https://t.me/misha_prod"
  },
  {
    email: "engineer@artsafehub.app",
    nickname: "Lena Mix",
    safeId: "SAFE-SP-002",
    role: "SPECIALIST",
    category: "AUDIO_ENGINEER",
    city: "Санкт-Петербург",
    metro: "Петроградская",
    isOnline: true,
    isAvailableNow: false,
    budgetFrom: 12000,
    bio: "Инженер сведения и мастеринга. Работаю с поп, инди и электроникой.",
    services: ["Сведение", "Мастеринг"],
    credits: ["AURA", "Maks Vento", "NIKA NOVA"],
    portfolioLinks: ["https://example.com/lena-mix", "https://mixing.example/lena"],
    contactTelegram: "https://t.me/lena_mix"
  },
  {
    email: "producer2@artsafehub.app",
    nickname: "Artem Pulse",
    safeId: "SAFE-SP-003",
    role: "SPECIALIST",
    category: "PRODUCER",
    city: "Москва",
    metro: "Савёловская",
    isOnline: true,
    isAvailableNow: true,
    budgetFrom: 18000,
    bio: "Продюсер в жанрах alt-pop и dance. Упор на хук, ритмику и драматургию трека.",
    services: ["Продакшн", "Song doctor", "Подготовка демо"],
    credits: ["Mona K", "Dari West", "RUDI"],
    portfolioLinks: ["https://example.com/artem-pulse"],
    contactTelegram: "https://t.me/artem_pulse"
  },
  {
    email: "engineer2@artsafehub.app",
    nickname: "Roman Glue",
    safeId: "SAFE-SP-004",
    role: "SPECIALIST",
    category: "AUDIO_ENGINEER",
    city: "Казань",
    metro: "Козья слобода",
    isOnline: true,
    isAvailableNow: true,
    budgetFrom: 10000,
    bio: "Микс-инженер. Уплотняю звук и собираю микс под стриминг.",
    services: ["Сведение", "Тюнинг вокала", "Стерео мастеринг"],
    credits: ["KRUZ", "MIA LANE"],
    portfolioLinks: ["https://example.com/roman-glue"],
    contactTelegram: "https://t.me/roman_glue"
  },
  {
    email: "studio@artsafehub.app",
    nickname: "Frame Studio",
    safeId: "SAFE-ST-001",
    role: "STUDIO",
    category: "RECORDING_STUDIO",
    city: "Алматы",
    metro: "Байконур",
    isOnline: false,
    isAvailableNow: true,
    budgetFrom: 8000,
    bio: "Студия записи для вокала и инструментов. Есть отдельная vocal booth.",
    services: ["Запись вокала", "Студийная смена", "Подкаст-сессия"],
    credits: ["KZ Flow", "Alem Beats", "Runa"],
    portfolioLinks: ["https://framestudio.example"],
    contactUrl: "https://framestudio.example"
  },
  {
    email: "studio2@artsafehub.app",
    nickname: "Neon Room",
    safeId: "SAFE-ST-002",
    role: "STUDIO",
    category: "RECORDING_STUDIO",
    city: "Москва",
    metro: "Белорусская",
    isOnline: false,
    isAvailableNow: false,
    budgetFrom: 2200,
    bio: "Студия с фокусом на rap/pop запись и вокальный продакшн.",
    services: ["Запись вокала", "Аренда студии", "Репетиция live-сета"],
    credits: ["LIL BERG", "SONIA RED", "PAVEL RO"],
    portfolioLinks: ["https://example.com/neon-room"],
    contactTelegram: "https://t.me/neon_room_studio",
    contactUrl: "https://example.com/neon-room"
  },
  {
    email: "studio3@artsafehub.app",
    nickname: "Tape House",
    safeId: "SAFE-ST-003",
    role: "STUDIO",
    category: "RECORDING_STUDIO",
    city: "Санкт-Петербург",
    metro: "Площадь Восстания",
    isOnline: false,
    isAvailableNow: true,
    budgetFrom: 2000,
    bio: "Уютная студия для сольных артистов и small-band сессий.",
    services: ["Запись вокала", "Запись гитары", "Сведение под ключ"],
    credits: ["Vera Sun", "Polina Sky", "North Kids"],
    portfolioLinks: ["https://example.com/tape-house"],
    contactTelegram: "https://t.me/tape_house"
  }
];
