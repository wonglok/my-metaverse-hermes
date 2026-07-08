"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";

//
import {
  pass,
  mrt,
  output,
  normalView,
  metalness,
  roughness,
  diffuseColor,
  velocity,
  vec2,
  vec4,
  add,
  directionToColor,
  colorToDirection,
  sample,
  //
  vec3,
  texture,
  uv,
  emissive,
  mul,
  uniform,
  mix,
  blendColor,
  float,
  packNormalToRGB,
  unpackRGBToNormal,
} from "three/tsl";

import {
  //
  Object3D,
  PerspectiveCamera,
  RenderPipeline,
  Spherical,
  Texture,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";

import { Color, Scene } from "three/webgpu";
import { UnsignedByteType } from "three/webgpu";

import { Timer, FloatType, HalfFloatType, WebGLRenderer } from "three";
import { HDRLoader } from "three/examples/jsm/Addons.js";

export function EffectsSSGI() {
  // let useDynamicStore = useStoreOfApp();
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

  //

  useEffect(() => {
    //
    if (process.env.NODE_ENV === "development") {
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
    }
  }, []);

  // let lighting = useDynamicStore(
  //   (r: any) => r.lighting,
  // ) as SunlightObject | null;

  useEffect(() => {
    // if (!lighting) {
    //   return;
    // }
    if (!scene || !camera || !gl) {
      return;
    }
    let pipe = new RenderPipeline(gl as WebGPURenderer);

    const scenePass = pass(scene, camera);
    scenePass.setMRT(
      mrt({
        output: output,
        diffuseColor: diffuseColor,
        normal: packNormalToRGB(normalView),
        velocity: velocity,
      }),
    );

    const scenePassColor = scenePass.getTextureNode("output");
    const scenePassDiffuse = scenePass
      .getTextureNode("diffuseColor")
      .toInspector("Diffuse Color");
    const scenePassDepth = scenePass
      .getTextureNode("depth")
      .toInspector("Depth", () => {
        return scenePass.getLinearDepthNode();
      });

    const scenePassNormal = scenePass
      .getTextureNode("normal")
      .toInspector("Normal");
    const scenePassVelocity = scenePass
      .getTextureNode("velocity")
      .toInspector("Velocity");

    // bandwidth optimization

    const diffuseTexture = scenePass.getTexture("diffuseColor");
    diffuseTexture.type = UnsignedByteType;

    const normalTexture = scenePass.getTexture("normal");
    normalTexture.type = UnsignedByteType;

    const sceneNormal = sample((uv) => {
      return unpackRGBToNormal(scenePassNormal.sample(uv));
    });

    // gi

    const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);
    giPass.sliceCount.value = 2;
    giPass.stepCount.value = 8;

    // composite

    const ao = giPass.getAONode().toInspector("SSGI.AO");
    const gi = giPass.getGINode().toInspector("SSGI.GI");

    const compositePass = vec4(
      add(scenePassColor.rgb.mul(ao.r), scenePassDiffuse.rgb.mul(gi.rgb)),
      scenePassColor.a,
    );
    compositePass.name = "Composite";

    // traa

    const traaPass = traa(
      compositePass,
      scenePassDepth,
      scenePassVelocity,
      camera,
    );

    pipe.outputNode = traaPass;

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

    console.log(gl);

    let loader = new HDRLoader();
    loader.loadAsync(`/assets/place/sky.hdr`).then((sky) => {
      //

      scene.backgroundNode = vec3(texture(sky, uv()));

      scene.environmentNode = vec3(texture(sky, uv()));

      console.log(sky);
      //
    });
    //

    return () => {
      // cancelSubs();
      // cancelRunning();
      cancelAnimationFrame(frame);
      pipe.dispose();
    };
  }, [scene, camera, gl]);

  useFrame(() => {}, 11);

  return <></>;
}
