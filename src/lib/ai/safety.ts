export type SupportEscalationLevel = "NONE" | "SOFT_ALERT" | "URGENT_HELP";

type SupportEscalationResult = {
  level: SupportEscalationLevel;
  reason?: string;
};

const urgentPatterns: RegExp[] = [
  /\b(хочу умереть|не хочу жить|suicide|kill myself|end my life)\b/i,
  /\b(самоубийств|суицид)\b/i,
  /\b(причинить себе вред|self-harm|hurt myself)\b/i
];

const softPatterns: RegExp[] = [
  /\b(паник|panic attack|очень тревожно|anxiety)\b/i,
  /\b(не могу спать|не сплю|insomnia)\b/i,
  /\b(полный провал|я ничто|я бесполезен|я бесполезна)\b/i
];

export function detectSupportEscalation(note?: string): SupportEscalationResult {
  const source = note?.trim();
  if (!source) {
    return { level: "NONE" };
  }

  for (const pattern of urgentPatterns) {
    if (pattern.test(source)) {
      return { level: "URGENT_HELP", reason: "Crisis-related language detected" };
    }
  }

  for (const pattern of softPatterns) {
    if (pattern.test(source)) {
      return { level: "SOFT_ALERT", reason: "Distress-related language detected" };
    }
  }

  return { level: "NONE" };
}

const unsafeSupportOutputPatterns: RegExp[] = [
  /\b(you definitely have|у тебя точно)\b/i,
  /\b(diagnosis|диагноз)\b/i,
  /\b(stop taking|прекрати принимать)\b/i
];

export function isUnsafeSupportResponseText(text: string): boolean {
  return unsafeSupportOutputPatterns.some((pattern) => pattern.test(text));
}

