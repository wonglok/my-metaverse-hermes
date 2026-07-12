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
        className="pointer-events-auto absolute bottom-6 left-6 h-36 w-36 rounded-full bg-black/20 backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex items-center justify-center"
      >
        <svg
          width="800px"
          height="800px"
          viewBox="0 0 16 16"
          fill="#ffffff"
          className="w-[50px] h-[50px]"
        >
          <path d="M10 2a2 2 0 0 1-1.5 1.937v5.087c.863.083 1.5.377 1.5.726 0 .414-.895.75-2 .75s-2-.336-2-.75c0-.35.637-.643 1.5-.726V3.937A2 2 0 1 1 10 2z" />
          <path d="M0 9.665v1.717a1 1 0 0 0 .553.894l6.553 3.277a2 2 0 0 0 1.788 0l6.553-3.277a1 1 0 0 0 .553-.894V9.665c0-.1-.06-.19-.152-.23L9.5 6.715v.993l5.227 2.178a.125.125 0 0 1 .001.23l-5.94 2.546a2 2 0 0 1-1.576 0l-5.94-2.546a.125.125 0 0 1 .001-.23L6.5 7.708l-.013-.988L.152 9.435a.25.25 0 0 0-.152.23z" />
        </svg>
      </div>

      <div
        ref={jumpRef}
        className="pointer-events-auto absolute bottom-8 right-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/30 backdrop-blur-2xl text-sm font-semibold text-white/70 shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] select-none active:bg-white/[0.12] active:border-white/[0.14] transition-all duration-150"
      >
        JUMP
      </div>
    </>
  );
}
