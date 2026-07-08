import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";

const WATER_GEOMETRY = new THREE.PlaneGeometry(500, 500);

/** Large reflective water plane at y=-10. Animates via time uniform. */
export function WaterPlane() {
  const { scene } = useThree();
  const waterRef = useRef<Water | null>(null);

  useEffect(() => {
    const normalsTexture = new THREE.TextureLoader().load(
      "/assets/water/waternormals.jpg",
      () => {
        water.material.uniforms.time.value = 0;
      },
    );
    normalsTexture.wrapS = normalsTexture.wrapT = THREE.RepeatWrapping;
    normalsTexture.repeat.set(10, 10);

    const water = new Water(WATER_GEOMETRY, {
      textureWidth: 1024,
      textureHeight: 1024,
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
      (water.material as THREE.ShaderMaterial).dispose();
    };
  }, [scene]);

  useFrame((_, delta) => {
    if (!waterRef.current) return;
    waterRef.current.material.uniforms.time.value += delta;
  });

  return null;
}
