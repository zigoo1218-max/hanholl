"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { DOOR_WIDTH, PARTITION_THICKNESS, roomIndexAt, type HallLayout } from "@/components/gallery/layout";
import type { MoveInput } from "@/components/gallery-controls";

const EYE_HEIGHT = 1.72;
const WALK_SPEED = 4.2;
const LOOK_SENSITIVITY_X = 0.0042;
const LOOK_SENSITIVITY_Y = 0.003;
const PITCH_LIMIT = 0.72;
const LOOK_SMOOTHING = 14;
const HALL_HALF_WIDTH = 4.4;
const ENTRANCE_LIMIT_Z = 1.8;
const END_WALL_MARGIN = 5;
/** Keep the camera this far from wall faces and door posts so it never clips into them. */
const BODY_RADIUS = 0.35;
const DOOR_PASS_HALF_WIDTH = DOOR_WIDTH / 2 - BODY_RADIUS;
const PARTITION_BAND = PARTITION_THICKNESS / 2 + BODY_RADIUS;
const LANDSCAPE_FOV = 62;
/** Scratch vectors reused every frame to avoid per-frame allocations. */
const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const PORTRAIT_FOV = 80;
const MAX_FRAME_DELTA = 0.1;

type VisitorControllerProps = {
  layout: HallLayout;
  moveInput: RefObject<MoveInput>;
  /** Returns a pending room-jump index once, then null until the next request. */
  takeJumpRequest: () => number | null;
  onRoomChange: (roomIndex: number) => void;
};

/** True when standing at (x, z) would put the visitor inside a partition wall (outside its doorway). */
function hitsPartition(partitions: number[], x: number, z: number) {
  return Math.abs(x) > DOOR_PASS_HALF_WIDTH && partitions.some((partitionZ) => Math.abs(z - partitionZ) < PARTITION_BAND);
}

/** Keys are stored lower-cased so Shift or CapsLock cannot leave a key "stuck" between keydown and keyup. */
const FORWARD_KEYS = ["w", "ㅈ", "keyw", "arrowup"];
const BACK_KEYS = ["s", "ㄴ", "keys", "arrowdown"];
const RIGHT_KEYS = ["d", "ㅇ", "keyd", "arrowright"];
const LEFT_KEYS = ["a", "ㅁ", "keya", "arrowleft"];

function hasAny(keys: Set<string>, candidates: string[]) {
  return candidates.some((candidate) => keys.has(candidate));
}

/**
 * First-person walk for the exhibition. Keyboard and the on-screen pad move
 * the visitor; dragging with a mouse or a finger turns the view. Look input is
 * smoothed so projector audiences do not see jittery camera motion.
 */
export function VisitorController({ layout, moveInput, takeJumpRequest, onRoomChange }: VisitorControllerProps) {
  const gl = useThree((state) => state.gl);
  const keys = useRef(new Set<string>());
  const activePointer = useRef<number | null>(null);
  const previousPointer = useRef({ x: 0, y: 0 });
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const reportedRoom = useRef<number | null>(null);

  useEffect(() => {
    const element = gl.domElement;
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.key.toLowerCase());
      keys.current.add(event.code.toLowerCase());
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
      keys.current.delete(event.code.toLowerCase());
    };
    const onBlur = () => {
      keys.current.clear();
      activePointer.current = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onBlur();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      activePointer.current = event.pointerId;
      previousPointer.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (activePointer.current !== event.pointerId) return;
      if (event.pointerType === "mouse" && event.buttons === 0) {
        activePointer.current = null;
        return;
      }
      const deltaX = event.clientX - previousPointer.current.x;
      const deltaY = event.clientY - previousPointer.current.y;
      previousPointer.current = { x: event.clientX, y: event.clientY };
      targetYaw.current -= deltaX * LOOK_SENSITIVITY_X;
      targetPitch.current = THREE.MathUtils.clamp(targetPitch.current - deltaY * LOOK_SENSITIVITY_Y, -PITCH_LIMIT, PITCH_LIMIT);
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (activePointer.current === event.pointerId) activePointer.current = null;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [gl]);

  useFrame(({ camera, size }, rawDelta) => {
    // A backgrounded tab reports one huge delta on return; clamp it so the visitor does not teleport.
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA);
    // Widen the lens on portrait phones so both walls stay in view.
    if (camera instanceof THREE.PerspectiveCamera) {
      const desiredFov = size.width < size.height ? PORTRAIT_FOV : LANDSCAPE_FOV;
      if (camera.fov !== desiredFov) {
        camera.fov = desiredFov;
        camera.updateProjectionMatrix();
      }
    }

    // Room jump from the HUD: land just inside the room, facing down the hall.
    const requestedRoom = takeJumpRequest();
    if (requestedRoom !== null) {
      const target = layout.rooms[requestedRoom];
      if (target) {
        camera.position.set(0, EYE_HEIGHT, target.spawnZ);
        const fullTurns = Math.round(yaw.current / (Math.PI * 2)) * Math.PI * 2;
        targetYaw.current = fullTurns;
        yaw.current = fullTurns;
        targetPitch.current = 0;
        pitch.current = 0;
      }
    }

    const smoothing = 1 - Math.exp(-LOOK_SMOOTHING * delta);
    yaw.current += (targetYaw.current - yaw.current) * smoothing;
    pitch.current += (targetPitch.current - pitch.current) * smoothing;
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    const forward = scratchForward.set(0, 0, -1).applyEuler(camera.rotation);
    const right = scratchRight.set(1, 0, 0).applyEuler(camera.rotation);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const pad = moveInput.current ?? { forward: 0, right: 0 };
    const pressed = keys.current;
    const forwardAmount = pad.forward + (hasAny(pressed, FORWARD_KEYS) ? 1 : 0) - (hasAny(pressed, BACK_KEYS) ? 1 : 0);
    const rightAmount = pad.right + (hasAny(pressed, RIGHT_KEYS) ? 1 : 0) - (hasAny(pressed, LEFT_KEYS) ? 1 : 0);

    const movement = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount));
    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(delta * WALK_SPEED);
      const nextX = THREE.MathUtils.clamp(camera.position.x + movement.x, -HALL_HALF_WIDTH, HALL_HALF_WIDTH);
      const nextZ = THREE.MathUtils.clamp(camera.position.z + movement.z, layout.endZ + END_WALL_MARGIN, ENTRANCE_LIMIT_Z);
      // Resolve each axis separately so the visitor slides along a partition instead of sticking to it.
      if (!hitsPartition(layout.partitions, nextX, camera.position.z)) camera.position.x = nextX;
      if (!hitsPartition(layout.partitions, camera.position.x, nextZ)) camera.position.z = nextZ;
    }
    camera.position.y = EYE_HEIGHT;

    const currentRoom = roomIndexAt(layout, camera.position.z);
    if (currentRoom !== reportedRoom.current) {
      reportedRoom.current = currentRoom;
      onRoomChange(currentRoom);
    }
  });

  return null;
}
