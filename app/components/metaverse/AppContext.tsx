//
// Copyright © 2026 Wong lok. All rights reserved
// LokLok DreamFX
// Praise Jesus
//

import md5 from "md5";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { BufferGeometry, Mesh, MeshPhysicalMaterial, Object3D } from "three";
import { create } from "zustand";

const getDataTemplate = () => {
  return {
    //
    // hdrURL: `https://d2upc1jytt7esc.cloudfront.net/resource/hdr/kloofendal_48d_partly_cloudy_puresky_1k.hdr`,
    // hdrURL: `https://d2upc1jytt7esc.cloudfront.net/resource/hdr/the_sky_is_on_fire_1k.hdr`,
    // hdrURL: `/assets/hdr/bryanston_park_sunrise_1k.hdr`,
    hdrURL: `/assets/hdr/kloofendal_48d_partly_cloudy_puresky_1k.hdr`, //

    render: "ssgi",

    timeOfDay: 0.344,
    orbitOfSun: 0.25,
  };
};

//

export const importJSONToStore = (store: StoreType, dataJSON: any) => {
  let state: any = store.getState();
  let keys = Object.keys(getDataTemplate());

  for (let key of keys) {
    state[key] = dataJSON[key];
  }

  // let uo = state.placeURL[0] === '/' ? new URL(state.placeURL, location.origin) : new URL(state.placeURL);
  // uo.searchParams.set('r', `${Math.random()}`);
  // state.placeURL = uo.toString();

  // close panel
  store.setState({ ...state, activeNodeHash: "" });

  return;
};

export const exportJSONFromStore = (store: StoreType) => {
  let state: any = store.getState();
  let keys = Object.keys(getDataTemplate());
  let output: any = {};
  for (let key of keys) {
    output[key] = state[key];
  }

  return output;
};

export const getHashIDFromObject3D = (it: Object3D) => {
  return `${md5(`${it?.userData?.object3dHash}${it.userData?.geometryHash}${it.userData?.materialHash}`)}`;
};

export const getActiveO3D = (
  renderTree: Object3D,
  activeNodeHash: string,
): Mesh<BufferGeometry, MeshPhysicalMaterial> => {
  let activeNode: any = false;

  renderTree?.traverse((tree: any) => {
    let hash = getHashIDFromObject3D(tree);
    if (hash === activeNodeHash) {
      if (!activeNode) {
        activeNode = tree;
      }
    }
  });

  return activeNode;
};

export type EachNode = {
  id: string;
  type: string;
  dragHandle?: string;
  position: { x: number; y: number };
  data: any;
};
export type EachEdge = {
  //
  id: string;
  type?: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  data: any;
};

export type EachPatch = {
  _id: string;
  nodes: EachNode[];
  edges: EachEdge[];
};

let getAppInititalState = (set: (a: any) => void, get: () => any) => {
  return {
    lighting: null,
    query: "",

    //
    renderTree: null as any,
    sourceTree: null as any,
    activeNodeHash: ``,
    isScreenMotion: false,
    readyRender: true,

    //
    ...getDataTemplate(),

    // avatars: getAvatars(), //
  };
};

export type AppInitStateType = Awaited<ReturnType<typeof getAppInititalState>>;

const getStateStore = () => {
  return create<AppInitStateType>((set, get) => {
    return getAppInititalState(set, get);
  });
};

type StoreType = Awaited<ReturnType<typeof getStateStore>>;

const RawContextApp = createContext<StoreType>(getStateStore());

export const AppContext = ({
  children,
  state = null,
  subscribe = (a: AppInitStateType, b: AppInitStateType) => {},
}: {
  children?: ReactNode;
  state?: AppInitStateType | Partial<AppInitStateType> | null;
  subscribe?: (a: AppInitStateType, b: AppInitStateType) => void;
}) => {
  let store = useMemo(() => {
    return getStateStore();
  }, []);

  useEffect(() => {
    if (!subscribe) {
      return;
    }
    //

    return store.subscribe(subscribe);
  }, [subscribe]);

  useEffect(() => {
    if (state && store) {
      store.setState(state);
    }
  }, [state, store]);

  return (
    <>
      {
        <RawContextApp.Provider value={store}>
          {children}
        </RawContextApp.Provider>
      }
    </>
  );
};

export const useApp = (fnc: (state: AppInitStateType) => any) => {
  let useCore = useContext(RawContextApp);
  return useCore(fnc);
};

export const useStoreOfApp = () => {
  let useCore2 = useContext(RawContextApp);

  return useCore2;
};

export const getRenderOptionsData = () => {
  return [
    {
      displayName: "SSGI & AO + Bloom",
      type: "render",
      value: "ssgi",
    },
    // {
    //     displayName: 'SSR + Bloom',
    //     type: 'render',
    //     value: 'ssr',
    // },
    {
      displayName: "Bloom",
      type: "render",
      value: "bloom",
    },
    {
      displayName: "Basic Pass",
      type: "debug",
      value: "beauty",
    },

    {
      displayName: "Normal Pass",
      type: "debug",
      value: "normal",
    },
    {
      displayName: "Diffuse Pass",
      type: "debug",
      value: "diffuse",
    },
    // {
    //     displayName: 'Emissive Pass',
    //     type: 'debug',
    //     value: 'emissive',
    // },

    // {
    //     displayName: 'Metal Pass',
    //     type: 'debug',
    //     value: 'metal',
    // },
    // {
    //     displayName: 'Roughness Pass',
    //     type: 'debug',
    //     value: 'roughness',
    // },
    {
      displayName: "Depth Pass",
      type: "debug",
      value: "depth",
    },
  ];
};
