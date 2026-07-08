import { useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";

export const MIN_PHI = 0.15;
export const MAX_PHI = Math.PI / 2 - 0.1;
export const MIN_DIST = 3;
export const MAX_DIST = 200;
export const DEFAULT_DIST = 8;
export const LERP_SPEED = 8;
export const LOOK_TARGET_Y = 1.0;

interface CameraControllerProps {
  thetaRef: React.RefObject<number>;
  phiRef: React.RefObject<number>;
  distRef: React.RefObject<number>;
}

/** Handles mouse orbit + touch orbit + scroll/pinch zoom. Writes camera angles/dist to shared refs. */
export function CameraController({
  thetaRef,
  phiRef,
  distRef,
}: CameraControllerProps) {
  const { gl } = useThree();

  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;

    // ── Mouse ──────────────────────────────────────────────────────────

    function onMouseDown(e: MouseEvent) {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
    function onMouseUp() {
      dragging.current = false;
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      thetaRef.current -= dx * 0.005;
      phiRef.current = Math.min(
        MAX_PHI,
        Math.max(MIN_PHI, phiRef.current - dy * 0.005),
      );
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      distRef.current = Math.min(
        MAX_DIST,
        Math.max(MIN_DIST, distRef.current + e.deltaY * 0.01),
      );
    }

    // ── Touch ──────────────────────────────────────────────────────────

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      e.preventDefault();
      if (e.touches.length === 1) {
        dragging.current = true;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        dragging.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist.current = Math.hypot(dx, dy);
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      e.preventDefault();
      if (e.touches.length === 1 && dragging.current) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        thetaRef.current -= dx * 0.005;
        phiRef.current = Math.min(
          MAX_PHI,
          Math.max(MIN_PHI, phiRef.current - dy * 0.005),
        );
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const delta = lastPinchDist.current - dist;
        distRef.current = Math.min(
          MAX_DIST,
          Math.max(MIN_DIST, distRef.current + delta * 0.02),
        );
        lastPinchDist.current = dist;
      }
    }

    function onTouchEnd() {
      dragging.current = false;
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl]);

  return null;
}
