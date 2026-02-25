export const distributionYesNoOptions = [
  { value: "NO", label: "Нет" },
  { value: "YES", label: "Да" }
] as const;

export const distributionDistributorOptions = [
  { value: "ONE_RPM", label: "ONErpm" },
  { value: "DISTROKID", label: "DistroKid" },
  { value: "TUNECORE", label: "TuneCore" },
  { value: "FRESHTUNES", label: "FreshTunes" },
  { value: "ZVONKO", label: "Zvonko Digital" },
  { value: "BELIEVE", label: "Believe" },
  { value: "OTHER", label: "Другой" }
] as const;

export type DistributionYesNoValue = (typeof distributionYesNoOptions)[number]["value"];
export type DistributionDistributorValue = (typeof distributionDistributorOptions)[number]["value"];
export type DistributionRequestStatusValue = "SUBMITTED";

export type TrackDistributionRequestPayload = {
  masterDemoId: string;
  artistName: string;
  releaseTitle: string;
  releaseDate: string; // YYYY-MM-DD
  genre: string;
  explicitContent: DistributionYesNoValue;
  usesAi: DistributionYesNoValue;
  promoPitchText?: string | null;
  managerHelpRequested: boolean;
  distributor: DistributionDistributorValue;
  distributorOtherName?: string | null;
};

export type TrackDistributionRequestDto = TrackDistributionRequestPayload & {
  id: string;
  status: DistributionRequestStatusValue;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export const distributionRequestStatusLabel: Record<DistributionRequestStatusValue, string> = {
  SUBMITTED: "Отправлено"
};
