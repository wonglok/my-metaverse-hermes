"use client";

import { useEffect, useRef } from "react";
import { create } from "nipplejs";

interface JoystickControlsProps {
  keysRef: React.MutableRefObject<{
    fwd: boolean;
    bkd: boolean;
    lft: boolean;
    rgt: boolean;
    space: boolean;
  }>;
  spacePressedRef: React.MutableRefObject<boolean>;
  joystickInputRef: React.MutableRefObject<{
    active: boolean;
    angle: number;
    force: number;
  }>;
}

export function JoystickControls({
  keysRef,
  spacePressedRef,
  joystickInputRef,
}: JoystickControlsProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const zone = zoneRef.current;
    const jump = jumpRef.current;
    if (!zone) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manager: any = create({
      zone,
      mode: "dynamic",
      color: "rgba(255,255,255,0.7)",
      size: 120,
      threshold: 0.3,
    });

    manager.on(
      "move",
      (evt: { data: { angle: { radian: number }; force: number } }) => {
        const { angle, force } = evt.data;

        if (force < 0.2) {
          keysRef.current.fwd = false;
          joystickInputRef.current.active = false;
          return;
        }

        keysRef.current.fwd = true;
        joystickInputRef.current.active = true;
        joystickInputRef.current.angle = angle.radian;
        joystickInputRef.current.force = force;
      },
    );

    manager.on("end", () => {
      keysRef.current.fwd = false;
      joystickInputRef.current.active = false;
    });

    let jumpInterval: ReturnType<typeof setInterval> | null = null;

    const startJump = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      spacePressedRef.current = true;
      jumpInterval = setInterval(() => {
        spacePressedRef.current = true;
      }, 150);
    };

    const stopJump = () => {
      if (jumpInterval) {
        clearInterval(jumpInterval);
        jumpInterval = null;
      }
    };

    jump?.addEventListener("touchstart", startJump, { passive: false });
    jump?.addEventListener("touchend", stopJump);
    jump?.addEventListener("touchcancel", stopJump);

    return () => {
      manager.destroy();
      if (jumpInterval) clearInterval(jumpInterval);
      jump?.removeEventListener("touchstart", startJump);
      jump?.removeEventListener("touchend", stopJump);
      jump?.removeEventListener("touchcancel", stopJump);
    };
  }, [keysRef, spacePressedRef, joystickInputRef]);

  return (
    <>
      <div
        ref={zoneRef}
        className="pointer-events-auto absolute bottom-6 left-6 h-36 w-36 bg-white/20 rounded-full"
      />

      <div
        ref={jumpRef}
        className="pointer-events-auto absolute bottom-8 right-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/50 bg-white/15 text-sm font-bold text-white/80 shadow-lg backdrop-blur select-none active:bg-white/30"
      >
        JUMP
      </div>
    </>
  );
}
