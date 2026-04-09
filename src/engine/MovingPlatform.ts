import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsEngine } from './Physics';
import { BlockRegistry } from './BlockRegistry';
import { TextureAtlas } from './TextureAtlas';

export interface PlatformOptions {
  /** Block type name or ID for the platform surface */
  block?: string | number;
  /** Width in blocks (X axis) */
  width?: number;
  /** Depth in blocks (Z axis) */
  depth?: number;
  /** Speed in blocks per second */
  speed?: number;
  /** Pause time at each end in seconds */
  pauseTime?: number;
}

export class MovingPlatform {
  private body: RAPIER.RigidBody;
  private mesh: THREE.Mesh;
  private startPos: THREE.Vector3;
  private endPos: THREE.Vector3;
  private speed: number;
  private pauseTime: number;
  private progress = 0; // 0 to 1
  private direction = 1; // 1 = toward end, -1 = toward start
  private paused = 0; // countdown timer
  private width: number;
  private depth: number;
  colliderHandle = 0;
  private lastX = 0;
  private lastY = 0;
  private lastZ = 0;
  /** Platform displacement this frame (for carrying the player) */
  deltaX = 0;
  deltaY = 0;
  deltaZ = 0;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsEngine,
    registry: BlockRegistry,
    atlas: TextureAtlas | null,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    opts: PlatformOptions = {}
  ) {
    this.width = opts.width ?? 3;
    this.depth = opts.depth ?? 3;
    this.speed = opts.speed ?? 2;
    this.pauseTime = opts.pauseTime ?? 0.5;

    this.startPos = new THREE.Vector3(x1, y1, z1);
    this.endPos = new THREE.Vector3(x2, y2, z2);

    const totalDist = this.startPos.distanceTo(this.endPos);
    // Speed is in blocks/sec, convert to progress/sec
    this.speed = (opts.speed ?? 2) / totalDist;

    // Create visual mesh - a flat slab
    const blockName = opts.block ?? 'stone';
    const bt = typeof blockName === 'string' ? registry.get(blockName) : registry.get(blockName);
    const color = bt?.color ?? [0.5, 0.5, 0.5];

    const geo = new THREE.BoxGeometry(this.width, 0.5, this.depth);
    let mat: THREE.MeshBasicMaterial;

    // Try to use textured material
    const texKey = bt ? registry.getTextureKey(bt.id, 'top') : null;
    if (atlas && texKey) {
      const entry = atlas.getEntry(texKey);
      if (entry) {
        // Clone the atlas texture and adjust UV mapping for this geometry
        mat = new THREE.MeshBasicMaterial({
          map: atlas.getTexture(),
          color: new THREE.Color(0.9, 0.9, 0.9), // Slightly dim to match AO look
        });
      } else {
        mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]) });
      }
    } else {
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]) });
    }

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.startPos);
    scene.add(this.mesh);

    this.lastX = x1;
    this.lastY = y1;
    this.lastZ = z1;

    // Kinematic position-based body for the platform collision
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x1, y1, z1);
    this.body = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(this.width / 2, 0.25, this.depth / 2);
    this.colliderHandle = physics.world.createCollider(colliderDesc, this.body).handle;
  }

  update(dt: number): void {
    // Handle pause at endpoints
    if (this.paused > 0) {
      this.paused -= dt;
      this.deltaX = 0;
      this.deltaY = 0;
      this.deltaZ = 0;
      return;
    }

    // Move progress
    this.progress += this.speed * this.direction * dt;

    // Bounce at endpoints
    if (this.progress >= 1) {
      this.progress = 1;
      this.direction = -1;
      this.paused = this.pauseTime;
    } else if (this.progress <= 0) {
      this.progress = 0;
      this.direction = 1;
      this.paused = this.pauseTime;
    }

    // Interpolate position
    const x = this.startPos.x + (this.endPos.x - this.startPos.x) * this.progress;
    const y = this.startPos.y + (this.endPos.y - this.startPos.y) * this.progress;
    const z = this.startPos.z + (this.endPos.z - this.startPos.z) * this.progress;

    // Track displacement
    this.deltaX = x - this.lastX;
    this.deltaY = y - this.lastY;
    this.deltaZ = z - this.lastZ;

    this.lastX = x;
    this.lastY = y;
    this.lastZ = z;

    // Update visual
    this.mesh.position.set(x, y, z);

    // Update physics body position
    this.body.setNextKinematicTranslation({ x, y, z });
  }

  getPosition(): { x: number; y: number; z: number } {
    return { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z };
  }

  /** Check if a point is standing on this platform.
   *  Uses generous bounds - better to falsely detect than miss a frame */
  isPointAbove(px: number, py: number, pz: number): boolean {
    const x = this.mesh.position.x;
    const y = this.mesh.position.y;
    const z = this.mesh.position.z;
    // Extra padding on horizontal bounds so player doesn't slip off edges
    const hw = this.width / 2 + 0.5;
    const hd = this.depth / 2 + 0.5;
    // Platform top surface is at y + 0.25 (half height of cuboid)
    // Player feet at py - 0.85 (capsule half-height + radius)
    // Player is "on" platform when feet are near surface
    const feetY = py - 0.85;
    const surfaceY = y + 0.25;
    return px >= x - hw && px <= x + hw &&
           pz >= z - hd && pz <= z + hd &&
           feetY >= surfaceY - 0.3 && feetY <= surfaceY + 0.5;
  }
}
