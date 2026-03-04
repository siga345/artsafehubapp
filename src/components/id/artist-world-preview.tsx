import { ArtistWorldBackgroundMode, ArtistWorldThemePreset } from "@prisma/client";
import { Link2, UserRound } from "lucide-react";

import { type ArtistWorldBlockId } from "@/lib/artist-growth";
import { getArtistWorldBackgroundStyle, getArtistWorldThemeClasses } from "@/components/id/artist-world-theme-styles";

export type ArtistWorldPreviewData = {
  identityStatement: string | null;
  mission: string | null;
  values: string[];
  philosophy: string | null;
  coreThemes: string[];
  aestheticKeywords: string[];
  visualDirection: string | null;
  audienceCore: string | null;
  differentiator: string | null;
  fashionSignals: string[];
  themePreset: ArtistWorldThemePreset;
  backgroundMode: ArtistWorldBackgroundMode;
  backgroundColorA: string | null;
  backgroundColorB: string | null;
  backgroundImageUrl: string | null;
  references: Array<{
    id: string;
    title: string | null;
    creator: string | null;
    note: string | null;
    linkUrl: string | null;
    imageUrl: string | null;
  }>;
  projects: Array<{
    id: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    linkUrl: string | null;
    coverImageUrl: string | null;
  }>;
};

function renderTextOrPlaceholder(value: string | null, placeholder: string) {
  return value?.trim() ? value : placeholder;
}

export function ArtistWorldPreview(props: {
  nickname: string;
  avatarUrl: string | null;
  bandlink: string | null;
  artistWorld: ArtistWorldPreviewData;
  visibleBlocksInOrder: ArtistWorldBlockId[];
}) {
  const theme = getArtistWorldThemeClasses(props.artistWorld.themePreset);
  const backgroundStyle = getArtistWorldBackgroundStyle({
    backgroundMode: props.artistWorld.backgroundMode,
    backgroundColorA: props.artistWorld.backgroundColorA,
    backgroundColorB: props.artistWorld.backgroundColorB,
    backgroundImageUrl: props.artistWorld.backgroundImageUrl
  });

  return (
    <div className={`overflow-hidden rounded-[28px] border ${theme.panel} p-4 shadow-[0_18px_36px_rgba(16,21,19,0.14)] backdrop-blur-sm ${theme.shell}`} style={backgroundStyle}>
      <div className="space-y-4">
        {props.visibleBlocksInOrder.map((blockId) => {
          switch (blockId) {
            case "hero":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-current/10 bg-white/10">
                      {props.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={props.avatarUrl} alt={props.nickname || "Аватар артиста"} className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-7 w-7 opacity-70" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Artist World</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{props.nickname || "Новый артист"}</h2>
                      <p className={`mt-2 max-w-2xl text-sm leading-7 ${theme.muted}`}>
                        {renderTextOrPlaceholder(
                          props.artistWorld.identityStatement,
                          "Добавь identity statement, чтобы мир артиста начал говорить своим голосом."
                        )}
                      </p>
                      {props.bandlink ? (
                        <a href={props.bandlink} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${theme.accent}`}>
                          <Link2 className="h-3.5 w-3.5" />
                          Bandlink
                        </a>
                      ) : null}
                    </div>
                  </div>
                </section>
              );
            case "mission":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Mission</p>
                  <p className="mt-2 text-base leading-7">{renderTextOrPlaceholder(props.artistWorld.mission, "Сформулируй миссию артиста.")}</p>
                </section>
              );
            case "values":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Values</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {props.artistWorld.values.length ? (
                      props.artistWorld.values.map((item) => (
                        <span key={item} className={`rounded-full border px-3 py-1 text-xs ${theme.accent}`}>
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className={`text-sm ${theme.muted}`}>Добавь ценности артиста.</p>
                    )}
                  </div>
                </section>
              );
            case "philosophy":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Philosophy</p>
                  <p className="mt-2 text-base leading-7">
                    {renderTextOrPlaceholder(props.artistWorld.philosophy, "Сформулируй философию проекта.")}
                  </p>
                </section>
              );
            case "themes":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Themes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {props.artistWorld.coreThemes.length ? (
                      props.artistWorld.coreThemes.map((item) => (
                        <span key={item} className={`rounded-full border px-3 py-1 text-xs ${theme.accent}`}>
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className={`text-sm ${theme.muted}`}>Добавь темы музыки.</p>
                    )}
                  </div>
                </section>
              );
            case "visual":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Visual</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium">Направление</p>
                      <p className={`mt-1 text-sm ${theme.muted}`}>
                        {renderTextOrPlaceholder(props.artistWorld.visualDirection, "Визуал пока не описан.")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Эстетические коды</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {props.artistWorld.aestheticKeywords.length ? (
                          props.artistWorld.aestheticKeywords.map((item) => (
                            <span key={item} className={`rounded-full border px-3 py-1 text-xs ${theme.accent}`}>
                              {item}
                            </span>
                          ))
                        ) : (
                          <p className={`text-sm ${theme.muted}`}>Пока пусто.</p>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium">Образ / стиль</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {props.artistWorld.fashionSignals.length ? (
                          props.artistWorld.fashionSignals.map((item) => (
                            <span key={item} className={`rounded-full border px-3 py-1 text-xs ${theme.accent}`}>
                              {item}
                            </span>
                          ))
                        ) : (
                          <p className={`text-sm ${theme.muted}`}>Пока не задано.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            case "audience":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Audience</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium">Для кого это</p>
                      <p className={`mt-1 text-sm ${theme.muted}`}>
                        {renderTextOrPlaceholder(props.artistWorld.audienceCore, "Опиши ядро аудитории.")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Почему это отдельный артист</p>
                      <p className={`mt-1 text-sm ${theme.muted}`}>
                        {renderTextOrPlaceholder(props.artistWorld.differentiator, "Добавь отличие от других артистов.")}
                      </p>
                    </div>
                  </div>
                </section>
              );
            case "references":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">References</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {props.artistWorld.references.length ? (
                      props.artistWorld.references.map((item) => (
                        <div key={item.id} className={`rounded-2xl border p-3 ${theme.card}`}>
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.title || "Референс"} className="mb-3 h-32 w-full rounded-xl object-cover" />
                          ) : null}
                          <p className="text-sm font-medium">{item.title || "Без названия"}</p>
                          {item.creator ? <p className={`mt-1 text-xs ${theme.muted}`}>{item.creator}</p> : null}
                          {item.note ? <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>{item.note}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className={`text-sm ${theme.muted}`}>Добавь референсы, чтобы страница получила художественный контекст.</p>
                    )}
                  </div>
                </section>
              );
            case "projects":
              return (
                <section key={blockId} className={`rounded-[24px] border p-4 ${theme.card}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Projects</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {props.artistWorld.projects.length ? (
                      props.artistWorld.projects.map((item) => (
                        <div key={item.id} className={`rounded-2xl border p-3 ${theme.card}`}>
                          {item.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.coverImageUrl} alt={item.title || "Проект"} className="mb-3 h-36 w-full rounded-xl object-cover" />
                          ) : null}
                          <p className="text-base font-medium">{item.title || "Без названия"}</p>
                          {item.subtitle ? <p className={`mt-1 text-xs uppercase tracking-[0.12em] ${theme.muted}`}>{item.subtitle}</p> : null}
                          {item.description ? <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>{item.description}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className={`text-sm ${theme.muted}`}>Добавь проекты, чтобы мир артиста выглядел как живая страница, а не как пустой шаблон.</p>
                    )}
                  </div>
                </section>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
