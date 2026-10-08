import { ROOMS, type Room, type RoomId } from "@/data/rooms";
import type { ShowcaseVideo } from "@/types/showcase";

/**
 * Pure geometry for the exhibition building: rooms are laid out one after
 * another along -Z from the glass entrance, separated by a partition wall with
 * a doorway. The scene, the camera controller and the HUD all read this one
 * layout so walls, frames, collisions and room jumps can never disagree.
 */

export const ENTRANCE_Z = 3;
export const ROW_SPACING = 4.5;
export const DOOR_WIDTH = 4;
export const DOOR_HEIGHT = 3.6;
export const PARTITION_THICKNESS = 0.3;

/** Distance from the entrance glass / a partition to the first row of frames. */
const FIRST_ROW_OFFSET_ENTRANCE = 7.2;
const FIRST_ROW_OFFSET_PARTITION = 5.2;
/** Space after the last row: a short walk to the next doorway, or room to view the title wall. */
const TAIL_BEFORE_PARTITION = 4;
const TAIL_BEFORE_END_WALL = 7.3;
const MIN_ROWS = 2;
const SPAWN_INSIDE_ENTRANCE = 2.4;
const SPAWN_INSIDE_PARTITION = 1.8;

export type Slot = {
  key: string;
  /** null = reserved frame waiting for a work ("작품 준비 중"). */
  artwork: ShowcaseVideo | null;
  side: -1 | 1;
  z: number;
  slotNumber: number;
};

export type RoomLayout = {
  room: Room;
  /** Boundary nearer the entrance (larger z). */
  startZ: number;
  /** Boundary further from the entrance (smaller z). */
  endZ: number;
  firstRowZ: number;
  rows: number;
  slots: Slot[];
  spawnZ: number;
};

export type HallLayout = {
  rooms: RoomLayout[];
  hallLength: number;
  /** z of the far end wall. */
  endZ: number;
  /** z of each partition wall between consecutive rooms. */
  partitions: number[];
  /** Real works (not reserved frames) in the whole building. */
  artworkCount: number;
};

function slotsFor(roomId: RoomId, works: ShowcaseVideo[], count: number, firstRowZ: number): Slot[] {
  return Array.from({ length: count }, (_, index) => ({
    key: works[index]?.id ?? `${roomId}-reserved-${index + 1}`,
    artwork: works[index] ?? null,
    side: index % 2 === 0 ? -1 : 1,
    z: firstRowZ - Math.floor(index / 2) * ROW_SPACING,
    slotNumber: index + 1,
  }));
}

export function computeHallLayout(artworks: ShowcaseVideo[]): HallLayout {
  let cursor = ENTRANCE_Z;
  const rooms = ROOMS.map((room, roomIndex): RoomLayout => {
    const isFirst = roomIndex === 0;
    const isLast = roomIndex === ROOMS.length - 1;
    const works = artworks.filter((artwork) => artwork.room === room.id);
    const slotCount = Math.max(room.reservedSlots, works.length);
    const rows = Math.max(MIN_ROWS, Math.ceil(slotCount / 2));
    const headOffset = isFirst ? FIRST_ROW_OFFSET_ENTRANCE : FIRST_ROW_OFFSET_PARTITION;
    const length = headOffset + (rows - 1) * ROW_SPACING + (isLast ? TAIL_BEFORE_END_WALL : TAIL_BEFORE_PARTITION);
    const startZ = cursor;
    const firstRowZ = startZ - headOffset;
    cursor = startZ - length;
    return {
      room,
      startZ,
      endZ: cursor,
      firstRowZ,
      rows,
      slots: slotsFor(room.id, works, slotCount, firstRowZ),
      spawnZ: startZ - (isFirst ? SPAWN_INSIDE_ENTRANCE : SPAWN_INSIDE_PARTITION),
    };
  });
  return {
    rooms,
    hallLength: ENTRANCE_Z - cursor,
    endZ: cursor,
    partitions: rooms.slice(0, -1).map((room) => room.endZ),
    artworkCount: artworks.length,
  };
}

/** Index of the room containing world position z (clamped to the first/last room). */
export function roomIndexAt(layout: HallLayout, z: number): number {
  const index = layout.rooms.findIndex((room) => z <= room.startZ && z > room.endZ);
  if (index !== -1) return index;
  return z > ENTRANCE_Z ? 0 : layout.rooms.length - 1;
}
