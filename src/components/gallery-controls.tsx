"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Movement input shared between the on-screen pad and the 3D camera loop.
 * It is intentionally a mutable ref object: the camera reads it every frame,
 * and allocating a new object per touch would only add garbage without benefit.
 */
export type MoveInput = {
  forward: number;
  right: number;
};

export function createMoveInput(): MoveInput {
  return { forward: 0, right: 0 };
}

type TouchPadProps = {
  inputRef: RefObject<MoveInput>;
};

type PadButton = {
  label: string;
  axis: keyof MoveInput;
  value: 1 | -1;
  className: string;
  Icon: typeof ChevronUp;
};

const BUTTONS: PadButton[] = [
  { label: "앞으로 이동", axis: "forward", value: 1, className: "col-start-2 row-start-1", Icon: ChevronUp },
  { label: "왼쪽으로 이동", axis: "right", value: -1, className: "col-start-1 row-start-2", Icon: ChevronLeft },
  { label: "오른쪽으로 이동", axis: "right", value: 1, className: "col-start-3 row-start-2", Icon: ChevronRight },
  { label: "뒤로 이동", axis: "forward", value: -1, className: "col-start-2 row-start-3", Icon: ChevronDown },
];

/**
 * Directional pad for touch devices. Pointer capture keeps the input alive
 * while the finger is held and releases it on any exit so the visitor never
 * keeps walking after lifting a finger.
 */
export function TouchPad({ inputRef }: TouchPadProps) {
  const pressed = useRef(new Set<string>());

  /** Recomputes both axes from every button currently held, so opposite buttons never cancel a held one. */
  const sync = () => {
    if (!inputRef.current) return;
    const held = BUTTONS.filter((button) => pressed.current.has(button.label));
    inputRef.current.forward = held.filter((button) => button.axis === "forward").reduce((sum, button) => sum + button.value, 0);
    inputRef.current.right = held.filter((button) => button.axis === "right").reduce((sum, button) => sum + button.value, 0);
  };
  const press = (label: string) => {
    pressed.current.add(label);
    sync();
  };
  const release = (label: string) => {
    pressed.current.delete(label);
    sync();
  };

  // If the pad unmounts mid-press (idle reset, list view, dialog), stop walking.
  useEffect(() => {
    const pressedSet = pressed.current;
    const input = inputRef.current;
    return () => {
      pressedSet.clear();
      if (input) {
        input.forward = 0;
        input.right = 0;
      }
    };
  }, [inputRef]);

  return (
    <div aria-label="전시관 이동 조작" className="touch-pad" role="group">
      {BUTTONS.map(({ label, className, Icon }) => (
        <button
          key={label}
          aria-label={label}
          className={`touch-pad-button ${className}`}
          type="button"
          onContextMenu={(event) => event.preventDefault()}
          onLostPointerCapture={() => release(label)}
          onPointerCancel={() => release(label)}
          onPointerDown={(event) => {
            press(label);
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch (error) {
              console.warn("터치 패드 포인터 캡처에 실패했습니다. 손가락이 버튼을 벗어나면 이동이 멈춥니다.", error);
            }
          }}
          onPointerLeave={() => release(label)}
          onPointerUp={() => release(label)}
        >
          <Icon aria-hidden="true" className="h-6 w-6" />
        </button>
      ))}
      <span aria-hidden="true" className="touch-pad-center" />
    </div>
  );
}
