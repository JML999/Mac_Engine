// Chunk mesher using Hytopia's exact face geometries, AO algorithm, and face shading
import * as THREE from 'three';
import { VoxelWorld, CHUNK_SIZE } from './World';
import { TextureAtlas } from './TextureAtlas';
import {
  BLOCK_FACE_GEOMETRIES, ALL_FACES, BlockFace,
  DEFAULT_BLOCK_AO_INTENSITY, getFaceShade,
  SKY_LIGHT_BRIGHTNESS_LUT, SKY_LIGHT_MAX_DISTANCE,
} from './BlockConstants';

// Hytopia AO: sample 3 neighbors (corner + 2 sides), count solid ones, lookup intensity
function calculateAO(
  world: VoxelWorld,
  wx: number, wy: number, wz: number,
  ao: { corner: number[]; side1: number[]; side2: number[] }
): number {
  const c = world.isSolid(
    wx + Math.sign(ao.corner[0]), wy + Math.sign(ao.corner[1]), wz + Math.sign(ao.corner[2])
  ) ? 1 : 0;
  const s1 = world.isSolid(
    wx + Math.sign(ao.side1[0]), wy + Math.sign(ao.side1[1]), wz + Math.sign(ao.side1[2])
  ) ? 1 : 0;
  const s2 = world.isSolid(
    wx + Math.sign(ao.side2[0]), wy + Math.sign(ao.side2[1]), wz + Math.sign(ao.side2[2])
  ) ? 1 : 0;

  // If both sides are solid, corner is fully occluded (3)
  const aoLevel = (s1 && s2) ? 3 : (s1 + s2 + c);
  return DEFAULT_BLOCK_AO_INTENSITY[aoLevel];
}

// Simple sky distance: count blocks above until sky or max distance
function getSkyDistance(world: VoxelWorld, wx: number, wy: number, wz: number): number {
  for (let d = 1; d <= SKY_LIGHT_MAX_DISTANCE; d++) {
    if (!world.isSolid(wx, wy + d, wz)) return d;
  }
  return SKY_LIGHT_MAX_DISTANCE;
}

function getSkyLight(world: VoxelWorld, wx: number, wy: number, wz: number): number {
  const dist = getSkyDistance(world, wx, wy, wz);
  return SKY_LIGHT_BRIGHTNESS_LUT[Math.min(dist, SKY_LIGHT_MAX_DISTANCE)];
}

export function buildChunkMesh(
  world: VoxelWorld,
  cx: number, cy: number, cz: number,
  atlas?: TextureAtlas | null,
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const ox = cx * CHUNK_SIZE;
  const oy = cy * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = ox + lx;
        const wy = oy + ly;
        const wz = oz + lz;
        const blockId = world.getBlock(wx, wy, wz);
        if (blockId === 0) continue;

        const bt = world.registry.get(blockId);
        if (!bt) continue;

        for (const faceName of ALL_FACES) {
          const faceGeo = BLOCK_FACE_GEOMETRIES[faceName];
          const [nx, ny, nz] = faceGeo.normal;

          // Hytopia face culling logic (ChunkWorker.ts lines 970-983):
          // Skip face ONLY if the neighbor's texture is fully opaque (not transparent, not alphaTest)
          const neighborId = world.getBlock(wx + nx, wy + ny, wz + nz);
          if (neighborId !== 0) {
            const neighborBt = world.registry.get(neighborId);
            if (neighborBt && neighborBt.solid && !neighborBt.transparent && !neighborBt.alphaTest) continue;
          }

          const faceShade = getFaceShade(faceGeo.normal);
          const vertexBase = positions.length / 3;

          // Get block color for this face (white when using textures, tinted when not)
          const hasTexture = atlas && world.registry.getTextureKey(blockId, faceName);
          let baseColor: [number, number, number];
          if (hasTexture) {
            baseColor = [1.0, 1.0, 1.0]; // White - texture provides color
          } else {
            baseColor = bt.color;
            if (faceName === 'top' && bt.topColor) baseColor = bt.topColor;
            if (faceName === 'bottom' && bt.bottomColor) baseColor = bt.bottomColor;
          }

          // Get texture key for atlas UV mapping
          const texKey = world.registry.getTextureKey(blockId, faceName);

          // Sky light for this face (sample from the neighbor position)
          const skyLight = getSkyLight(world, wx + nx, wy + ny, wz + nz);

          for (const vert of faceGeo.vertices) {
            positions.push(wx + vert.pos[0], wy + vert.pos[1], wz + vert.pos[2]);
            normals.push(nx, ny, nz);

            // Map UVs through texture atlas
            // Side faces need V flipped because flipY=false on canvas texture
            if (atlas && texKey) {
              const isSide = faceName !== 'top' && faceName !== 'bottom';
              const [mu, mv] = atlas.mapUV(texKey, vert.uv[0], vert.uv[1], isSide);
              uvs.push(mu, mv);
            } else {
              uvs.push(vert.uv[0], vert.uv[1]);
            }

            // Vertex color = baseColor * (1 - aoIntensity) * faceShade * skyLight
            // AO intensity [0, 0.5, 0.7, 0.9] = how much to darken at 0,1,2,3 solid neighbors
            const ao = calculateAO(world, wx, wy, wz, vert.ao);
            const shade = (1 - ao) * faceShade * skyLight;
            const r = baseColor[0] * shade;
            const g = baseColor[1] * shade;
            const b = baseColor[2] * shade;
            colors.push(r, g, b, 1.0);
          }

          // Two triangles: 0-1-2, 1-3-2
          indices.push(vertexBase + 0, vertexBase + 1, vertexBase + 2);
          indices.push(vertexBase + 1, vertexBase + 3, vertexBase + 2);
        }
      }
    }
  }

  if (positions.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
