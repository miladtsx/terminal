import { useEffect, useMemo } from "react";
import { createTerminalFontController } from "@utils";

export function useTerminalFonts() {
  const controller = useMemo(() => createTerminalFontController(), []);

  useEffect(() => {
    controller.warmFonts();
  }, [controller]);

  return controller;
}
