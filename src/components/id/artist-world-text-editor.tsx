"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type TextEditorState = {
  nickname: string;
  artistName: string;
  artistAge: string;
  artistCity: string;
  favoriteArtist1: string;
  favoriteArtist2: string;
  favoriteArtist3: string;
  lifeValues: string;
  teamPreference: string;
  mission: string;
  identityStatement: string;
  values: string;
  philosophy: string;
  coreThemes: string;
  audienceCore: string;
  differentiator: string;
};

export type TextEditorCallbacks = {
  onFieldChange: (field: keyof TextEditorState, value: string) => void;
};

const teamPreferenceOptions = [
  { value: "solo", label: "Одиночка", description: "Чаще двигаюсь самостоятельно" },
  { value: "team", label: "Команда", description: "Люблю работать в связке с людьми" },
  { value: "both", label: "И так, и так", description: "Могу и сам, и в команде" }
] as const;

export function ArtistWorldTextEditor(props: {
  state: TextEditorState;
  callbacks: TextEditorCallbacks;
}) {
  const { state, callbacks } = props;

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-[24px] border border-brand-border bg-[#f9fbf6] p-4">
        <div>
          <p className="text-sm font-medium text-brand-ink">Текстовая основа</p>
          <p className="text-xs text-brand-muted">Собери обязательные ответы, на которых держится твой мир артиста.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Как тебя зовут?</label>
            <Input
              value={state.artistName}
              onChange={(event) => callbacks.onFieldChange("artistName", event.target.value)}
              placeholder="Имя"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Сколько тебе лет?</label>
            <Input
              type="number"
              min={10}
              max={100}
              value={state.artistAge}
              onChange={(event) => callbacks.onFieldChange("artistAge", event.target.value)}
              placeholder="Возраст"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Твой сценический псевдоним?</label>
            <Input
              value={state.nickname}
              onChange={(event) => callbacks.onFieldChange("nickname", event.target.value)}
              placeholder="Псевдоним"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">В каком городе ты живёшь?</label>
            <Input
              value={state.artistCity}
              onChange={(event) => callbacks.onFieldChange("artistCity", event.target.value)}
              placeholder="Город"
              className="bg-white"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Три твоих любимых артиста?</label>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={state.favoriteArtist1}
              onChange={(event) => callbacks.onFieldChange("favoriteArtist1", event.target.value)}
              placeholder="Артист 1"
              className="bg-white"
            />
            <Input
              value={state.favoriteArtist2}
              onChange={(event) => callbacks.onFieldChange("favoriteArtist2", event.target.value)}
              placeholder="Артист 2"
              className="bg-white"
            />
            <Input
              value={state.favoriteArtist3}
              onChange={(event) => callbacks.onFieldChange("favoriteArtist3", event.target.value)}
              placeholder="Артист 3"
              className="bg-white"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
              Что для тебя самое ценное в жизни прямо сейчас?
            </label>
            <Textarea
              value={state.lifeValues}
              onChange={(event) => callbacks.onFieldChange("lifeValues", event.target.value)}
              placeholder="Что тебе важно и к чему ты стремишься как человек"
              className="min-h-[132px] bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">К чему ты стремишься в музыке?</label>
            <Textarea
              value={state.mission}
              onChange={(event) => callbacks.onFieldChange("mission", event.target.value)}
              placeholder="Твоя цель в музыке"
              className="min-h-[132px] bg-white"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
            Ты одиночка или любишь работать в команде?
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            {teamPreferenceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => callbacks.onFieldChange("teamPreference", option.value)}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  state.teamPreference === option.value
                    ? "border-[#4b6440] bg-[#eef6e2]"
                    : "border-brand-border bg-white hover:bg-[#f3f8ea]"
                }`}
              >
                <p className="text-sm font-medium text-brand-ink">{option.label}</p>
                <p className="mt-1 text-xs text-brand-muted">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <details className="overflow-hidden rounded-[24px] border border-brand-border bg-[#f9fbf6]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-brand-ink marker:hidden">
          Углубить текст
        </summary>
        <div className="space-y-4 border-t border-brand-border px-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Identity statement</label>
            <Textarea
              value={state.identityStatement}
              onChange={(event) => callbacks.onFieldChange("identityStatement", event.target.value)}
              placeholder="Кто ты как артист в одной сильной формулировке"
              className="min-h-[104px] bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Философия</label>
            <Textarea
              value={state.philosophy}
              onChange={(event) => callbacks.onFieldChange("philosophy", event.target.value)}
              placeholder="Во что ты веришь как артист"
              className="min-h-[104px] bg-white"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Ценности</label>
              <Textarea
                value={state.values}
                onChange={(event) => callbacks.onFieldChange("values", event.target.value)}
                placeholder="По одной ценности на строку"
                className="min-h-[132px] bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Темы музыки</label>
              <Textarea
                value={state.coreThemes}
                onChange={(event) => callbacks.onFieldChange("coreThemes", event.target.value)}
                placeholder="По одной теме на строку"
                className="min-h-[132px] bg-white"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Для кого эта музыка</label>
              <Textarea
                value={state.audienceCore}
                onChange={(event) => callbacks.onFieldChange("audienceCore", event.target.value)}
                placeholder="Опиши ядро своей аудитории"
                className="min-h-[104px] bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Что делает тебя отдельным</label>
              <Textarea
                value={state.differentiator}
                onChange={(event) => callbacks.onFieldChange("differentiator", event.target.value)}
                placeholder="Что отличает тебя от других артистов"
                className="min-h-[104px] bg-white"
              />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
