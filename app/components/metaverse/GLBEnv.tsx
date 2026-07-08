"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export function GLBEnv({ src = "", receiveShadow = true, castShadow = true }) {
  let glb = useGLTF(src);

  //

  let clonedScene = useMemo(() => {
    return clone(glb.scene);
  }, [glb.scene]);

  let show = useMemo(() => {
    return <primitive object={clonedScene}></primitive>;
  }, [clonedScene]);

  useEffect(() => {
    clonedScene.traverse((it) => {
      //

      it.castShadow = castShadow;
      it.receiveShadow = receiveShadow;

      console.log(it.name);

      if (it.name === "") {
      }

      //
    });
  }, [clonedScene, receiveShadow, castShadow]);

  //

  return <>{show}</>;
}
