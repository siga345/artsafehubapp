import { ArtistWorldBackgroundMode, ArtistWorldThemePreset } from "@prisma/client";
import { ExternalLink, Link2, ListMusic, MapPin, UserRound, Users } from "lucide-react";

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
  artistName: string | null;
  artistAge: number | null;
  artistCity: string | null;
  favoriteArtists: string[];
  lifeValues: string | null;
  teamPreference: string | null;
  playlistUrl: string | null;
  visualBoards: Array<{
    id: string;
    slug: string;
    name: string;
    sourceUrl?: string | null;
    images: Array<{ id: string; imageUrl: string }>;
  }>;
};

const teamPreferenceLabels: Record<string, string> = {
  solo: "Одиночка",
  team: "Командный игрок",
  both: "И сам, и в команде"
};

function renderText(value: string | null, fallback: string) {
  return value?.trim() ? value : fallback;
}

function renderListOrFallback(values: string[], fallback: string) {
  return values.length > 0 ? values : [fallback];
}

function PreviewList(props: { items: string[]; mutedClassName: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {props.items.map((item) => (
        <span key={item} className={`rounded-full border px-3 py-1 text-xs ${props.mutedClassName}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function ArtistWorldPreview(props: {
  nickname: string;
  avatarUrl: string | null;
  bandlink: string | null;
  artistWorld: ArtistWorldPreviewData;
}) {
  const theme = getArtistWorldThemeClasses(props.artistWorld.themePreset);
  const backgroundStyle = getArtistWorldBackgroundStyle({
    backgroundMode: props.artistWorld.backgroundMode,
    backgroundColorA: props.artistWorld.backgroundColorA,
    backgroundColorB: props.artistWorld.backgroundColorB,
    backgroundImageUrl: props.artistWorld.backgroundImageUrl
  });

  return (
    <div
      className={`overflow-hidden rounded-[28px] border ${theme.panel} p-4 shadow-[0_18px_36px_rgba(16,21,19,0.14)] backdrop-blur-sm ${theme.shell}`}
      style={backgroundStyle}
    >
      <div className="space-y-4">
        <section className={`rounded-[24px] border p-4 ${theme.card}`}>
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

              <div className="mt-2 flex flex-wrap items-center gap-3">
                {props.artistWorld.artistName ? (
                  <span className={`text-xs ${theme.muted}`}>Имя: {props.artistWorld.artistName}</span>
                ) : null}
                {props.artistWorld.artistCity ? (
                  <span className={`inline-flex items-center gap-1 text-xs ${theme.muted}`}>
                    <MapPin className="h-3 w-3" />
                    {props.artistWorld.artistCity}
                  </span>
                ) : null}
                {props.artistWorld.artistAge ? <span className={`text-xs ${theme.muted}`}>{props.artistWorld.artistAge} лет</span> : null}
                {props.artistWorld.teamPreference ? (
                  <span className={`inline-flex items-center gap-1 text-xs ${theme.muted}`}>
                    <Users className="h-3 w-3" />
                    {teamPreferenceLabels[props.artistWorld.teamPreference] ?? props.artistWorld.teamPreference}
                  </span>
                ) : null}
              </div>

              <p className={`mt-3 max-w-2xl text-sm leading-7 ${theme.muted}`}>
                {renderText(props.artistWorld.identityStatement, props.artistWorld.mission ?? "Добавь базовые ответы, чтобы мир артиста заговорил.")}
              </p>

              {props.artistWorld.favoriteArtists.length > 0 ? (
                <PreviewList items={props.artistWorld.favoriteArtists} mutedClassName={theme.accent} />
              ) : null}

              {props.bandlink ? (
                <a
                  href={props.bandlink}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${theme.accent}`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Bandlink
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className={`rounded-[24px] border p-4 ${theme.card}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Текст</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Самое ценное сейчас</p>
              <p className={`mt-1 text-sm leading-6 ${theme.muted}`}>
                {renderText(props.artistWorld.lifeValues, "Добавь ответ о том, что для тебя ценно прямо сейчас.")}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">Стремление в музыке</p>
              <p className={`mt-1 text-sm leading-6 ${theme.muted}`}>
                {renderText(props.artistWorld.mission, "Опиши, к чему ты стремишься в музыке.")}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">Темы и ценности</p>
              <PreviewList
                items={renderListOrFallback([...props.artistWorld.values, ...props.artistWorld.coreThemes], "Пока без расшифровки")}
                mutedClassName={theme.accent}
              />
            </div>

            <div>
              <p className="text-sm font-medium">Для кого и почему именно ты</p>
              <p className={`mt-1 text-sm leading-6 ${theme.muted}`}>
                {renderText(props.artistWorld.audienceCore, "Аудитория пока не описана.")}
              </p>
              {props.artistWorld.differentiator ? (
                <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>{props.artistWorld.differentiator}</p>
              ) : null}
            </div>
          </div>

          {(props.artistWorld.identityStatement || props.artistWorld.philosophy) ? (
            <div className="mt-4 rounded-2xl border border-current/10 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] opacity-70">Углубление текста</p>
              {props.artistWorld.identityStatement ? <p className="mt-2 text-sm leading-6">{props.artistWorld.identityStatement}</p> : null}
              {props.artistWorld.philosophy ? (
                <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>{props.artistWorld.philosophy}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={`rounded-[24px] border p-4 ${theme.card}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Визуал</p>
          <div className="mt-3 space-y-4">
            {props.artistWorld.visualBoards.map((board) => (
              <div key={board.slug}>
                <p className="text-sm font-medium">{board.name}</p>
                {board.images.length > 0 ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {board.images.map((image) => (
                      <div key={image.id} className="aspect-square overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-2 text-sm ${theme.muted}`}>Этот борд пока пустой.</p>
                )}
              </div>
            ))}
          </div>

          {(props.artistWorld.visualDirection ||
            props.artistWorld.aestheticKeywords.length > 0 ||
            props.artistWorld.fashionSignals.length > 0) ? (
            <div className="mt-4 rounded-2xl border border-current/10 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] opacity-70">Углубление визуала</p>
              {props.artistWorld.visualDirection ? <p className="mt-2 text-sm leading-6">{props.artistWorld.visualDirection}</p> : null}
              {props.artistWorld.aestheticKeywords.length > 0 ? (
                <PreviewList items={props.artistWorld.aestheticKeywords} mutedClassName={theme.accent} />
              ) : null}
              {props.artistWorld.fashionSignals.length > 0 ? (
                <PreviewList items={props.artistWorld.fashionSignals} mutedClassName={theme.accent} />
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={`rounded-[24px] border p-4 ${theme.card}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Плейлист</p>
          {props.artistWorld.playlistUrl ? (
            <a
              href={props.artistWorld.playlistUrl}
              target="_blank"
              rel="noreferrer"
              className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80 ${theme.accent}`}
            >
              <ListMusic className="h-4 w-4" />
              Открыть плейлист референсов
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className={`mt-3 text-sm ${theme.muted}`}>Плейлист пока не добавлен. Можно оставить только внешнюю ссылку.</p>
          )}
        </section>
      </div>
    </div>
  );
}
