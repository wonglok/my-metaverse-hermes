import { useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";

export const MIN_PHI = 0.15;
export const MAX_PHI = Math.PI / 2 - 0.1;
export const MIN_DIST = 3;
export const MAX_DIST = 20;
export const DEFAULT_DIST = 8;
export const LERP_SPEED = 8;
export const LOOK_TARGET_Y = 1.0;

interface CameraControllerProps {
  thetaRef: React.RefObject<number>;
  phiRef: React.RefObject<number>;
  distRef: React.RefObject<number>;
}

/** Handles mouse orbit + scroll zoom. Writes camera angles/dist to shared refs. */
export function CameraController({
  thetaRef,
  phiRef,
  distRef,
}: CameraControllerProps) {
  const { gl } = useThree();

  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = gl.domElement;

    function onDown(e: MouseEvent) {
      dragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
    function onUp() {
      dragging.current = false;
    }
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      thetaRef.current -= dx * 0.005;
      phiRef.current = Math.min(
        MAX_PHI,
        Math.max(MIN_PHI, phiRef.current - dy * 0.005),
      );
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
    function onWheel(e: WheelEvent) {
      distRef.current = Math.min(
        MAX_DIST,
        Math.max(MIN_DIST, distRef.current + e.deltaY * 0.01),
      );
    }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  return null;
}
