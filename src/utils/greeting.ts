import { Period } from "../types";

const ICONS: Record<Period, string> = {
  morning: "☀️",
  afternoon: "◉",
  evening: "◐",
  night: "🌙",
};

function getPeriodByLocalTime(date = new Date()): Period {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}

export function getGreeting() {
  const period = getPeriodByLocalTime();
  const icon = ICONS[period];
  return `Good ${period} ${icon}`;
}