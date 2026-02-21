import { AvatarSegment } from "@types";

export const AVATAR_IMAGE = "images/avatar.jpg";

type AvatarOptions = {
  label?: string;
  meta?: string;
  image?: string;
  emphasizeLines?: number[];
  onClickCommand?: string;
  disableModal?: boolean;
};

export function buildAvatarSegment(lines: string[], options?: AvatarOptions): AvatarSegment {
  return {
    type: "avatar",
    lines,
    image: options?.image ?? AVATAR_IMAGE,
    label: options?.label,
    meta: options?.meta,
    emphasizeLines: options?.emphasizeLines,
    onClickCommand: options?.onClickCommand,
    disableModal: options?.disableModal,
  };
}
