import { FileMeta } from "@types";
import manifest from "./fileManifest.json";

const files: FileMeta[] = manifest;

export function listFiles(): FileMeta[] {
  return files.slice();
}

export function findFileByName(name: string): FileMeta | undefined {
  const normalized = name.toLowerCase();
  return files.find((file) => file.name.toLowerCase() === normalized);
}

export function listTextFiles(): FileMeta[] {
  return files.filter((file) => file.text);
}
