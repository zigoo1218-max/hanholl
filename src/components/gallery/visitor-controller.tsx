"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
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
const LANDSCAPE_FOV = 62;
const PORTRAIT_FOV = 80;
const MAX_FRAME_DELTA = 0.1;

type VisitorControllerProps = {
  hallLength: number;
  moveInput: RefObject<MoveInput>;
};

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
export function VisitorController({ hallLength, moveInput }: VisitorControllerProps) {
  const gl = useThree((state) => state.gl);
  const keys = useRef(new Set<string>());
  const activePointer = useRef<number | null>(null);
  const previousPointer = useRef({ x: 0, y: 0 });
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const yaw = useRef(0);
  const pitch = useRef(0);

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

    const smoothing = 1 - Math.exp(-LOOK_SMOOTHING * delta);
    yaw.current += (targetYaw.current - yaw.current) * smoothing;
    pitch.current += (targetPitch.current - pitch.current) * smoothing;
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
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
      camera.position.add(movement);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HALL_HALF_WIDTH, HALL_HALF_WIDTH);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -hallLength + END_WALL_MARGIN, ENTRANCE_LIMIT_Z);
    }
    camera.position.y = EYE_HEIGHT;
  });

  return null;
}
