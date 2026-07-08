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
}

export function JoystickControls({
  keysRef,
  spacePressedRef,
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
      mode: "semi",
      color: "rgba(255,255,255,0.7)",
      size: 120,
      threshold: 0.3,
    });

    const resetKeys = () => {
      keysRef.current.fwd = false;
      keysRef.current.bkd = false;
      keysRef.current.lft = false;
      keysRef.current.rgt = false;
    };

    manager.on("move", (_evt: unknown, data: { angle: { degree: number }; force: number }) => {
      if (data.force < 0.3) {
        resetKeys();
        return;
      }

      resetKeys();

      const a = data.angle.degree;

      // 8-directional mapping (45° sectors, 0° = up, clockwise)
      if (a >= 337.5 || a < 22.5) {
        keysRef.current.fwd = true;
      } else if (a >= 22.5 && a < 67.5) {
        keysRef.current.fwd = true;
        keysRef.current.rgt = true;
      } else if (a >= 67.5 && a < 112.5) {
        keysRef.current.rgt = true;
      } else if (a >= 112.5 && a < 157.5) {
        keysRef.current.bkd = true;
        keysRef.current.rgt = true;
      } else if (a >= 157.5 && a < 202.5) {
        keysRef.current.bkd = true;
      } else if (a >= 202.5 && a < 247.5) {
        keysRef.current.bkd = true;
        keysRef.current.lft = true;
      } else if (a >= 247.5 && a < 292.5) {
        keysRef.current.lft = true;
      } else if (a >= 292.5 && a < 337.5) {
        keysRef.current.fwd = true;
        keysRef.current.lft = true;
      }
    });

    manager.on("end", () => {
      resetKeys();
    });

    // Jump button touch handler
    const handleJump = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      spacePressedRef.current = true;
    };

    jump?.addEventListener("touchstart", handleJump, { passive: false });

    return () => {
      manager.destroy();
      jump?.removeEventListener("touchstart", handleJump);
    };
  }, [keysRef, spacePressedRef]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 md:hidden">
      {/* Joystick zone */}
      <div
        ref={zoneRef}
        className="pointer-events-auto absolute bottom-6 left-6 h-36 w-36"
      />

      {/* Jump button */}
      <div
        ref={jumpRef}
        className="pointer-events-auto absolute bottom-8 right-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/50 bg-white/15 text-sm font-bold text-white/80 shadow-lg backdrop-blur select-none active:bg-white/30"
      >
        JUMP
      </div>
    </div>
  );
}
