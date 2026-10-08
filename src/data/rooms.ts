/**
 * Exhibition rooms, in walking order from the entrance.
 *
 * A실 holds the 2nd-semester works and is first in the building; B실 keeps the
 * existing works behind a doorway. `reservedSlots` hangs empty "준비 중" frames
 * until real works are added, so a room never looks unfinished.
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
  { id: "A", name: "A실", subtitle: "2학기 작품", reservedSlots: 10, accent: "#9484c4" },
  { id: "B", name: "B실", subtitle: "1학기 작품", reservedSlots: 0, accent: "#4d9079" },
];
