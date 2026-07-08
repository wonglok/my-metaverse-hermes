"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { ssr } from "three/examples/jsm/tsl/display/SSRNode.js";
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
} from "three/tsl";

import {
  //
  Object3D,
  PerspectiveCamera,
  Spherical,
  Texture,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";

import { Color, Scene } from "three/webgpu";
import {
  EquirectangularReflectionMapping,
  PostProcessing,
  UnsignedByteType,
} from "three/webgpu";
import { DirectionalLight } from "three/webgpu";
import { PCFSoftShadowMap } from "three/webgpu";

import {
  ClockIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  Orbit,
  GripVertical,
  MoreVertical,
  MoveVertical,
} from "lucide-react";

import { Timer, FloatType, HalfFloatType, WebGLRenderer } from "three";
import { useStoreOfApp, type AppInitStateType } from "./AppContext";
import { HDRLoader } from "three/examples/jsm/Addons.js";
// import { AppInitStateType, useStoreOfApp } from '../CanvasEditor/AppContext'
// import { boxBlur } from 'three/examples/jsm/tsl/display/boxBlur.js';

// import gsap from 'gsap';
// import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js';
// // import { fxaa } from 'three/examples/jsm/tsl/display/FXAANode.js';
// import { boxBlur } from 'three/examples/jsm/tsl/display/boxBlur.js';
let rgbeLoader = new HDRLoader();

export class SunlightObject extends Object3D {
  static configureShadow({ renderer }: any) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  }

  public sunLight;
  public scene: Scene;
  public loadHDR;
  public warmColor;
  public whiteColor;
  public target;
  public orbital;

  public spherical;

  private lastMotion;

  //

  /**
   * @property {THREE.WebGLRenderer} renderer The Three.js renderer to enable shadows on.
   * @property {THREE.Object3D} [targetObject=new THREE.Object3D()] An object for the sun to always face.
   */
  constructor({
    targetObject = new Object3D(),
    scene,
    renderer,
  }: {
    targetObject: Object3D;
    scene: Scene;
    renderer: WebGPURenderer;
  }) {
    super();

    const applyBackground = (tex: Texture) => {
      if (!scene) {
        return;
      }

      scene.environmentNode = texture(tex, uv()).rgb.mul(1.5);

      scene.backgroundNode = texture(tex, uv()).mul(1);
    };

    this.loadHDR = (url = `/hdr/poly_haven_studio_1k.hdr`) => {
      //
      //
      rgbeLoader.loadAsync(`${url}`).then((texture) => {
        texture.mapping = EquirectangularReflectionMapping;
        texture.needsUpdate = true;
        texture.flipY = true;

        applyBackground(texture);
      });
    };

    // this.envMat = envMat

    this.spherical = new Spherical(100, 0, 0);

    this.scene = scene;

    this.warmColor = new Color("#dc8e35");
    this.whiteColor = new Color("#ffffff");

    this.target = targetObject;

    this.sunLight = new DirectionalLight(0xffffff, 1.0);
    this.sunLight.castShadow = true;

    this.add(this.sunLight);
    this.add(this.sunLight.target);

    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 150 * 2;

    this.sunLight.shadow.camera.left = -35 * 10;
    this.sunLight.shadow.camera.right = 35 * 10;
    this.sunLight.shadow.camera.bottom = -35 * 10;
    this.sunLight.shadow.camera.top = 35 * 10;

    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.radius = 1;
    this.sunLight.shadow.bias = -0.00035;

    this.sunLight.shadow.intensity = 1;
    this.sunLight.intensity = 1.5;

    this.lastMotion = 0;

    this.orbital = new Vector3();
  }

  public static vec2 = new Vector2();

  update(daytime = 0, orbit = 0) {
    const phi = daytime * Math.PI + Math.PI * 0.5;
    const theta = orbit * Math.PI * 2 + Math.PI * 0.5;

    const radius = 100;

    // // let leftRight = (daytime * 2.0 - 1.0) * -1.0;
    // let v010 = 1.0 - Math.abs(daytime * 2.0 - 1.0);
    // let orig010 = v010;
    // v010 = Math.pow(v010, 0.5)
    // v010 = Math.min(v010, 1.0)

    // const x = radius * leftRight;
    // const y = radius * v010;
    // const z = v010 * 12.5;

    this.orbital.setFromSphericalCoords(
      //
      1,
      phi,
      theta,
    );

    this.sunLight.position.copy(this.orbital).multiplyScalar(radius * -1);

    SunlightObject.vec2.set(this.orbital.x, this.orbital.z);
    let v010 = 1.0 - SunlightObject.vec2.length();

    this.sunLight.target.position.copy(this.target.position);
    this.sunLight.color.lerpColors(this.warmColor, this.whiteColor, v010);

    let latestMotion = Math.pow(v010, 1.0);
    latestMotion = Math.min(1, latestMotion);

    if (latestMotion !== this.lastMotion) {
      this.lastMotion = latestMotion;

      this.scene.backgroundIntensity = v010 * 1.0;
      this.scene.environmentIntensity = v010 * 1.0;

      this.sunLight.shadow.intensity = 1.0 - latestMotion;

      this.sunLight.intensity = latestMotion * 5;

      this.scene.traverse((it: any) => {
        if (it?.material) {
          it.material.emissiveIntensity = 5;
        }
      });
    }
  }
}

export function EffectsSSGI() {
  let useDynamicStore = useStoreOfApp();
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

  let lighting = useDynamicStore(
    (r: any) => r.lighting,
  ) as SunlightObject | null;

  useEffect(() => {
    if (!lighting) {
      return;
    }
    if (!scene || !camera || !gl) {
      return;
    }
    let postProcessing = new PostProcessing(gl as WebGPURenderer);

    const scenePass = pass(scene as Scene, camera as PerspectiveCamera);

    scenePass.setMRT(
      mrt({
        output: output,
        // emissive: emissive,
        diffuseColor: diffuseColor,
        normal: directionToColor(normalView),
        // metalrough: vec2(metalness, roughness), // pack metalness and roughness into a single attachment
        velocity: velocity,
      }),
    );

    const scenePassColor = scenePass.getTextureNode("output");
    const scenePassDiffuse = scenePass.getTextureNode("diffuseColor");
    const scenePassDepth = scenePass.getTextureNode("depth");

    const scenePassNormal = scenePass.getTextureNode("normal");
    const scenePassVelocity = scenePass.getTextureNode("velocity");

    // bandwidth optimization
    const diffuseTexture = scenePass.getTexture("diffuseColor");
    diffuseTexture.type = UnsignedByteType;

    const normalTexture = scenePass.getTexture("normal");
    normalTexture.type = UnsignedByteType;

    // const velocityTexture = scenePass.getTexture('velocity');
    // velocityTexture.type = UnsignedByteType;

    const sceneNormal = sample((uv) => {
      return colorToDirection(scenePassNormal.sample(uv));
    });

    //

    // gi
    const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);
    // giPass.sliceCount.value = 2;
    // giPass.stepCount.value = 8;

    // composite

    const alpha = scenePassColor.a;
    const gi = giPass.rgb.toInspector("SSGI");
    const ao = giPass.a.toInspector("AO");

    const compositePass = vec4(
      add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)),
      alpha,
    );
    compositePass.name = "Composite";

    //

    // const scenePassColor = scenePass.getTextureNode('output');
    // const scenePassEmissive = scenePass.getTextureNode('emissive');
    // const scenePassDiffuse = scenePass.getTextureNode('diffuseColor');
    // const scenePassDepth = scenePass.getTextureNode('depth');
    // const scenePassNormal = scenePass.getTextureNode('normal');
    // const scenePassMetalRough = scenePass.getTextureNode('metalrough');
    // const scenePassVelocity = scenePass.getTextureNode('velocity');

    // const diffuseTexture = scenePass.getTexture('diffuseColor');
    // diffuseTexture.type = UnsignedByteType;

    // const normalTexture = scenePass.getTexture('normal');
    // normalTexture.type = UnsignedByteType;

    // const metalRoughTexture = scenePass.getTexture('metalrough');
    // metalRoughTexture.type = UnsignedByteType;

    // const sceneNormal = sample((uv) => colorToDirection(scenePassNormal.sample(uv)));

    // .add(scenePassEmissive)
    const bloomPass = bloom(scenePassColor, 1.0, 1.0, 1.0);
    bloomPass.smoothWidth.value = 1;

    // const giPass = ssgi(scenePassColor.add(bloomPass), scenePassDepth, sceneNormal, camera as PerspectiveCamera);

    giPass.sliceCount.value = 2;
    giPass.stepCount.value = 16;

    giPass.giIntensity.value = 20.0;
    giPass.aoIntensity.value = 1;

    giPass.radius.value = 50;
    giPass.expFactor.value = 3;

    giPass.backfaceLighting.value = 0.5;

    giPass.useScreenSpaceSampling.value = true;
    giPass.useTemporalFiltering = true;

    // const gi = giPass.rgb;
    // const ao = giPass.a;

    // const ssrPass = ssr(scenePassColor, scenePassDepth, sceneNormal, scenePassMetalRough.r, scenePassMetalRough.g, camera);

    // ssrPass.maxDistance.value = 1.0;
    // ssrPass.opacity.value = 0.35;
    // ssrPass.quality.value = 0.35;
    // ssrPass.blurQuality.value = 0.35;
    // ssrPass.thickness.value = 0.25;

    // const sssPass = sss(scenePassDepth, camera, lighting.sunLight);
    // sssPass.useTemporalFiltering = true;
    // const sssBlur = boxBlur(ssrPass.rgb, { size: float(4), separation: float(2) }); // optional blur

    const withoutGI = vec4(scenePassColor.rgb.add(bloomPass.rgb), alpha); // .add(ssrPass.rgb)

    // const mixTogether = vec4(withoutGI.add(gi).rgb.mul(ao), alpha);

    const traaPass = traa(
      compositePass,
      scenePassDepth,
      scenePassVelocity,
      camera,
    );
    // traaPass.depthThreshold = 20;
    // traaPass.edgeDepthDiff = 20;
    // traaPass.maxVelocityLength = 20;
    // traaPass.useSubpixelCorrection = true;

    const raytraceOutput = vec4(traaPass.rgb.add(bloomPass.rgb), alpha);

    const applyRenderSettings = (now: AppInitStateType) => {
      if (now.render === "ssgi") {
        postProcessing.outputNode = vec4(raytraceOutput.rgb, alpha);
        postProcessing.needsUpdate = true;
      } else if (now.render === "ssr") {
        postProcessing.outputNode = vec4(withoutGI.rgb, alpha);
        postProcessing.needsUpdate = true;
      } else if (now.render === "bloom") {
        postProcessing.outputNode = vec4(
          add(scenePassColor, bloomPass).rgb,
          alpha,
        );
        postProcessing.needsUpdate = true;
      } else if (now.render === "beauty") {
        postProcessing.outputNode = scenePassColor;
        postProcessing.needsUpdate = true;
      } else if (now.render === "normal") {
        postProcessing.outputNode = scenePassNormal;
        postProcessing.needsUpdate = true;
      } else if (now.render === "diffuse") {
        postProcessing.outputNode = scenePassDiffuse;
        postProcessing.needsUpdate = true;
      } else if (now.render === "depth") {
        postProcessing.outputNode = vec4(vec3(scenePassDepth).pow(25), alpha);
        postProcessing.needsUpdate = true;
      } else if (now.render === "ao") {
        postProcessing.outputNode = vec4(vec3(ao), alpha);
        postProcessing.needsUpdate = true;
      } else {
        postProcessing.outputNode = scenePassColor;
        postProcessing.needsUpdate = true;
      }

      /*
            else if (now.render === 'emissive') {
                postProcessing.outputNode = scenePassEmissive;
                postProcessing.needsUpdate = true;
            } 
            else if (now.render === 'metal') {
                postProcessing.outputNode = vec4(vec3(scenePassMetalRough.r), alpha);
                postProcessing.needsUpdate = true;
            } else if (now.render === 'roughness') {
                postProcessing.outputNode = vec4(vec3(scenePassMetalRough.g), alpha);
                postProcessing.needsUpdate = true;
            } 
            */
    };

    applyRenderSettings(useDynamicStore.getState());
    const cancelSubs = useDynamicStore.subscribe((now: any, before: any) => {
      if (now.render !== before.render) {
        applyRenderSettings(now);
      }
    });

    let cancelRunning = useDynamicStore.subscribe((now: any, before: any) => {
      if (now.isScreenMotion !== before.isScreenMotion) {
        // if (now.render === 'ao') {
        //     return;
        // }
        // console.log('now.isScreenMotion', now.isScreenMotion);
        // if (now.isScreenMotion) {
        //     gsap.to(mixerBetween, {
        //         value: 0,
        //         duration: 0.5,
        //     }).play();
        // } else {
        //     gsap.to(mixerBetween, {
        //         value: 1,
        //         duration: 0.5,
        //     }).play();
        // }
      }
    });

    let frame = 0;
    let hh = () => {
      frame = requestAnimationFrame(hh);
      if ((gl as { initialized: boolean }).initialized) {
        try {
          postProcessing?.render();
        } catch (e) {
          console.trace(e);
        }
      }
    };
    frame = requestAnimationFrame(hh);

    return () => {
      cancelSubs();
      cancelRunning();
      cancelAnimationFrame(frame);
      postProcessing.dispose();
    };
  }, [lighting, scene, camera, gl]);

  useFrame(() => {}, 11);

  return <></>;
}

export function EnvLight({ hdrURL = `` }) {
  //
  let useDynamicStore = useStoreOfApp();

  let gl = useThree((r) => r.gl) as WebGLRenderer & WebGPURenderer;

  let scene = useThree((r) => r.scene) as Scene;

  let lighting = useDynamicStore((r) => r.lighting);

  let timeOfDay = useDynamicStore((r) => r.timeOfDay);
  let orbitOfSun = useDynamicStore((r) => r.orbitOfSun);

  useEffect(() => {
    let cleanLighting = () => {};

    let setupLighting = async () => {
      let lighting = new SunlightObject({
        targetObject: new Object3D(),
        scene: scene as Scene,
        renderer: gl,
      });

      useDynamicStore.setState({
        lighting: lighting as any,
      });

      cleanLighting = () => {
        lighting.removeFromParent();
        useDynamicStore.setState({
          lighting: null,
        });
      };

      scene.add(lighting);
    };

    setupLighting();

    return () => {
      cleanLighting();
    };
  }, []);

  useEffect(() => {
    if (lighting && hdrURL) {
      (lighting as any).loadHDR(`${hdrURL}`);
    }
  }, [lighting, hdrURL]);

  useEffect(() => {
    timeOfDay = Number(timeOfDay);
    orbitOfSun = Number(orbitOfSun);
    if (lighting && typeof timeOfDay === "number") {
      (lighting as any).update(timeOfDay || 0, orbitOfSun || 0);
    }

    return () => {};
  }, [lighting, timeOfDay, orbitOfSun]);

  return null;
}

// export function DayTimeControls({ show = false }) {
//   let useDynamicStore = useStoreOfApp();
//   let timeOfDay = useDynamicStore((r) => r.timeOfDay);

//   let refTimer = useRef(0);
//   let isAnimatingLight = useDynamicStore((r) => r.isAnimatingLight);
//   useEffect(() => {
//     if (isAnimatingLight) {
//       cancelAnimationFrame(refTimer.current);
//     } else {
//       cancelAnimationFrame(refTimer.current);
//       return;
//     }

//     let ck = new Clock();
//     let vv = () => {
//       refTimer.current = requestAnimationFrame(vv);

//       let dt = ck.getDelta();

//       let timeOfDay = useDynamicStore.getState().timeOfDay;

//       timeOfDay += dt / 10;

//       timeOfDay %= 1;

//       useDynamicStore.setState({
//         timeOfDay: timeOfDay,
//       });
//     };
//     refTimer.current = requestAnimationFrame(vv);

//     //
//     return () => {
//       cancelAnimationFrame(refTimer.current);
//     };
//   }, [isAnimatingLight]);

//   return (
//     <>
//       {show && (
//         <div className=" text-black bg-white px-2 py-2 rounded-full w-full ">
//           {
//             <>
//               <div className="flex">
//                 <span>
//                   <ClockIcon></ClockIcon>
//                 </span>

//                 <input
//                   className="ml-2 w-full"
//                   type="range"
//                   min={0}
//                   max={1}
//                   step={0.001}
//                   value={timeOfDay}
//                   onChange={(ev) => {
//                     cancelAnimationFrame(refTimer.current);

//                     useDynamicStore.setState({
//                       timeOfDay: Number(ev.target.value),
//                     });
//                     useDynamicStore.setState({
//                       isAnimatingLight: false,
//                     });
//                   }}
//                 />

//                 <button className="ml-2 cursor-pointer">
//                   {!isAnimatingLight && (
//                     <PlayCircleIcon
//                       color="lime"
//                       onClick={() => {
//                         cancelAnimationFrame(refTimer.current);
//                         useDynamicStore.setState({
//                           isAnimatingLight: true,
//                         });
//                       }}
//                     ></PlayCircleIcon>
//                   )}

//                   {isAnimatingLight && (
//                     <PauseCircleIcon
//                       color="red"
//                       onClick={() => {
//                         cancelAnimationFrame(refTimer.current);
//                         useDynamicStore.setState({
//                           isAnimatingLight: false,
//                         });
//                       }}
//                     ></PauseCircleIcon>
//                   )}
//                 </button>
//               </div>
//             </>
//           }
//         </div>
//       )}
//     </>
//   );
// }

// export function OrbitSunControls({ show = false }) {
//   let useDynamicStore = useStoreOfApp();
//   let orbitOfSun = useDynamicStore((r) => r.orbitOfSun);

//   let refTimer = useRef(0);
//   let isAnimatingOrbit = useDynamicStore((r) => r.isAnimatingOrbit);
//   useEffect(() => {
//     if (isAnimatingOrbit) {
//       cancelAnimationFrame(refTimer.current);
//     } else {
//       cancelAnimationFrame(refTimer.current);
//       return;
//     }

//     let ck = new Clock();
//     let vv = () => {
//       refTimer.current = requestAnimationFrame(vv);

//       let dt = ck.getDelta();

//       let orbitOfSun = useDynamicStore.getState().orbitOfSun;

//       orbitOfSun += dt / 10;

//       orbitOfSun %= 1;

//       useDynamicStore.setState({
//         orbitOfSun: orbitOfSun,
//       });
//     };
//     refTimer.current = requestAnimationFrame(vv);

//     return () => {
//       cancelAnimationFrame(refTimer.current);
//     };
//   }, [isAnimatingOrbit]);

//   return (
//     <>
//       {show && (
//         <div className=" text-black bg-white px-2 py-2 rounded-full w-full ">
//           {
//             <>
//               <div className="flex">
//                 <span>
//                   <Orbit></Orbit>
//                 </span>

//                 <input
//                   className="ml-2 w-full"
//                   type="range"
//                   min={0}
//                   max={1}
//                   step={0.001}
//                   value={orbitOfSun}
//                   onChange={(ev) => {
//                     //
//                     cancelAnimationFrame(refTimer.current);

//                     //
//                     useDynamicStore.setState({
//                       orbitOfSun: Number(ev.target.value),
//                     });

//                     useDynamicStore.setState({
//                       isAnimatingOrbit: false,
//                     });
//                   }}
//                 />

//                 <button className="ml-2 cursor-pointer">
//                   {!isAnimatingOrbit && (
//                     <PlayCircleIcon
//                       color="lime"
//                       onClick={() => {
//                         cancelAnimationFrame(refTimer.current);
//                         useDynamicStore.setState({
//                           isAnimatingOrbit: true,
//                         });
//                       }}
//                     ></PlayCircleIcon>
//                   )}

//                   {isAnimatingOrbit && (
//                     <PauseCircleIcon
//                       color="red"
//                       onClick={() => {
//                         cancelAnimationFrame(refTimer.current);
//                         useDynamicStore.setState({
//                           isAnimatingOrbit: false,
//                         });
//                       }}
//                     ></PauseCircleIcon>
//                   )}
//                 </button>
//               </div>
//             </>
//           }
//         </div>
//       )}
//     </>
//   );
// }
