/**
 * Exhibition rooms, in walking order from the entrance (array order = order in
 * the building and in the HUD room switcher).
 *
 * B실 keeps the existing works and is the first room visitors walk into; A실
 * for the 2nd-semester works lies behind the doorway. `reservedSlots` hangs
 * empty "준비 중" frames until real works are added, so a room never looks
 * unfinished.
 */
export type RoomId = "A" | "B";

export type Room = {
  id: RoomId;
  name: string;
  subtitle: string;
  /** Minimum number of frames on the walls; empty ones show "작품 준비 중". */
  reservedSlots: number;
  accent: string;
};

export const ROOMS: Room[] = [
  { id: "B", name: "B실", subtitle: "1학기 작품", reservedSlots: 0, accent: "#4d9079" },
  { id: "A", name: "A실", subtitle: "2학기 작품", reservedSlots: 10, accent: "#9484c4" },
];
