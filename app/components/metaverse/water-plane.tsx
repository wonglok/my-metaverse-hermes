import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { WaterMesh } from "three/examples/jsm/objects/WaterMesh.js";

const WATER_GEOMETRY = new THREE.PlaneGeometry(500, 500);

/** Large reflective water plane at y=-10. Time animation handled internally by TSL. */
export function WaterPlane() {
  const { scene } = useThree();
  const waterRef = useRef<WaterMesh | null>(null);

  useEffect(() => {
    const normalsTexture = new THREE.TextureLoader().load(
      "/assets/water/waternormals.jpg",
    );
    normalsTexture.wrapS = normalsTexture.wrapT = THREE.RepeatWrapping;
    normalsTexture.repeat.set(10, 10);

    const water = new WaterMesh(WATER_GEOMETRY, {
      waterNormals: normalsTexture,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x001e3c,
      distortionScale: 3.0,
    });
    water.position.set(0, -10, 0);
    water.rotation.x = -Math.PI / 2;
    waterRef.current = water;
    scene.add(water);

    return () => {
      scene.remove(water);
      water.geometry.dispose();
      water.material.dispose();
    };
  }, [scene]);

  return null;
}
