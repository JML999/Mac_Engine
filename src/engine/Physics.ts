import RAPIER from '@dimforge/rapier3d-compat';
import { VoxelWorld, CHUNK_SIZE } from './World';

export class PhysicsEngine {
  world!: RAPIER.World;
  private initialized = false;
  // Track block colliders by position key for add/remove
  private blockBodies: Map<string, RAPIER.RigidBody> = new Map();

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World(new RAPIER.Vector3(0, -32, 0)); // Hytopia-style gravity
    this.initialized = true;
  }

  step(dt: number): void {
    if (!this.initialized) return;
    this.world.timestep = dt;
    this.world.step();
  }

  createGroundColliders(voxelWorld: VoxelWorld): void {
    // Create colliders for all solid blocks
    for (const key of voxelWorld.getChunkKeys()) {
      const [cx, cy, cz] = key.split(',').map(Number);
      const ox = cx * CHUNK_SIZE;
      const oy = cy * CHUNK_SIZE;
      const oz = cz * CHUNK_SIZE;

      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const wx = ox + lx;
            const wy = oy + ly;
            const wz = oz + lz;
            if (!voxelWorld.isSolid(wx, wy, wz)) continue;

            // Only create collider if block has at least one exposed face
            const exposed =
              !voxelWorld.isSolid(wx + 1, wy, wz) ||
              !voxelWorld.isSolid(wx - 1, wy, wz) ||
              !voxelWorld.isSolid(wx, wy + 1, wz) ||
              !voxelWorld.isSolid(wx, wy - 1, wz) ||
              !voxelWorld.isSolid(wx, wy, wz + 1) ||
              !voxelWorld.isSolid(wx, wy, wz - 1);

            if (!exposed) continue;

            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
              .setTranslation(wx + 0.5, wy + 0.5, wz + 0.5);
            const body = this.world.createRigidBody(bodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
            this.world.createCollider(colliderDesc, body);
          }
        }
      }
    }
  }

  createPlayerBody(x: number, y: number, z: number): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(0.1)
      .lockRotations(); // Don't tumble
    const body = this.world.createRigidBody(desc);

    // Capsule collider for player (radius 0.35, half-height 0.5)
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.35)
      .setFriction(0.0);
    this.world.createCollider(colliderDesc, body);

    return body;
  }

  isOnGround(body: RAPIER.RigidBody): boolean {
    const pos = body.translation();
    // Cast a short ray downward from the player's feet
    const ray = new RAPIER.Ray(
      { x: pos.x, y: pos.y - 0.85, z: pos.z },
      { x: 0, y: -1, z: 0 }
    );
    const hit = this.world.castRay(ray, 0.2, true);
    return hit !== null;
  }

  addBlockCollider(x: number, y: number, z: number): void {
    const key = `${x},${y},${z}`;
    if (this.blockBodies.has(key)) return;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x + 0.5, y + 0.5, z + 0.5);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
    this.world.createCollider(colliderDesc, body);
    this.blockBodies.set(key, body);
  }

  removeBlockCollider(x: number, y: number, z: number): void {
    const key = `${x},${y},${z}`;
    const body = this.blockBodies.get(key);
    if (body) {
      this.world.removeRigidBody(body);
      this.blockBodies.delete(key);
    }
  }

  getRapier(): typeof RAPIER {
    return RAPIER;
  }
}
