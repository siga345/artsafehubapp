"use client";

import { ArtistWorldBackgroundMode, ArtistWorldThemePreset } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Link2, Save, Sparkles, Upload, UserRound } from "lucide-react";

import { ArtistWorldBlockManager } from "@/components/id/artist-world-block-manager";
import { ArtistWorldPreview, type ArtistWorldPreviewData } from "@/components/id/artist-world-preview";
import {
  ArtistWorldProjectEditor,
  type ArtistWorldProjectDraft
} from "@/components/id/artist-world-project-editor";
import {
  ArtistWorldReferenceEditor,
  type ArtistWorldReferenceDraft
} from "@/components/id/artist-world-reference-editor";
import { artistWorldThemeLabel } from "@/components/id/artist-world-theme-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  artistWorldBackgroundModeOptions,
  artistWorldBlockIds,
  artistWorldThemePresetOptions,
  defaultArtistWorldBlockOrder,
  type ArtistWorldBlockId
} from "@/lib/artist-growth";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

type IdProfile = {
  id: string;
  safeId: string;
  nickname: string;
  avatarUrl: string | null;
  links: unknown;
  artistWorld: ArtistWorldPreviewData & {
    blockOrder: ArtistWorldBlockId[];
    hiddenBlocks: ArtistWorldBlockId[];
  };
};

type Links = {
  bandlink: string;
};

function parseLinks(raw: unknown): Links {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { bandlink: "" };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.bandlink === "string" && obj.bandlink.trim()) return { bandlink: obj.bandlink };
  if (typeof obj.website === "string" && obj.website.trim()) return { bandlink: obj.website };
  return { bandlink: "" };
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

function joinLines(values: string[] | undefined) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function IdPage() {
  const toast = useToast();
  const { data, refetch } = useQuery({
    queryKey: ["id-profile"],
    queryFn: () => fetcher<IdProfile>("/api/id")
  });

  const links = useMemo(() => parseLinks(data?.links), [data?.links]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bandlink, setBandlink] = useState("");
  const [identityStatement, setIdentityStatement] = useState("");
  const [mission, setMission] = useState("");
  const [values, setValues] = useState("");
  const [philosophy, setPhilosophy] = useState("");
  const [coreThemes, setCoreThemes] = useState("");
  const [aestheticKeywords, setAestheticKeywords] = useState("");
  const [visualDirection, setVisualDirection] = useState("");
  const [audienceCore, setAudienceCore] = useState("");
  const [differentiator, setDifferentiator] = useState("");
  const [fashionSignals, setFashionSignals] = useState("");
  const [themePreset, setThemePreset] = useState<ArtistWorldThemePreset>(ArtistWorldThemePreset.EDITORIAL);
  const [backgroundMode, setBackgroundMode] = useState<ArtistWorldBackgroundMode>(ArtistWorldBackgroundMode.GRADIENT);
  const [backgroundColorA, setBackgroundColorA] = useState("#f8fbf4");
  const [backgroundColorB, setBackgroundColorB] = useState("#e5eddc");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [blockOrder, setBlockOrder] = useState<ArtistWorldBlockId[]>(defaultArtistWorldBlockOrder);
  const [hiddenBlocks, setHiddenBlocks] = useState<ArtistWorldBlockId[]>([]);
  const [references, setReferences] = useState<ArtistWorldReferenceDraft[]>([]);
  const [projects, setProjects] = useState<ArtistWorldProjectDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingWorldAsset, setUploadingWorldAsset] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!data || initialized) return;

    setNickname(data.nickname);
    setAvatarUrl(data.avatarUrl ?? "");
    setBandlink(links.bandlink);
    setIdentityStatement(data.artistWorld.identityStatement ?? "");
    setMission(data.artistWorld.mission ?? "");
    setValues(joinLines(data.artistWorld.values));
    setPhilosophy(data.artistWorld.philosophy ?? "");
    setCoreThemes(joinLines(data.artistWorld.coreThemes));
    setAestheticKeywords(joinLines(data.artistWorld.aestheticKeywords));
    setVisualDirection(data.artistWorld.visualDirection ?? "");
    setAudienceCore(data.artistWorld.audienceCore ?? "");
    setDifferentiator(data.artistWorld.differentiator ?? "");
    setFashionSignals(joinLines(data.artistWorld.fashionSignals));
    setThemePreset(data.artistWorld.themePreset);
    setBackgroundMode(data.artistWorld.backgroundMode);
    setBackgroundColorA(data.artistWorld.backgroundColorA ?? "#f8fbf4");
    setBackgroundColorB(data.artistWorld.backgroundColorB ?? "#e5eddc");
    setBackgroundImageUrl(data.artistWorld.backgroundImageUrl ?? "");
    setBlockOrder(data.artistWorld.blockOrder?.length ? data.artistWorld.blockOrder : defaultArtistWorldBlockOrder);
    setHiddenBlocks(data.artistWorld.hiddenBlocks ?? []);
    setReferences(
      data.artistWorld.references.map((item) => ({
        id: item.id,
        title: item.title ?? "",
        creator: item.creator ?? "",
        note: item.note ?? "",
        linkUrl: item.linkUrl ?? "",
        imageUrl: item.imageUrl ?? ""
      }))
    );
    setProjects(
      data.artistWorld.projects.map((item) => ({
        id: item.id,
        title: item.title ?? "",
        subtitle: item.subtitle ?? "",
        description: item.description ?? "",
        linkUrl: item.linkUrl ?? "",
        coverImageUrl: item.coverImageUrl ?? ""
      }))
    );
    setInitialized(true);
  }, [data, initialized, links.bandlink]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const visibleBlocksInOrder = blockOrder.filter((blockId) => !hiddenBlocks.includes(blockId));

  const previewData: ArtistWorldPreviewData = {
    identityStatement: identityStatement.trim() || null,
    mission: mission.trim() || null,
    values: splitLines(values),
    philosophy: philosophy.trim() || null,
    coreThemes: splitLines(coreThemes),
    aestheticKeywords: splitLines(aestheticKeywords),
    visualDirection: visualDirection.trim() || null,
    audienceCore: audienceCore.trim() || null,
    differentiator: differentiator.trim() || null,
    fashionSignals: splitLines(fashionSignals),
    themePreset,
    backgroundMode,
    backgroundColorA: backgroundColorA.trim() || null,
    backgroundColorB: backgroundColorB.trim() || null,
    backgroundImageUrl: backgroundImageUrl.trim() || null,
    references: references.map((item) => ({
      id: item.id,
      title: item.title.trim() || null,
      creator: item.creator.trim() || null,
      note: item.note.trim() || null,
      linkUrl: item.linkUrl.trim() || null,
      imageUrl: item.imageUrl.trim() || null
    })),
    projects: projects.map((item) => ({
      id: item.id,
      title: item.title.trim() || null,
      subtitle: item.subtitle.trim() || null,
      description: item.description.trim() || null,
      linkUrl: item.linkUrl.trim() || null,
      coverImageUrl: item.coverImageUrl.trim() || null
    }))
  };

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await apiFetch("/api/id/avatar", { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, "Не удалось загрузить аватар."));
    }

    const payload = (await response.json()) as { avatarUrl: string };
    setAvatarUrl(payload.avatarUrl);
  }

  async function uploadWorldAsset(kind: "background" | "project_cover" | "reference_image", file: File) {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("kind", kind);

    const response = await apiFetch("/api/id/world/assets", { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, "Не удалось загрузить файл для мира артиста."));
    }

    const payload = (await response.json()) as { url: string };
    return payload.url;
  }

  return (
    <div className="pb-8">
      <div className="grid gap-4 xl:grid-cols-[1.22fr_0.78fr]">
        <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
          <CardHeader className="mb-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="border-[#cbdab8] bg-[#f5faeb] text-[#4b6440]">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Мир артиста
              </Badge>
              <Badge className="border-brand-border bg-white/90 text-brand-muted">{artistWorldThemeLabel(themePreset)}</Badge>
              <Badge className="border-brand-border bg-white/90 text-brand-muted">{visibleBlocksInOrder.length} активных блоков</Badge>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl md:text-3xl">Мир артиста</CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  Не профиль, а внутренний мини-сайт: миссия, ценности, референсы, проекты и визуальный мир в одном месте.
                </CardDescription>
              </div>
              <div className="inline-flex rounded-2xl border border-brand-border bg-white p-1 shadow-sm">
                <Button type="button" variant={mode === "edit" ? "primary" : "ghost"} className="rounded-xl px-3" onClick={() => setMode("edit")}>
                  Редактор
                </Button>
                <Button type="button" variant={mode === "preview" ? "primary" : "ghost"} className="rounded-xl px-3" onClick={() => setMode("preview")}>
                  <Eye className="h-4 w-4" />
                  Превью
                </Button>
              </div>
            </div>
          </CardHeader>

          {mode === "preview" ? (
            <ArtistWorldPreview
              nickname={nickname.trim() || "Новый артист"}
              avatarUrl={avatarUrl.trim() || null}
              bandlink={bandlink.trim() || null}
              artistWorld={previewData}
              visibleBlocksInOrder={visibleBlocksInOrder}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3 rounded-[24px] border border-brand-border bg-white/82 p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">Структура</p>
                    <p className="text-xs text-brand-muted">Порядок блоков и их видимость в мини-сайте.</p>
                  </div>
                  <ArtistWorldBlockManager
                    blockOrder={blockOrder}
                    hiddenBlocks={hiddenBlocks}
                    onMoveUp={(blockId) => {
                      const index = blockOrder.indexOf(blockId);
                      if (index <= 0) return;
                      setBlockOrder((current) => moveItem(current, index, index - 1));
                    }}
                    onMoveDown={(blockId) => {
                      const index = blockOrder.indexOf(blockId);
                      if (index === -1 || index >= blockOrder.length - 1) return;
                      setBlockOrder((current) => moveItem(current, index, index + 1));
                    }}
                    onToggleVisibility={(blockId) => {
                      setHiddenBlocks((current) =>
                        current.includes(blockId) ? current.filter((item) => item !== blockId) : [...current, blockId]
                      );
                    }}
                  />
                </div>

                <div className="space-y-3 rounded-[24px] border border-brand-border bg-white/82 p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">Дизайн</p>
                    <p className="text-xs text-brand-muted">Тема, фон и визуальный тон мира артиста.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Тема</label>
                      <Select value={themePreset} onChange={(event) => setThemePreset(event.target.value as ArtistWorldThemePreset)}>
                        {artistWorldThemePresetOptions.map((option) => (
                          <option key={option} value={option}>
                            {artistWorldThemeLabel(option)}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Фон</label>
                      <div className="inline-flex rounded-2xl border border-brand-border bg-white p-1 shadow-sm">
                        {artistWorldBackgroundModeOptions.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={backgroundMode === option ? "primary" : "ghost"}
                            className="rounded-xl px-3"
                            onClick={() => setBackgroundMode(option)}
                          >
                            {option === ArtistWorldBackgroundMode.GRADIENT ? "Gradient" : "Image"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {backgroundMode === ArtistWorldBackgroundMode.GRADIENT ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Цвет A</label>
                        <Input value={backgroundColorA} onChange={(event) => setBackgroundColorA(event.target.value)} placeholder="#f8fbf4" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Цвет B</label>
                        <Input value={backgroundColorB} onChange={(event) => setBackgroundColorB(event.target.value)} placeholder="#e5eddc" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {backgroundImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={backgroundImageUrl} alt="Фон мира артиста" className="h-40 w-full rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-brand-border bg-[#f7faf2] text-sm text-brand-muted">
                          Фон пока не загружен
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
                          <Upload className="mr-2 h-4 w-4" />
                          {uploadingWorldAsset ? "Загружаем..." : "Загрузить фон"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            disabled={uploadingWorldAsset}
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              event.currentTarget.value = "";
                              if (!file) return;
                              setUploadingWorldAsset(true);
                              setSaveError("");
                              try {
                                const url = await uploadWorldAsset("background", file);
                                setBackgroundImageUrl(url);
                              } catch (error) {
                                setSaveError(error instanceof Error ? error.message : "Не удалось загрузить фон.");
                              } finally {
                                setUploadingWorldAsset(false);
                              }
                            }}
                          />
                        </label>
                        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setBackgroundImageUrl("")}>
                          Убрать фон
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-brand-border bg-white/84 p-4 shadow-sm">
                <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                      <div>
                        <p className="text-sm font-medium text-brand-ink">Hero</p>
                        <p className="text-xs text-brand-muted">Кто ты как артист и какое первое ощущение должна дать страница.</p>
                      </div>
                      <Textarea
                        value={identityStatement}
                        onChange={(event) => setIdentityStatement(event.target.value)}
                        placeholder="Кто ты как артист"
                        className="min-h-[96px] bg-white"
                      />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                      <div>
                        <p className="text-sm font-medium text-brand-ink">Mission / Values / Philosophy</p>
                        <p className="text-xs text-brand-muted">Смысл, опоры и внутренняя позиция артиста.</p>
                      </div>
                      <Textarea value={mission} onChange={(event) => setMission(event.target.value)} placeholder="Миссия" className="min-h-[88px] bg-white" />
                      <Textarea value={values} onChange={(event) => setValues(event.target.value)} placeholder="Ценности по строкам" className="min-h-[88px] bg-white" />
                      <Textarea
                        value={philosophy}
                        onChange={(event) => setPhilosophy(event.target.value)}
                        placeholder="Философия"
                        className="min-h-[88px] bg-white"
                      />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                      <div>
                        <p className="text-sm font-medium text-brand-ink">Themes / Audience</p>
                        <p className="text-xs text-brand-muted">О чем музыка и для кого она существует.</p>
                      </div>
                      <Textarea
                        value={coreThemes}
                        onChange={(event) => setCoreThemes(event.target.value)}
                        placeholder="Темы музыки по строкам"
                        className="min-h-[108px] bg-white"
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input value={audienceCore} onChange={(event) => setAudienceCore(event.target.value)} placeholder="Для кого эта музыка" className="bg-white" />
                        <Input
                          value={differentiator}
                          onChange={(event) => setDifferentiator(event.target.value)}
                          placeholder="Что делает тебя отдельным"
                          className="bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3 rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                      <div>
                        <p className="text-sm font-medium text-brand-ink">Visual</p>
                        <p className="text-xs text-brand-muted">Эстетика, визуальное направление и образ.</p>
                      </div>
                      <Textarea
                        value={aestheticKeywords}
                        onChange={(event) => setAestheticKeywords(event.target.value)}
                        placeholder="Эстетические коды по строкам"
                        className="min-h-[96px] bg-white"
                      />
                      <Input value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Визуальное направление" className="bg-white" />
                      <Textarea
                        value={fashionSignals}
                        onChange={(event) => setFashionSignals(event.target.value)}
                        placeholder="Образ / стиль по строкам"
                        className="min-h-[96px] bg-white"
                      />
                    </div>

                    <div className="rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                      <ArtistWorldReferenceEditor
                        references={references}
                        onAdd={() =>
                          setReferences((current) => [
                            ...current,
                            { id: createClientId("reference"), title: "", creator: "", note: "", linkUrl: "", imageUrl: "" }
                          ])
                        }
                        onChange={(id, patch) =>
                          setReferences((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
                        }
                        onDelete={(id) => setReferences((current) => current.filter((item) => item.id !== id))}
                        onMoveUp={(id) =>
                          setReferences((current) => {
                            const index = current.findIndex((item) => item.id === id);
                            if (index <= 0) return current;
                            return moveItem(current, index, index - 1);
                          })
                        }
                        onMoveDown={(id) =>
                          setReferences((current) => {
                            const index = current.findIndex((item) => item.id === id);
                            if (index === -1 || index >= current.length - 1) return current;
                            return moveItem(current, index, index + 1);
                          })
                        }
                        onUploadImage={async (id, file) => {
                          setUploadingWorldAsset(true);
                          setSaveError("");
                          try {
                            const url = await uploadWorldAsset("reference_image", file);
                            setReferences((current) => current.map((item) => (item.id === id ? { ...item, imageUrl: url } : item)));
                          } catch (error) {
                            setSaveError(error instanceof Error ? error.message : "Не удалось загрузить изображение референса.");
                          } finally {
                            setUploadingWorldAsset(false);
                          }
                        }}
                      />
                    </div>

                    <div className="rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                      <ArtistWorldProjectEditor
                        projects={projects}
                        onAdd={() =>
                          setProjects((current) => [
                            ...current,
                            { id: createClientId("project"), title: "", subtitle: "", description: "", linkUrl: "", coverImageUrl: "" }
                          ])
                        }
                        onChange={(id, patch) =>
                          setProjects((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
                        }
                        onDelete={(id) => setProjects((current) => current.filter((item) => item.id !== id))}
                        onMoveUp={(id) =>
                          setProjects((current) => {
                            const index = current.findIndex((item) => item.id === id);
                            if (index <= 0) return current;
                            return moveItem(current, index, index - 1);
                          })
                        }
                        onMoveDown={(id) =>
                          setProjects((current) => {
                            const index = current.findIndex((item) => item.id === id);
                            if (index === -1 || index >= current.length - 1) return current;
                            return moveItem(current, index, index + 1);
                          })
                        }
                        onUploadCover={async (id, file) => {
                          setUploadingWorldAsset(true);
                          setSaveError("");
                          try {
                            const url = await uploadWorldAsset("project_cover", file);
                            setProjects((current) => current.map((item) => (item.id === id ? { ...item, coverImageUrl: url } : item)));
                          } catch (error) {
                            setSaveError(error instanceof Error ? error.message : "Не удалось загрузить обложку проекта.");
                          } finally {
                            setUploadingWorldAsset(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
          <CardHeader className="mb-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="border-brand-border bg-white/90 text-brand-muted">
                <UserRound className="mr-1 h-3.5 w-3.5" />
                Настройки профиля SAFE ID
              </Badge>
            </div>
            <CardTitle className="text-2xl">Профиль SAFE ID</CardTitle>
            <CardDescription>Только никнейм, аватар и один bandlink.</CardDescription>
          </CardHeader>

          <div className="space-y-3">
            <div className="rounded-2xl border border-brand-border bg-[#f7faf2] p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Код SAFE ID</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 break-all rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-semibold text-brand-ink">
                  {data?.safeId ?? "SAFE-ID"}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(data?.safeId ?? "SAFE-ID");
                      setCopied(true);
                      toast.success("SAFE ID скопирован.");
                    } catch {
                      setSaveError("Не удалось скопировать SAFE ID.");
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/80 p-3">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Аватар</label>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-brand-border bg-[#f4f8ed]">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={nickname || "Аватар артиста"} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-8 w-8 text-brand-muted" />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingAvatar ? "Загружаем..." : "Загрузить фото"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (!file) return;
                        setUploadingAvatar(true);
                        setSaveError("");
                        try {
                          await uploadAvatar(file);
                          toast.success("Аватар загружен.");
                        } catch (error) {
                          setSaveError(error instanceof Error ? error.message : "Не удалось загрузить аватар.");
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                    />
                  </label>
                  <p className="text-xs text-brand-muted">JPG, PNG, WEBP или GIF. До 5 МБ.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/80 p-3">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Никнейм артиста</label>
              <Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ник артиста" className="bg-white" />
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/80 p-3">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Bandlink</label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input value={bandlink} onChange={(event) => setBandlink(event.target.value)} placeholder="Ссылка на bandlink" className="bg-white pl-9" />
              </div>
            </div>

            {saveError ? <InlineActionMessage message={saveError} /> : null}

            <Button
              className="w-full rounded-xl"
              disabled={!data || !nickname.trim() || saving}
              onClick={async () => {
                if (!data) return;

                setSaving(true);
                setSaveError("");

                try {
                  const response = await apiFetch("/api/id", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      nickname: nickname.trim(),
                      avatarUrl: avatarUrl.trim() || null,
                      bandlink: bandlink.trim() || null,
                      artistWorld: {
                        identityStatement: identityStatement.trim() || null,
                        mission: mission.trim() || null,
                        values: splitLines(values),
                        philosophy: philosophy.trim() || null,
                        coreThemes: splitLines(coreThemes),
                        aestheticKeywords: splitLines(aestheticKeywords),
                        visualDirection: visualDirection.trim() || null,
                        audienceCore: audienceCore.trim() || null,
                        differentiator: differentiator.trim() || null,
                        fashionSignals: splitLines(fashionSignals),
                        themePreset,
                        backgroundMode,
                        backgroundColorA: backgroundMode === ArtistWorldBackgroundMode.GRADIENT ? backgroundColorA.trim() || null : null,
                        backgroundColorB: backgroundMode === ArtistWorldBackgroundMode.GRADIENT ? backgroundColorB.trim() || null : null,
                        backgroundImageUrl: backgroundMode === ArtistWorldBackgroundMode.IMAGE ? backgroundImageUrl.trim() || null : null,
                        blockOrder,
                        hiddenBlocks,
                        references: references.map((item) => ({
                          id: item.id,
                          title: item.title.trim() || null,
                          creator: item.creator.trim() || null,
                          note: item.note.trim() || null,
                          linkUrl: item.linkUrl.trim() || null,
                          imageUrl: item.imageUrl.trim() || null
                        })),
                        projects: projects.map((item) => ({
                          id: item.id,
                          title: item.title.trim() || null,
                          subtitle: item.subtitle.trim() || null,
                          description: item.description.trim() || null,
                          linkUrl: item.linkUrl.trim() || null,
                          coverImageUrl: item.coverImageUrl.trim() || null
                        }))
                      }
                    })
                  });

                  if (!response.ok) {
                    throw new Error(await readApiErrorMessage(response, "Не удалось сохранить SAFE ID."));
                  }

                  await refetch();
                  toast.success("SAFE ID сохранен.");
                } catch (error) {
                  setSaveError(error instanceof Error ? error.message : "Не удалось сохранить SAFE ID.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Сохраняем..." : "Сохранить SAFE ID"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
