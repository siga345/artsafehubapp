"use client";

import { CommandCenterPage } from "@/components/home/command-center-page";
import { LegacyTodayPage } from "@/components/home/legacy-today-page";

const commandCenterEnabled = process.env.NEXT_PUBLIC_COMMAND_CENTER_ENABLED === "true";

export default function TodayPage() {
  if (commandCenterEnabled) {
    return <CommandCenterPage />;
  }

  return <LegacyTodayPage />;
}
