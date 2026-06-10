/**
 * Metadata for a single student team video shown in both 3D and 2D views.
 */
export type ShowcaseVideo = {
  id: string;
  teamLabel: string;
  studentNames: string[];
  title: string;
  caption: string;
  thumbnailUrl: string;
  videoUrl: string;
  durationSeconds?: number;
  accent: "pine" | "hydrangea" | "navy";
  orientation?: "landscape" | "portrait";
};
