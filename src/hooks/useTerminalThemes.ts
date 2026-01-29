import { useMemo } from "react";
import { createTerminalThemeController } from "@utils";

export function useTerminalThemes() {
  const controller = useMemo(() => createTerminalThemeController(), []);
  return controller;
}
