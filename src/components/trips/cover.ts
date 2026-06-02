// Deterministic cover gradient for a trip, so a trip keeps the same look.

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #F8C49A 0%, #E8B5C9 35%, #6F66B7 75%, #2A2F58 100%)",
  "linear-gradient(135deg, #F5D9B0 0%, #E68A6D 50%, #C9533F 100%)",
  "linear-gradient(135deg, #6CA9B5 0%, #4A6B8C 45%, #2A2F58 100%)",
  "linear-gradient(155deg, #C8DCEC 0%, #7F9EC4 45%, #4A6B8C 100%)",
  "linear-gradient(140deg, #E29A6E 0%, #C9533F 50%, #6E2A2A 100%)",
  "linear-gradient(160deg, #B7C8D6 0%, #6F8AA8 40%, #3D4A66 90%)",
  "linear-gradient(135deg, #CFE3D4 0%, #82B89C 40%, #2E7D5A 90%)",
  "linear-gradient(140deg, #F5C9A8 0%, #D6A24A 45%, #8C6C2F 100%)",
];

export const COVER_ACCENT = "radial-gradient(60% 70% at 80% 20%, rgba(255,255,255,.22) 0%, transparent 55%)";

export function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) & 0xffffffff;
  return COVER_GRADIENTS[Math.abs(h) % COVER_GRADIENTS.length];
}
