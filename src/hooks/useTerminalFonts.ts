import { useMemo } from "react";
import { createTerminalFontController } from "@utils";

export function useTerminalFonts() {
  const controller = useMemo(() => createTerminalFontController(), []);

  return controller;
}
