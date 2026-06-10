import type { ShowcaseVideo } from "@/types/showcase";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * These working titles and captions are based on the teams' filming plans.
 * Replace them with final titles, full student lists, thumbnails, and videos
 * before the event. Adding items automatically extends both gallery views.
 */
export const showcaseVideos: ShowcaseVideo[] = [
  {
    id: "team-01",
    teamLabel: "1조",
    studentNames: ["김준혁팀"],
    title: "[가제] 딱풀",
    caption:
      "소재는 딱풀입니다. 지하실, 상상계단, 사물함, 식수대, 음악실, 운동장을 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team1/thumbnail.jpg`,
    videoUrl: `${bp}/media/team1/video.mp4`,
    accent: "pine",
    orientation: "portrait",
  },
  {
    id: "team-02",
    teamLabel: "2조",
    studentNames: ["유지우팀"],
    title: "[가제] 핸드폰",
    caption:
      "소재는 핸드폰입니다. 운동장, 상상계단, 사물함, 음악실, 진로상담실, 미술실을 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team2/thumbnail.jpg`,
    videoUrl: `${bp}/media/team2/video.mp4`,
    accent: "hydrangea",
    orientation: "landscape",
  },
  {
    id: "team-03",
    teamLabel: "3조",
    studentNames: ["김지온팀"],
    title: "[가제] 학교폭력",
    caption:
      "소재는 학교폭력입니다. 상상계단과 복도를 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team3/thumbnail.jpg`,
    videoUrl: `${bp}/media/team3/video.mp4`,
    accent: "navy",
    orientation: "landscape",
  },
  {
    id: "team-04",
    teamLabel: "4조",
    studentNames: ["박유솔팀"],
    title: "[가제] 학교폭력",
    caption:
      "소재는 학교폭력입니다. 상상계단, 홈베이스, 음악실, 체육관을 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team4/thumbnail.jpg`,
    videoUrl: `${bp}/media/team4/video.mp4`,
    accent: "pine",
    orientation: "landscape",
  },
  {
    id: "team-05a",
    teamLabel: "5A조",
    studentNames: ["이소윤팀"],
    title: "[가제] 꿈을 찾는 학생",
    caption:
      "소재는 꿈을 찾는 학생입니다. 화장실, 교실, 복도, 홈베이스를 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team5a/thumbnail.jpg`,
    videoUrl: `${bp}/media/team5a/video.mp4`,
    accent: "hydrangea",
    orientation: "landscape",
  },
  {
    id: "team-05b",
    teamLabel: "5B조",
    studentNames: ["이소윤팀"],
    title: "[가제] 공포",
    caption:
      "소재는 공포입니다. 화장실, 교실, 복도, 홈베이스를 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team5b/thumbnail.jpg`,
    videoUrl: `${bp}/media/team5b/video.mp4`,
    accent: "navy",
    orientation: "landscape",
  },
  {
    id: "team-06",
    teamLabel: "6조",
    studentNames: ["조설아팀"],
    title: "[가제] 일진 학생",
    caption:
      "소재는 일진 학생입니다. 복도, 운동장, 사물함, 계단, 농구장, 급식실, 음악실을 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team6/thumbnail.jpg`,
    videoUrl: `${bp}/media/team6/video.mp4`,
    accent: "pine",
    orientation: "landscape",
  },
  {
    id: "team-07",
    teamLabel: "7조",
    studentNames: ["단민재팀"],
    title: "[가제] 학교폭력",
    caption:
      "소재는 학교폭력입니다. 지하실, 식수대, 상상계단을 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team7/thumbnail.jpg`,
    videoUrl: `${bp}/media/team7/video.mp4`,
    accent: "hydrangea",
    orientation: "landscape",
  },
  {
    id: "team-08",
    teamLabel: "8조",
    studentNames: ["전민채팀"],
    title: "[가제] 공포",
    caption: "소재는 공포입니다. 지하실을 배경으로 촬영을 진행하고 있습니다.",
    thumbnailUrl: `${bp}/media/team8/thumbnail.jpg`,
    videoUrl: `${bp}/media/team8/video.mp4`,
    accent: "navy",
    orientation: "landscape",
  },
];
