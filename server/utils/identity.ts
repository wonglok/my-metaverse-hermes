import type { Peer } from "../../shared/types/realtime";

const ADJECTIVES = [
  "Swift",
  "Calm",
  "Brave",
  "Lucky",
  "Clever",
  "Witty",
  "Bright",
  "Mellow",
  "Nimble",
  "Sunny",
  "Fluffy",
  "Fuzzy",
  "Bold",
  "Jolly",
  "Keen",
  "Snappy",
  "Cute",
  "Zippy",
  "Chill",
  "Noble",
  "Happy",
  "Gentle",
  "Dainty",
  "Plucky",
  "Smooth",
  "Breezy",
  "Shiny",
  "Comfy",
  "Spry",
  "Merry",
  "Cozy",
  "Tender",
  "Lively",
  "Rosy",
  "Silky",
  "Peppy",
  "Curly",
];

const ANIMALS = ["Lamb"];

/**
 * Builds a fresh anonymous identity for a new connection — no auth required.
 * Swap this for your authenticated user when adapting the starter.
 */
export function createIdentity(): Peer {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  // Spread the hue across the wheel for distinct, readable cursor colors.
  const hue = Math.floor(Math.random() * 360);

  return {
    id: crypto.randomUUID(),
    name: `${adjective} ${animal}`,
    color: `hsl(${hue} 85% 60%)`,
  };
}
