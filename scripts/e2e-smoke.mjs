import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const artistEmail = process.env.ARTIST_EMAIL ?? "demo@artsafehub.app";
const artistPassword = process.env.ARTIST_PASSWORD ?? "demo1234";
const specialistEmail = process.env.SPECIALIST_EMAIL ?? "smoke-specialist@artsafehub.app";

class CookieJar {
  #cookies = new Map();

  setFromHeader(setCookieValue) {
    const cookiePair = setCookieValue.split(";")[0] ?? "";
    const separatorIndex = cookiePair.indexOf("=");
    if (separatorIndex <= 0) return;
    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();
    if (!name) return;
    this.#cookies.set(name, value);
  }

  updateFromResponse(response) {
    const headerValues = getSetCookieHeaders(response.headers);
    for (const headerValue of headerValues) {
      this.setFromHeader(headerValue);
    }
  }

  toHeaderValue() {
    if (!this.#cookies.size) return "";
    return Array.from(this.#cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const merged = headers.get("set-cookie");
  if (!merged) return [];
  return merged.split(/,(?=\s*[^;=]+=[^;]+)/g);
}

async function parseJsonResponse(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function assertOk(response, payload, fallbackMessage) {
  if (response.ok) return;
  const payloadError =
    payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : null;
  const rawBody =
    payload && typeof payload === "object" && "raw" in payload && typeof payload.raw === "string" ? payload.raw : null;
  throw new Error(`${fallbackMessage} (${response.status})${payloadError ? `: ${payloadError}` : rawBody ? `: ${rawBody}` : ""}`);
}

async function ensureSpecialistUser() {
  const passwordHash = await bcrypt.hash("smoke-specialist-password", 8);

  const user = await prisma.user.upsert({
    where: { email: specialistEmail },
    create: {
      email: specialistEmail,
      passwordHash,
      nickname: "Smoke Specialist",
      role: "SPECIALIST"
    },
    update: {
      role: "SPECIALIST",
      nickname: "Smoke Specialist"
    },
    select: { id: true }
  });

  await prisma.specialistProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      category: "AUDIO_ENGINEER",
      city: "Moscow",
      isOnline: true,
      isAvailableNow: true,
      services: ["Сведение", "Мастеринг"],
      credits: ["Smoke E2E"],
      portfolioLinks: [],
      budgetFrom: 5000
    },
    update: {
      category: "AUDIO_ENGINEER",
      city: "Moscow",
      isOnline: true,
      isAvailableNow: true,
      services: ["Сведение", "Мастеринг"],
      credits: ["Smoke E2E"],
      budgetFrom: 5000
    }
  });

  return user.id;
}

function createSilentWavBlob({ durationSec = 1, sampleRate = 8000 } = {}) {
  const sampleCount = Math.max(1, Math.floor(durationSec * sampleRate));
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: "audio/wav" });
}

async function run() {
  const specialistUserId = await ensureSpecialistUser();
  const cookies = new CookieJar();

  async function fetchWithCookies(path, init = {}) {
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(init.headers ?? {});
    const cookieHeader = cookies.toHeaderValue();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    const response = await fetch(url, { ...init, headers, redirect: init.redirect ?? "manual" });
    cookies.updateFromResponse(response);
    return response;
  }

  const csrfResponse = await fetchWithCookies("/api/auth/csrf");
  const csrfPayload = await parseJsonResponse(csrfResponse);
  assertOk(csrfResponse, csrfPayload, "Не удалось получить CSRF токен");
  if (!csrfPayload?.csrfToken) {
    throw new Error("CSRF токен отсутствует в ответе /api/auth/csrf");
  }

  const loginBody = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email: artistEmail,
    password: artistPassword,
    callbackUrl: `${baseUrl}/today`,
    json: "true"
  });
  const loginResponse = await fetchWithCookies("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody.toString()
  });
  const loginPayload = await parseJsonResponse(loginResponse);
  if (!(loginResponse.ok || loginResponse.status === 302)) {
    assertOk(loginResponse, loginPayload, "Не удалось выполнить login");
  }

  const sessionResponse = await fetchWithCookies("/api/auth/session");
  const sessionPayload = await parseJsonResponse(sessionResponse);
  assertOk(sessionResponse, sessionPayload, "Не удалось загрузить session");
  if (!sessionPayload?.user?.email) {
    throw new Error("После login не получена активная session.");
  }

  const stagesResponse = await fetchWithCookies("/api/songs/stages");
  const stagesPayload = await parseJsonResponse(stagesResponse);
  assertOk(stagesResponse, stagesPayload, "Не удалось загрузить этапы треков");
  const stages = Array.isArray(stagesPayload) ? stagesPayload : [];
  const demoStage = stages.find((stage) => typeof stage?.name === "string" && stage.name.toLowerCase().includes("демо"));
  const stageId = demoStage?.id ?? stages[0]?.id ?? null;
  if (!stageId) {
    throw new Error("Не найден stage для создания тестового трека.");
  }

  const titleSuffix = Date.now();
  const createSongResponse = await fetchWithCookies("/api/songs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `Smoke Song ${titleSuffix}`,
      lyricsText: "Smoke test lyrics",
      pathStageId: stageId
    })
  });
  const createSongPayload = await parseJsonResponse(createSongResponse);
  assertOk(createSongResponse, createSongPayload, "Не удалось создать трек");
  const trackId = createSongPayload?.id;
  if (!trackId) {
    throw new Error("API /api/songs не вернул track id.");
  }

  const formData = new FormData();
  formData.append("trackId", trackId);
  formData.append("durationSec", "1");
  formData.append("noteText", "smoke test version");
  formData.append("reflectionWhyMade", "Проверить рабочую мастерскую трека");
  formData.append("reflectionWhatChanged", "Загрузил первую тестовую демо-версию");
  formData.append("reflectionWhatNotWorking", "Нужен следующий шаг после загрузки");
  formData.append("versionType", "DEMO");
  formData.append("file", createSilentWavBlob(), `smoke-${titleSuffix}.wav`);

  const focusResponse = await fetchWithCookies("/api/home/track-focus", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trackId,
      focusNote: "Smoke focus on one active track",
      createNextStep: {
        title: "Проверить загрузку версии",
        detail: "Убедиться, что у трека появился активный шаг до вечернего wrap-up"
      }
    })
  });
  const focusPayload = await parseJsonResponse(focusResponse);
  assertOk(focusResponse, focusPayload, "Не удалось сохранить утренний фокус");
  if (!focusPayload?.track?.id && !focusPayload?.id) {
    throw new Error("API /api/home/track-focus не вернул focus payload.");
  }

  const uploadResponse = await fetchWithCookies("/api/audio-clips", {
    method: "POST",
    body: formData
  });
  const uploadPayload = await parseJsonResponse(uploadResponse);
  assertOk(uploadResponse, uploadPayload, "Не удалось загрузить демо-версию");
  const demoId = uploadPayload?.id;
  if (!demoId) {
    throw new Error("API /api/audio-clips не вернул demo id.");
  }

  const wrapUpResponse = await fetchWithCookies("/api/home/wrap-up", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trackId,
      focusId: focusPayload.id ?? null,
      endState: "READY_FOR_NEXT_STEP",
      whatChanged: "Сделал первую версию и сохранил контекст по ней",
      whatNotWorking: "Нужно проверить, что новый шаг закрепился у трека",
      nextStep: {
        title: "Отслушать демо и записать правки",
        detail: "Это должен быть единственный активный шаг после wrap-up"
      }
    })
  });
  const wrapUpPayload = await parseJsonResponse(wrapUpResponse);
  assertOk(wrapUpResponse, wrapUpPayload, "Не удалось завершить день");
  if (wrapUpPayload?.currentNextStep?.title !== "Отслушать демо и записать правки") {
    throw new Error("API /api/home/wrap-up не вернул новый активный следующий шаг.");
  }

  const overviewResponse = await fetchWithCookies("/api/home/overview");
  const overviewPayload = await parseJsonResponse(overviewResponse);
  assertOk(overviewResponse, overviewPayload, "Не удалось загрузить home overview");
  if (!overviewPayload?.dayLoop?.wrapUp?.nextStep?.title) {
    throw new Error("home/overview не содержит dayLoop.wrapUp.nextStep.");
  }

  const trackDetailResponse = await fetchWithCookies(`/api/songs/${trackId}`);
  const trackDetailPayload = await parseJsonResponse(trackDetailResponse);
  assertOk(trackDetailResponse, trackDetailPayload, "Не удалось загрузить детали трека");
  if (!trackDetailPayload?.workbenchState) {
    throw new Error("songs/[id] не вернул workbenchState.");
  }
  if (!trackDetailPayload?.activeNextStep?.title) {
    throw new Error("songs/[id] не вернул activeNextStep.");
  }
  const uploadedDemo = Array.isArray(trackDetailPayload?.demos) ? trackDetailPayload.demos.find((item) => item.id === demoId) : null;
  if (!uploadedDemo?.versionReflection?.whatChanged) {
    throw new Error("songs/[id] не вернул versionReflection для загруженной версии.");
  }

  const createRequestResponse = await fetchWithCookies("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "MIX_MASTER",
      specialistUserId,
      trackId,
      demoId,
      serviceLabel: "Сведение",
      brief: "Smoke request для проверки e2e потока",
      isRemote: true
    })
  });
  const createRequestPayload = await parseJsonResponse(createRequestResponse);
  assertOk(createRequestResponse, createRequestPayload, "Не удалось создать заявку в FIND");
  const requestId = createRequestPayload?.id;
  if (!requestId) {
    throw new Error("API /api/requests не вернул request id.");
  }

  const requestsListResponse = await fetchWithCookies("/api/requests?role=ARTIST");
  const requestsListPayload = await parseJsonResponse(requestsListResponse);
  assertOk(requestsListResponse, requestsListPayload, "Не удалось проверить список заявок");
  const listItems = Array.isArray(requestsListPayload?.items) ? requestsListPayload.items : [];
  const createdRequest = listItems.find((item) => item.id === requestId);
  if (!createdRequest) {
    throw new Error("Созданная заявка не найдена в /api/requests?role=ARTIST.");
  }

  console.log(
    `[e2e-smoke] success user=${sessionPayload.user.email} track=${trackId} demo=${demoId} request=${requestId} specialist=${specialistUserId}`
  );
}

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[e2e-smoke] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
