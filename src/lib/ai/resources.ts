type SupportResource = {
  title: string;
  url: string;
};

const defaultUrgentResources: SupportResource[] = [
  {
    title: "Emergency services (local)",
    url: "https://www.google.com/search?q=local+emergency+number"
  },
  {
    title: "Find immediate crisis support",
    url: "https://findahelpline.com/"
  }
];

const defaultSoftResources: SupportResource[] = [
  {
    title: "Grounding and coping techniques",
    url: "https://www.mind.org.uk/information-support/types-of-mental-health-problems/anxiety-and-panic-attacks/self-care/"
  }
];

export function getResourcesForEscalation(level: "NONE" | "SOFT_ALERT" | "URGENT_HELP"): SupportResource[] {
  if (level === "URGENT_HELP") return defaultUrgentResources;
  if (level === "SOFT_ALERT") return defaultSoftResources;
  return [];
}
