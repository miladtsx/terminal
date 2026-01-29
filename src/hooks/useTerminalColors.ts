import { useMemo } from "react";
import { createTerminalColorController } from "@utils";

export function useTerminalColors() {
  const controller = useMemo(() => createTerminalColorController(), []);
  return controller;
}
