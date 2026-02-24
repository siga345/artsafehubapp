import type {
  NavigationProviderDraft,
  NavigationProviderInput,
  StructuredAiProvider,
  SupportProviderDraft,
  SupportProviderInput
} from "@/lib/ai/provider";

export class MockStructuredAiProvider implements StructuredAiProvider {
  readonly providerName = "mock";

  constructor(
    readonly navigationModel: string,
    readonly supportModel: string
  ) {}

  async suggestNavigation(input: NavigationProviderInput): Promise<NavigationProviderDraft> {
    const picked = input.candidates.slice(0, input.topK);
    const rationalesBySpecialistId = Object.fromEntries(
      picked.map((candidate) => [
        candidate.specialistUserId,
        `${candidate.nickname} подходит по этапу ${input.pathContext.pathStageName.toLowerCase()} и цели "${input.objective}".`
      ])
    );

    return {
      summary:
        picked.length > 0
          ? `Подобраны ${picked.length} кандидата(ов) под цель "${input.objective}" с учетом PATH и базовых фильтров.`
          : `Подходящие кандидаты по текущим фильтрам не найдены. Лучше расширить город/remote/бюджет.`,
      nextActions: [
        {
          title: "Сформулируй задачу",
          description: "Опиши цель в 2-3 предложениях: результат, срок, референс.",
          etaMinutes: 10
        },
        {
          title: "Подготовь демо",
          description: "Выбери актуальную демо-версию и краткую заметку о том, что нужно улучшить.",
          etaMinutes: 15
        },
        {
          title: "Напиши первым 2 кандидатам",
          description: "Отправь короткий запрос с задачей, сроком и ожидаемым форматом ответа.",
          etaMinutes: 20
        }
      ].slice(0, Math.max(1, Math.min(5, input.topK + 1))),
      rationalesBySpecialistId
    };
  }

  async respondSupport(input: SupportProviderInput): Promise<SupportProviderDraft> {
    const tone =
      input.escalationLevel === "URGENT_HELP"
        ? "GROUNDING"
        : input.mood === "FLYING"
          ? "ENERGIZING"
          : input.mood === "TOUGH"
            ? "CALM"
            : "GROUNDING";

    const responseText =
      input.escalationLevel === "URGENT_HELP"
        ? "Сейчас важно не оставаться с этим в одиночку. Сделай один безопасный шаг: свяжись с человеком рядом или службой срочной помощи в твоей стране."
        : input.mood === "TOUGH"
          ? "Похоже, день тяжелый. Снизим планку: один маленький шаг по музыке и одна короткая пауза на восстановление уже достаточно."
          : input.mood === "FLYING"
            ? "Отличный импульс. Используй его на конкретный измеримый шаг, чтобы энергия превратилась в результат."
            : "Держим спокойный темп: выбери один следующий шаг по PATH и доведи его до завершения сегодня.";

    const suggestedSteps =
      input.escalationLevel === "URGENT_HELP"
        ? ["Свяжись с близким человеком прямо сейчас", "Перейди к разделу ресурсов и выбери контакт помощи", "Отложи сложные решения на потом"]
        : input.mood === "TOUGH"
          ? ["Сделай паузу на 5 минут без экрана", "Открой один трек и выбери только одну правку", "Отметь микро-шаг как выполненный после действия"]
          : input.mood === "FLYING"
            ? ["Зафиксируй 1 цель на сегодня", "Сделай один спринт 25 минут по треку", "Отправь демо на фидбек одному человеку"]
            : ["Выбери один микро-шаг в HOME", "Сделай 15 минут работы над треком", "Запиши короткую заметку о прогрессе"];

    return {
      tone,
      responseText,
      suggestedSteps
    };
  }
}

