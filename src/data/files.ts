import manifest from "./fileManifest.json";

export type FileMeta = {
  name: string;
  path: string;
  size: number;
  sha256: string;
  text: boolean;
  mtime?: string;
};

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
