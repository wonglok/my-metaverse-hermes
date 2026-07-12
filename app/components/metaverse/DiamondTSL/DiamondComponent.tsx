import { useFrame, useThree } from "@react-three/fiber";
import { useEnvironment, useGLTF } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import {
  CubeCamera,
  Mesh,
  RGBAFormat,
  Scene,
  WebGLCubeRenderTarget,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { buildCubeNormal } from "./NormalCubeTSL";
import { diamondRand, getDiamondSystem } from "./DiamondGo";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";

export function Spinner({ children }: any) {
  const ref = useRef<any>(null);

  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.125;
    }
  });

  return <group ref={ref}>{children}</group>;
}

export function DiamindComponent({ name = "diam_1" }) {
  const gl = useThree((r) => r.gl);

  const diamondModel = useGLTF(`/models/diamond/diamond.glb`);

  const [dAPI, setDiamond] = useState<any>();

  const envMap = useEnvironment({ files: [`/models/diamond/sky.hdr`] });

  useEffect(() => {
    const cubeCamRtt = new WebGLCubeRenderTarget(512, {});

    const cubeCam = new CubeCamera(0.1, 500, cubeCamRtt);

    const allDiamonds = clone(diamondModel.scene);
    const obj = allDiamonds.getObjectByName(name || "diam_1")! as Mesh;

    obj.geometry = obj.geometry.toNonIndexed();
    obj.geometry.center();
    obj.geometry.computeVertexNormals();

    const normalCubeMap = buildCubeNormal({
      geometry: obj.geometry,
      gl: gl,
    }) as any;

    const systemForDiamond = getDiamondSystem({
      envMapTex: cubeCamRtt.texture,
      normalCubeTex: normalCubeMap,
    });

    const material = systemForDiamond.createDiamondMaterial();

    const mesh = new Mesh(obj.geometry, material);
    mesh.castShadow = true;
    mesh.scale.setScalar(20);
    const scene = new Scene();
    scene.environment = envMap;
    scene.background = envMap;
    scene.backgroundIntensity = 1.23;

    const capture = ({}: any) => {
      mesh.getWorldPosition(cubeCam.position);

      // systemForDiamond.uniforms.centreOffset.value.copy(cubeCam.position)

      mesh.visible = false;
      cubeCam.visible = false;

      cubeCam.update(gl, scene);

      cubeCam.visible = true;
      mesh.visible = true;
    };

    setDiamond({
      capture,
      mesh,
      display: <primitive object={mesh}></primitive>,
    });

    if (import.meta.env.DEV) {
      const gui = new GUI({ autoPlace: true, container: document.body });
      gui.domElement.style.position = "fixed";
      gui.domElement.style.top = "10px";
      gui.domElement.style.right = "10px";
      gui.domElement.style.zIndex = "9999";

      document.body.appendChild(gui.domElement);

      const items = [
        //
        { type: "number", name: "mFresnelBias", min: 0, max: 0.5 },
        { type: "number", name: "mFresnelScale", min: 0, max: 0.5 },
        { type: "number", name: "mFresnelPower", min: 0, max: 2 },
        //
        { type: "number", name: "aberration", min: 0, max: 0.5 },
        { type: "number", name: "refraction", min: 0, max: 5 },
        //
        { type: "number", name: "normalOffset", min: 0, max: 5 },
        { type: "number", name: "squashFactor", min: 0, max: 2 },
        { type: "number", name: "distanceOffset", min: 0, max: 5 },
        {
          type: "number",
          name: "geometryFactor",
          min: 0,
          max: 0.25,
          step: 0.01,
        },
        //
        { type: "color", name: "absorbption", min: 0, max: 5 },
        { type: "color", name: "correction", min: 0, max: 2 },
        { type: "color", name: "boost", min: 0, max: 5 },
        //
        { type: "number", name: "radius", min: 0, max: 1 },
        { type: "vec3", name: "centreOffset", min: -5, max: 5 },
        //
      ];

      items.forEach((it: any) => {
        //

        const op: any = systemForDiamond.uniforms;
        if (it.type === "number") {
          gui.add(
            {
              get [it.name]() {
                return op[it.name].value;
              },
              set [it.name](v: any) {
                op[it.name].value = v;
              },
            },
            it.name,
            it.min,
            it.max,
          );
        }

        if (it.type === "color") {
          gui.addColor(
            {
              get [it.name]() {
                return "#" + op[it.name].value.getHexString();
              },
              set [it.name](v: any) {
                op[it.name].value.set(v);
              },
            },
            it.name,
          );
        }

        if (it.type === "vec3") {
          gui.add(
            {
              get [it.name]() {
                return op[it.name].value.x;
              },
              set [it.name](v: any) {
                op[it.name].value.x = v;
              },
            },
            it.name,
          );
        }
      });

      gui.close();

      return () => {
        document.body.removeChild(gui.domElement);
        gui.destroy();
      };
    }
  }, []);

  useFrame(({ scene }) => {
    if (dAPI?.mesh) {
      dAPI.mesh.updateMatrixWorld(true);
      dAPI.capture({ scene: scene });
    }
  });

  return (
    <>
      {/*  */}
      {dAPI?.display}
    </>
  );
}

//
//
//
