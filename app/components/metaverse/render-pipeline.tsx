"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";

import { pass, mrt, output, emissive, vec4 } from "three/tsl";

import {
  PerspectiveCamera,
  PMREMGenerator,
  RenderPipeline,
  WebGPURenderer,
} from "three/webgpu";

import { Scene } from "three/webgpu";

import { WebGLRenderer, EquirectangularReflectionMapping } from "three";
import { HDRLoader } from "three/examples/jsm/Addons.js";

export function EffectsSSGI({ children = null }: { children: any }) {
  const [ready, setReady] = useState(false);
  let gl = useThree((r) => r.gl) as
    | (
        | WebGLRenderer
        | (WebGPURenderer & {
            domElement: { parentElement: { parentElement: HTMLDivElement } };
          })
      )
    | null;

  let scene = useThree((r) => r.scene) as Scene;
  let camera = useThree((r) => r.camera) as PerspectiveCamera;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let stats = new Stats();
    stats.dom.style.position = "absolute";
    stats.dom.style.touchAction = "none";
    stats.dom.style.top = "";
    stats.dom.style.left = "";
    stats.dom.style.right = "0px";
    stats.dom.style.top = "0px";

    if (gl?.domElement?.parentElement?.parentElement) {
      gl.domElement.parentElement.parentElement.appendChild(stats.dom);
    }
    let rr = () => {
      stats.update();
      requestAnimationFrame(rr);
    };
    requestAnimationFrame(rr);

    return () => {
      gl?.domElement?.parentElement?.parentElement?.removeChild(stats.dom);
    };
  }, []);

  useEffect(() => {
    if (!scene || !camera || !gl) {
      return;
    }
    let pipe = new RenderPipeline(gl as WebGPURenderer);

    const scenePass = pass(scene, camera);
    scenePass.setMRT(
      mrt({
        output: output,
        emissive: emissive,
      }),
    );

    const scenePassColor = scenePass.getTextureNode("output");
    const scenePassEmissive = scenePass
      .getTextureNode("emissive")
      .toInspector("Emissive");

    const bloomPass = bloom(scenePassEmissive, 80, 1, 0.1);

    // composite: scene color + bloom
    const compositePass = vec4(
      scenePassColor.rgb.add(bloomPass),
      scenePassColor.a,
    );

    pipe.outputNode = compositePass;

    let frame = 0;
    let hh = () => {
      frame = requestAnimationFrame(hh);
      if ((gl as { initialized: boolean }).initialized || true) {
        try {
          pipe?.render();
        } catch (e) {
          console.trace(e);
        }
      }
    };
    frame = requestAnimationFrame(hh);

    const loader = new HDRLoader();
    loader.loadAsync(`/assets/place/sky.hdr`).then((sky) => {
      sky.mapping = EquirectangularReflectionMapping;

      const prm = new PMREMGenerator(gl as any);
      prm.compileEquirectangularShader();
      const rtt = prm.fromEquirectangular(sky);

      scene.environment = rtt.texture;
      scene.environmentIntensity = 0.35;
      scene.background = rtt.texture;
      scene.backgroundIntensity = 0.5;

      setTimeout(() => {
        setReady(true);
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      pipe.dispose();
    };
  }, [scene, camera, gl]);

  useFrame(() => {}, 11);

  return <>{ready && children}</>;
}
