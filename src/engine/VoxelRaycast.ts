// DDA voxel raycast - steps through the voxel grid along a ray
// Returns the first solid block hit and the face normal (for placement)
import { VoxelWorld } from './World';

export interface RaycastHit {
  x: number; y: number; z: number;       // Block that was hit
  nx: number; ny: number; nz: number;     // Face normal (where to place adjacent block)
  distance: number;
}

export function voxelRaycast(
  world: VoxelWorld,
  ox: number, oy: number, oz: number,  // Ray origin
  dx: number, dy: number, dz: number,  // Ray direction (normalized)
  maxDist: number = 50
): RaycastHit | null {
  // Current voxel position
  let ix = Math.floor(ox);
  let iy = Math.floor(oy);
  let iz = Math.floor(oz);

  // Step direction (+1 or -1)
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const sz = dz > 0 ? 1 : -1;

  // How far along the ray to cross one voxel boundary
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  // Distance to next voxel boundary
  let tmx = dx > 0
    ? (ix + 1 - ox) * tdx
    : (ox - ix) * tdx;
  let tmy = dy > 0
    ? (iy + 1 - oy) * tdy
    : (oy - iy) * tdy;
  let tmz = dz > 0
    ? (iz + 1 - oz) * tdz
    : (oz - iz) * tdz;

  let nx = 0, ny = 0, nz = 0;
  let dist = 0;

  for (let i = 0; i < maxDist * 3; i++) {
    // Check current voxel
    if (world.isSolid(ix, iy, iz)) {
      return { x: ix, y: iy, z: iz, nx, ny, nz, distance: dist };
    }

    // Step to next voxel boundary (smallest t)
    if (tmx < tmy) {
      if (tmx < tmz) {
        dist = tmx;
        ix += sx;
        tmx += tdx;
        nx = -sx; ny = 0; nz = 0;
      } else {
        dist = tmz;
        iz += sz;
        tmz += tdz;
        nx = 0; ny = 0; nz = -sz;
      }
    } else {
      if (tmy < tmz) {
        dist = tmy;
        iy += sy;
        tmy += tdy;
        nx = 0; ny = -sy; nz = 0;
      } else {
        dist = tmz;
        iz += sz;
        tmz += tdz;
        nx = 0; ny = 0; nz = -sz;
      }
    }

    if (dist > maxDist) break;
  }

  return null;
}
