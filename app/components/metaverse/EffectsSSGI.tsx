"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
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
  equirectUV,
  textureCubeUV,
  texture3D,
} from "three/tsl";

import {
  //
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  RenderPipeline,
  Spherical,
  Texture,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";

import { Color, Scene } from "three/webgpu";
import { UnsignedByteType } from "three/webgpu";

import {
  Timer,
  FloatType,
  HalfFloatType,
  WebGLRenderer,
  EquirectangularReflectionMapping,
} from "three";
import { HDRLoader } from "three/examples/jsm/Addons.js";

export function EffectsSSGI({ children = null }: { children: any }) {
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
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
        emissive: emissive,
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
    const scenePassEmissive = scenePass
      .getTextureNode("emissive")
      .toInspector("Emissive");

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
    giPass.backfaceLighting = uniform(float(1));
    giPass.giIntensity = uniform(float(5));
    giPass.aoIntensity = uniform(float(1));

    const ao = giPass.getAONode().toInspector("SSGI.AO");
    const gi = giPass.getGINode().toInspector("SSGI.GI");

    // bloom — gaussian blur of emissive channel, overlay on composite
    const bloomWidth = uniform(float(gl.domElement.width));
    const bloomHeight = uniform(float(gl.domElement.height));
    const texelX = float(1).div(bloomWidth);
    const texelY = float(1).div(bloomHeight);
    const bloomIntensity = uniform(float(0.6));

    const bloomOffsets = [-2, -1, 0, 1, 2];
    const bloomWeights = [0.054, 0.244, 0.403, 0.244, 0.054];

    const bloom = sample((_uv: any) => {
      let col = vec3(float(0), float(0), float(0));
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          (col as any).addAssign(
            scenePassEmissive
              .sample(
                _uv.add(
                  vec2(
                    float(bloomOffsets[i]).mul(texelX),
                    float(bloomOffsets[j]).mul(texelY),
                  ),
                ),
              )
              .rgb.mul(bloomWeights[i] * bloomWeights[j]),
          );
        }
      }
      return col;
    });
    bloom.name = "Bloom";

    // composite (AO * scene + GI * diffuse, then overlay bloom)
    const compositePass = vec4(
      add(
        add(scenePassColor.rgb.mul(ao.r), scenePassDiffuse.rgb.mul(gi.rgb)),
        bloom.mul(bloomIntensity),
      ),
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

    const loader = new HDRLoader();
    loader.loadAsync(`/assets/place/sky.hdr`).then((sky) => {
      //
      sky.mapping = EquirectangularReflectionMapping;

      const prm = new PMREMGenerator(gl as any);
      prm.compileEquirectangularShader();
      const rtt = prm.fromEquirectangular(sky);

      scene.environment = rtt.texture;
      scene.environmentIntensity = 0.5;
      scene.background = rtt.texture;
      scene.backgroundIntensity = 0.5;

      console.log(sky);

      setTimeout(() => {
        setReady(true);
      });
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

  return <>{ready && children}</>;
}
