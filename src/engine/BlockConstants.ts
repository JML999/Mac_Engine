// Ported directly from Hytopia's BlockConstants.ts
// These are the exact values that give Hytopia its visual character

export type Vector2Tuple = [number, number];
export type Vector3Tuple = [number, number, number];
export type Vector4Tuple = [number, number, number, number];

export type BlockFace = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';

export type BlockFaceAO = {
  corner: Vector3Tuple;
  side1: Vector3Tuple;
  side2: Vector3Tuple;
}

export type BlockFaceGeometry = {
  normal: Vector3Tuple;
  vertices: {
    pos: Vector3Tuple;
    uv: Vector2Tuple;
    ao: BlockFaceAO;
  }[];
}

// Face shading multipliers - creates depth by darkening faces based on direction
export const FACE_SHADE_TOP = 1.0;
export const FACE_SHADE_SIDE = 0.8;
export const FACE_SHADE_BOTTOM = 0.5;

// AO intensity curve: [0 neighbors, 1 neighbor, 2 neighbors, 3 neighbors]
export const DEFAULT_BLOCK_AO_INTENSITY: Vector4Tuple = [0, 0.5, 0.7, 0.9];

// Sky light configuration
export const SKY_LIGHT_MAX_DISTANCE = 16;
export const SKY_LIGHT_MIN_BRIGHTNESS = 0.3;

export const SKY_LIGHT_BRIGHTNESS_LUT = Array.from({ length: SKY_LIGHT_MAX_DISTANCE + 1 }, (_, dy) =>
  dy === 0 ? 0 : SKY_LIGHT_MIN_BRIGHTNESS + (1 - SKY_LIGHT_MIN_BRIGHTNESS) * (dy - 1) / (SKY_LIGHT_MAX_DISTANCE - 1)
);

export const WATER_SURFACE_Y_OFFSET = -0.1;
export const ALPHA_TEST_THRESHOLD = 0.05;
export const MAX_LIGHT_LEVEL = 15;

export const DEFAULT_BLOCK_FACE_NORMALS: Record<BlockFace, Vector3Tuple> = {
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
};

// Hytopia's exact face geometries with AO corner/side offsets
export const BLOCK_FACE_GEOMETRIES: Record<BlockFace, BlockFaceGeometry> = {
  left: {
    normal: [-1, 0, 0],
    vertices: [
      { pos: [0, 1, 0], uv: [0, 1], ao: { corner: [-0.5, 0.5, -0.5], side1: [-0.5, 0.5, 0.5], side2: [-0.5, -0.5, -0.5] } },
      { pos: [0, 0, 0], uv: [0, 0], ao: { corner: [-0.5, -0.5, -0.5], side1: [-0.5, 0.5, -0.5], side2: [-0.5, -0.5, 0.5] } },
      { pos: [0, 1, 1], uv: [1, 1], ao: { corner: [-0.5, 0.5, 0.5], side1: [-0.5, 0.5, -0.5], side2: [-0.5, -0.5, 0.5] } },
      { pos: [0, 0, 1], uv: [1, 0], ao: { corner: [-0.5, -0.5, 0.5], side1: [-0.5, 0.5, 0.5], side2: [-0.5, -0.5, -0.5] } },
    ],
  },
  right: {
    normal: [1, 0, 0],
    vertices: [
      { pos: [1, 1, 1], uv: [0, 1], ao: { corner: [0.5, 0.5, 0.5], side1: [0.5, 0.5, -0.5], side2: [0.5, -0.5, 0.5] } },
      { pos: [1, 0, 1], uv: [0, 0], ao: { corner: [0.5, -0.5, 0.5], side1: [0.5, 0.5, 0.5], side2: [0.5, -0.5, -0.5] } },
      { pos: [1, 1, 0], uv: [1, 1], ao: { corner: [0.5, 0.5, -0.5], side1: [0.5, 0.5, 0.5], side2: [0.5, -0.5, -0.5] } },
      { pos: [1, 0, 0], uv: [1, 0], ao: { corner: [0.5, -0.5, -0.5], side1: [0.5, 0.5, -0.5], side2: [0.5, -0.5, 0.5] } },
    ],
  },
  top: {
    normal: [0, 1, 0],
    vertices: [
      { pos: [0, 1, 1], uv: [1, 1], ao: { corner: [-0.5, 0.5, 0.5], side1: [0.5, 0.5, 0.5], side2: [-0.5, 0.5, -0.5] } },
      { pos: [1, 1, 1], uv: [0, 1], ao: { corner: [0.5, 0.5, 0.5], side1: [-0.5, 0.5, 0.5], side2: [0.5, 0.5, -0.5] } },
      { pos: [0, 1, 0], uv: [1, 0], ao: { corner: [-0.5, 0.5, -0.5], side1: [0.5, 0.5, -0.5], side2: [-0.5, 0.5, 0.5] } },
      { pos: [1, 1, 0], uv: [0, 0], ao: { corner: [0.5, 0.5, -0.5], side1: [-0.5, 0.5, -0.5], side2: [0.5, 0.5, 0.5] } },
    ],
  },
  bottom: {
    normal: [0, -1, 0],
    vertices: [
      { pos: [1, 0, 1], uv: [1, 0], ao: { corner: [0.5, -0.5, 0.5], side1: [-0.5, -0.5, 0.5], side2: [0.5, -0.5, -0.5] } },
      { pos: [0, 0, 1], uv: [0, 0], ao: { corner: [-0.5, -0.5, 0.5], side1: [0.5, -0.5, 0.5], side2: [-0.5, -0.5, -0.5] } },
      { pos: [1, 0, 0], uv: [1, 1], ao: { corner: [0.5, -0.5, -0.5], side1: [-0.5, -0.5, -0.5], side2: [0.5, -0.5, 0.5] } },
      { pos: [0, 0, 0], uv: [0, 1], ao: { corner: [-0.5, -0.5, -0.5], side1: [0.5, -0.5, -0.5], side2: [-0.5, -0.5, 0.5] } },
    ],
  },
  front: {
    normal: [0, 0, 1],
    vertices: [
      { pos: [0, 0, 1], uv: [0, 0], ao: { corner: [-0.5, -0.5, 0.5], side1: [0.5, -0.5, 0.5], side2: [-0.5, 0.5, 0.5] } },
      { pos: [1, 0, 1], uv: [1, 0], ao: { corner: [0.5, -0.5, 0.5], side1: [-0.5, -0.5, 0.5], side2: [0.5, 0.5, 0.5] } },
      { pos: [0, 1, 1], uv: [0, 1], ao: { corner: [-0.5, 0.5, 0.5], side1: [0.5, 0.5, 0.5], side2: [-0.5, -0.5, 0.5] } },
      { pos: [1, 1, 1], uv: [1, 1], ao: { corner: [0.5, 0.5, 0.5], side1: [-0.5, 0.5, 0.5], side2: [0.5, -0.5, 0.5] } },
    ],
  },
  back: {
    normal: [0, 0, -1],
    vertices: [
      { pos: [1, 0, 0], uv: [0, 0], ao: { corner: [0.5, -0.5, -0.5], side1: [-0.5, -0.5, -0.5], side2: [0.5, 0.5, -0.5] } },
      { pos: [0, 0, 0], uv: [1, 0], ao: { corner: [-0.5, -0.5, -0.5], side1: [0.5, -0.5, -0.5], side2: [-0.5, 0.5, -0.5] } },
      { pos: [1, 1, 0], uv: [0, 1], ao: { corner: [0.5, 0.5, -0.5], side1: [-0.5, 0.5, -0.5], side2: [0.5, -0.5, -0.5] } },
      { pos: [0, 1, 0], uv: [1, 1], ao: { corner: [-0.5, 0.5, -0.5], side1: [0.5, 0.5, -0.5], side2: [-0.5, -0.5, -0.5] } },
    ],
  },
};

export const ALL_FACES: BlockFace[] = ['left', 'right', 'top', 'bottom', 'front', 'back'];

// Face shade lookup by normal direction
export function getFaceShade(normal: Vector3Tuple): number {
  if (normal[1] > 0.5) return FACE_SHADE_TOP;
  if (normal[1] < -0.5) return FACE_SHADE_BOTTOM;
  return FACE_SHADE_SIDE;
}
