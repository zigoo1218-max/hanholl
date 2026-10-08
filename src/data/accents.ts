import type { ShowcaseVideo } from "@/types/showcase";

/** School identity colours used for frames, plates and the dialog: pine (교목), hydrangea (교화), navy. */
export const ACCENT_COLORS: Record<ShowcaseVideo["accent"], string> = {
  pine: "#4d9079",
  hydrangea: "#9484c4",
  navy: "#3f88b8",
};

export const ACCENT_LABELS: Record<ShowcaseVideo["accent"], string> = {
  pine: "PINE",
  hydrangea: "HYDRANGEA",
  navy: "NAVY",
};
