import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Center, Cylinder, Text3D, useFBX, useGLTF } from "@react-three/drei";
import { helveticaReglar } from "./helvetica";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlayerPhysicsState } from "./physics";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadMixamoAnimation } from "../avatars/integrations/animationLoader.js";

import { MToonMaterialLoaderPlugin } from "@pixiv/three-vrm";
import { MToonNodeMaterial } from "@pixiv/three-vrm/nodes";

// import r1 from "../avatars/100avatars-r1.json";
import r2 from "../avatars/100avatars-r2.json";
// import r3 from "../avatars/100avatars-r3.json";
import { getCachedThumbnail, cacheThumbnail } from "@/lib/thumbnail-cache";
const allItems = [...r2];

// Create a GLTFLoader
const loader = new GLTFLoader();
loader.setCrossOrigin("anonymous");

// Register a VRMLoaderPlugin
loader.register((parser) => {
  // create a WebGPU compatible MToonMaterialLoaderPlugin
  const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
    // set the material type to MToonNodeMaterial
    materialType: MToonNodeMaterial,
  });

  return new VRMLoaderPlugin(parser, {
    // Specify the MToonMaterialLoaderPlugin to use in the VRMLoaderPlugin instance
    mtoonMaterialPlugin,
  });
});

interface AvatarItem {
  id: string;
  name: string;
  thumbnail_url: string;
  model_file_url: string;
}

interface VRMPickerProps {
  selectedId?: string;
  onSelect: (item: AvatarItem) => void;
  onClose: () => void;
}

function CachedImg({
  src,
  onBroken,
  ...imgProps
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  onBroken: (url: string) => void;
}) {
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = src!;

    getCachedThumbnail(url).then((blobUrl) => {
      if (cancelled) return;
      if (blobUrl) {
        setCachedSrc(blobUrl);
        setLoaded(true);
      } else {
        // Fetch from network and cache
        fetch(url, { mode: "cors" })
          .then((res) => res.blob())
          .then((blob) => {
            if (cancelled) return;
            cacheThumbnail(url, blob);
            setCachedSrc(URL.createObjectURL(blob));
            setLoaded(true);
          })
          .catch(() => {
            if (!cancelled) onBroken(url);
          });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!loaded) {
    return (
      <div
        className={imgProps.className}
        style={{ background: "rgba(255,255,255,0.05)" }}
      />
    );
  }

  const { onBroken: _, ...rest } = imgProps as any;
  return <img {...rest} src={cachedSrc!} onError={() => onBroken(src!)} />;
}

export function VRMPicker({ selectedId, onSelect, onClose }: VRMPickerProps) {
  const [search, setSearch] = useState("");
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set());

  const markBroken = (url: string) => {
    setBrokenThumbs((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const filtered = search
    ? allItems.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()),
      )
    : allItems;

  const visible = filtered.filter((item) => {
    const url = `https://d2upc1jytt7esc.cloudfront.net/vrm-avatars/${item.project_id}/${item.name}/thumbnail.gif`;
    return !brokenThumbs.has(url);
  });

  return (
    <div className="flex flex-col max-h-[70vh] w-[420px] max-w-[90vw] rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <h2 className="text-sm font-medium text-white/90">
          <div>Choose Avatar ({visible.length})</div>
          <div>
            <div className="text-xs text-white/40">
              Powered by{" "}
              <a
                className="underline text-white/50 hover:text-white/70 transition"
                href="https://github.com/toxsam/open-source-avatars"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Source Avatars
              </a>
            </div>
          </div>
        </h2>

        <button
          onClick={onClose}
          className="rounded-xl p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/70 cursor-pointer"
          aria-label="Close avatar picker"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-white/[0.08] px-4 py-2">
        <input
          type="text"
          placeholder="Search avatars..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition"
        />
      </div>

      {/* Grid */}
      <div className="overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          {visible.map((item) => {
            const isSelected = item.id === selectedId;
            const thumbUrl = `https://d2upc1jytt7esc.cloudfront.net/vrm-avatars/${item.project_id}/${item.name}/thumbnail.gif`;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`relative flex flex-col items-center gap-1 rounded-xl p-2 transition-all duration-200 hover:bg-white/[0.06] ${
                  isSelected ? "ring-1 ring-white/20 bg-white/[0.08]" : ""
                }`}
              >
                <CachedImg
                  src={thumbUrl}
                  alt={item.name}
                  onBroken={() => markBroken(thumbUrl)}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <span className="text-[11px] leading-tight text-white/50 truncate w-full text-center">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-white/30">
            No avatars found
          </p>
        )}
      </div>
    </div>
  );
}

interface VRMAvatarProps {
  name?: string;
  state?: PlayerPhysicsState | { walkAnimation: number };
  isMe?: boolean;
  spacePressedRef?: React.MutableRefObject<boolean>;
  avatarUrl?: string | null;
}

let _useFBXAction = (fbxURL: string, mixer: THREE.AnimationMixer) => {
  let fbx = useFBX(fbxURL);
  let [action, setAction] = useState<THREE.AnimationAction | null>(null);

  useEffect(() => {
    let a = mixer.clipAction(fbx.animations[0]);
    a.stop();
    a.repetitions = Infinity;
    a.play();
    setAction(a);
  }, [fbx, mixer]);

  return action;
};

function DefaultAvatar({
  name = "me",
  state,
  isMe = true,
  spacePressedRef,
}: VRMAvatarProps) {
  const meshRef = useRef<THREE.Group>(null);
  const gltf = useGLTF("/assets/avatar/lamb/lamb-in-beach-transformed.glb");
  const clonedScene = useMemo(() => clone(gltf.scene), [gltf.scene]);

  const show = useMemo(() => {
    clonedScene.traverse((it) => {
      it.receiveShadow = true;
      it.castShadow = true;
    });
    return <primitive object={clonedScene} />;
  }, [clonedScene]);

  const mixer = useMemo(
    () => new THREE.AnimationMixer(clonedScene),
    [clonedScene],
  );

  useFrame(() => {
    mixer.setTime(new Date().getTime() / 1000);
  });

  const fbx = {
    run: _useFBXAction("/assets/avatar/lamb/motion/running.fbx", mixer),
    idle: _useFBXAction("/assets/avatar/lamb/motion/idle.fbx", mixer),
    jump: _useFBXAction("/assets/avatar/lamb/motion/jump.fbx", mixer),
  };

  const jumpTimer = useRef(0);

  useFrame((_, delta) => {
    if (clonedScene) {
      clonedScene.rotation.x = Math.PI * -0.5;
    }

    if (spacePressedRef?.current) {
      jumpTimer.current = 0.4;
    }
    jumpTimer.current = Math.max(0, jumpTimer.current - delta);

    const isOnGround = state && "isOnGround" in state ? state.isOnGround : true;
    const jumping =
      jumpTimer.current > 0 ||
      (!isMe && !isOnGround) ||
      spacePressedRef?.current;
    const walking = state ? state.walkAnimation !== 0 : false;

    const targetIdle = !jumping && !walking ? 1 : 0;
    const targetRun = !jumping && walking ? 1 : 0;
    const targetJump = jumping ? 1 : 0;

    if (fbx.idle)
      fbx.idle.weight = THREE.MathUtils.lerp(fbx.idle.weight, targetIdle, 0.2);
    if (fbx.run)
      fbx.run.weight = THREE.MathUtils.lerp(fbx.run.weight, targetRun, 0.2);
    if (fbx.jump)
      fbx.jump.weight = THREE.MathUtils.lerp(fbx.jump.weight, targetJump, 0.2);
  });

  return (
    <group ref={meshRef}>
      <group rotation={[0, 0, 0]} scale={2}>
        {show}
      </group>
      {name && isMe && (
        <group rotation={[0, 0, 0]} position={[0, 3, 0]} scale={[1, 1, 1]}>
          <Center key={name}>
            <Text3D font={helveticaReglar as any}>
              {name}
              <meshStandardMaterial />
            </Text3D>
          </Center>
        </group>
      )}
    </group>
  );
}

function VRMModel({
  url,
  state,
  isMe = false,
  spacePressedRef,
}: { url: string } & VRMAvatarProps) {
  const meshRef = useRef<THREE.Group>(null);

  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.crossOrigin = "anonymous";
    // Register a VRMLoaderPlugin
    loader.register((parser) => {
      // create a WebGPU compatible MToonMaterialLoaderPlugin
      const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
        // set the material type to MToonNodeMaterial
        materialType: MToonNodeMaterial,
      });

      return new VRMLoaderPlugin(parser, {
        // Specify the MToonMaterialLoaderPlugin to use in the VRMLoaderPlugin instance
        mtoonMaterialPlugin,
      });
    });

    // loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const clonedScene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const vrm = useMemo(() => gltf.userData.vrm, [gltf]);

  useEffect(() => {
    clonedScene.traverse((it) => {
      it.receiveShadow = true;
      it.castShadow = true;
    });
  }, [clonedScene]);

  const mixer = useMemo(
    () => new THREE.AnimationMixer(clonedScene),
    [clonedScene],
  );

  const [actions, setActions] = useState<{
    idle?: THREE.AnimationAction | null;
    jump?: THREE.AnimationAction | null;
    run?: THREE.AnimationAction | null;
    walk?: THREE.AnimationAction | null;
  }>({});

  useEffect(() => {
    if (!vrm) return;
    let cancelled = false;

    console.log(clonedScene);
    //
    (async () => {
      const [idleClip, jumpClip, runClip, walkClip] = await Promise.all([
        loadMixamoAnimation("/assets/vrm/motion/idle.fbx", vrm),
        loadMixamoAnimation("/assets/vrm/motion/jump.fbx", vrm),
        loadMixamoAnimation("/assets/vrm/motion/run.fbx", vrm),
        loadMixamoAnimation("/assets/vrm/motion/walk.fbx", vrm),
      ]);

      if (cancelled) return;

      const idle = mixer.clipAction(idleClip);
      const jump = mixer.clipAction(jumpClip);
      const run = mixer.clipAction(runClip);
      const walk = mixer.clipAction(walkClip);

      [idle, jump, run, walk].forEach((a) => {
        a.stop();
        a.repetitions = Infinity;
        a.play();
      });

      setActions({ idle, jump, run, walk });
    })();

    return () => {
      cancelled = true;
    };
  }, [vrm, mixer]);

  const jumpTimer = useRef(0);

  useFrame((_, delta) => {
    if (clonedScene) {
      clonedScene.rotation.x = Math.PI * -0.5;
    }

    if (spacePressedRef?.current) {
      jumpTimer.current = 0.4;
    }
    jumpTimer.current = Math.max(0, jumpTimer.current - delta);

    const isOnGround = state && "isOnGround" in state ? state.isOnGround : true;
    const jumping =
      jumpTimer.current > 0 ||
      (!isMe && !isOnGround) ||
      spacePressedRef?.current;
    const speed = state ? Math.abs(state.walkAnimation) : 0;
    const walking = speed > 0;
    const blendFactor = Math.min(speed / 0.7, 1);

    const targetIdle = !jumping && !walking ? 1 : 0;
    const targetJump = jumping ? 1 : 0;
    const targetWalk = !jumping && walking ? 1 - blendFactor : 0;
    const targetRun = !jumping && walking ? blendFactor : 0;

    // console.log(targetIdle, targetJump, targetWalk, targetRun);
    if (actions.idle)
      actions.idle.weight = THREE.MathUtils.lerp(
        actions.idle.weight,
        targetIdle,
        0.2,
      );
    if (actions.jump)
      actions.jump.weight = THREE.MathUtils.lerp(
        actions.jump.weight,
        targetJump,
        0.2,
      );
    if (actions.walk)
      actions.walk.weight = THREE.MathUtils.lerp(
        actions.walk.weight,
        targetWalk,
        0.2,
      );
    if (actions.run)
      actions.run.weight = THREE.MathUtils.lerp(
        actions.run.weight,
        targetRun,
        0.2,
      );

    mixer.update(delta);
  });

  return (
    <group ref={meshRef}>
      <group
        visible={!!actions.run}
        rotation={[Math.PI * -0.5, Math.PI, 0]}
        scale={1}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function FallbackCube() {
  return (
    <group scale={0.5}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
        <lineBasicMaterial color="#a5b4fc" />
      </lineSegments>
    </group>
  );
}

function VRMModelWithFallback({
  url,
  ...props
}: { url: string } & VRMAvatarProps) {
  const [status, setStatus] = useState<
    "checking" | "reachable" | "unreachable"
  >("checking");

  let [dataURL, setDataURL] = useState("");
  useEffect(() => {
    let cancelled = false;
    setStatus("checking");

    fetch(url, { method: "GET", mode: "cors" })
      .then(async (res) => {
        if (!cancelled) {
          if (res.ok) {
            setDataURL(URL.createObjectURL(await res.blob()));
          }
          setStatus(res.ok ? "reachable" : "unreachable");
        }
      })
      .catch((ev) => {
        console.log(ev);
        // HEAD may fail due to CORS — fall back to a no-cors GET to verify the server responds
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (status === "unreachable" || status === "checking") {
    return <FallbackCube />;
  }

  let { isMe, name } = props;

  return (
    <Suspense fallback={<FallbackCube />}>
      {dataURL && (
        <>
          <VRMModel url={dataURL} {...props} />

          {/*  */}

          {name && isMe && (
            <group
              rotation={[0, 0, 0]}
              position={[0, 3, 0]}
              scale={[1.0, 1.0, 1.0]}
            >
              <LookCam>
                <Center key={name}>
                  <Text3D scale={0.5} font={helveticaReglar as any}>
                    {name}
                    <meshStandardMaterial />
                  </Text3D>
                </Center>
              </LookCam>
            </group>
          )}
        </>
      )}
    </Suspense>
  );
}

export function LookCam({ children }: any) {
  const ref = useRef<THREE.Object3D>(null);

  let wp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_: any) => {
    if (ref.current) {
      _.camera.getWorldPosition(wp);
      ref.current.lookAt(wp.x, wp.y, wp.z);
    }
  });
  return (
    <>
      <group ref={ref}>{children}</group>
    </>
  );
}

export function VRMAvatar(props: VRMAvatarProps) {
  const { avatarUrl } = props;

  if (avatarUrl) {
    return <VRMModelWithFallback url={avatarUrl} {...props} />;
  }

  return <DefaultAvatar {...props} />;
}
