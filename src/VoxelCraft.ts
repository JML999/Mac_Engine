import * as THREE from 'three';
import { BlockRegistry } from './engine/BlockRegistry';
import { VoxelWorld } from './engine/World';
import { VoxelRenderer } from './engine/Renderer';
import { PhysicsEngine } from './engine/Physics';
import { PlayerController, PlayerOptions } from './engine/PlayerController';
import { voxelRaycast, RaycastHit } from './engine/VoxelRaycast';
import { MovingPlatform, PlatformOptions } from './engine/MovingPlatform';

export interface VoxelCraftOptions {
  fov?: number;
  gravity?: number;
  skyColor?: string;
  fogNear?: number;
  fogFar?: number;
}

export class VoxelCraft {
  private container: HTMLElement;
  private renderer!: VoxelRenderer;
  private physics!: PhysicsEngine;
  private world!: VoxelWorld;
  private registry!: BlockRegistry;
  private player: PlayerController | null = null;
  private running = false;
  private opts: VoxelCraftOptions;
  private initPromise: Promise<void>;
  private onTickCallbacks: ((dt: number) => void)[] = [];
  private saveKey: string | null = null;
  private autoSaveInterval: number | null = null;
  private platforms: MovingPlatform[] = [];

  score = 0;

  constructor(selector: string, opts: VoxelCraftOptions = {}) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`VoxelCraft: element "${selector}" not found`);
    this.container = el as HTMLElement;
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.opts = opts;

    this.registry = new BlockRegistry();
    this.world = new VoxelWorld(this.registry);
    this.physics = new PhysicsEngine();
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    await this.physics.init();
    this.renderer = new VoxelRenderer(this.container);

    if (this.opts.fov) {
      this.renderer.camera.fov = this.opts.fov;
      this.renderer.camera.updateProjectionMatrix();
    }
    if (this.opts.skyColor) {
      const c = new (await import('three')).Color(this.opts.skyColor);
      this.renderer.scene.background = c;
    }
  }

  // --- World building ---

  flatWorld(size: number, block: string | number = 'grass', depth = 3): this {
    this.world.generateFlat(size, size, block, depth);
    return this;
  }

  placeBlock(x: number, y: number, z: number, block: string | number): this {
    const id = typeof block === 'string' ? this.registry.getId(block) : block;
    this.world.setBlock(x, y, z, id);
    return this;
  }

  removeBlock(x: number, y: number, z: number): this {
    this.world.setBlock(x, y, z, 0);
    return this;
  }

  fillBox(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    block: string | number
  ): this {
    const id = typeof block === 'string' ? this.registry.getId(block) : block;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
          this.world.setBlock(x, y, z, id);
    return this;
  }

  wall(x: number, y: number, z: number, width: number, height: number, block: string | number): this {
    return this.fillBox(x, y, z, x + width - 1, y + height - 1, z, block);
  }

  stairs(x: number, y: number, z: number, count: number, block: string | number): this {
    for (let i = 0; i < count; i++) {
      this.placeBlock(x, y + i, z + i, block);
    }
    return this;
  }

  // --- Block types ---

  addBlockType(name: string, color: string | [number, number, number]): number {
    let rgb: [number, number, number];
    if (typeof color === 'string') {
      const c = parseInt(color.replace('#', ''), 16);
      rgb = [(c >> 16) / 255, ((c >> 8) & 0xff) / 255, (c & 0xff) / 255];
    } else {
      rgb = color;
    }
    return this.registry.addCustom(name, rgb);
  }

  // --- Player ---

  addPlayer(opts: PlayerOptions & { x?: number; y?: number; z?: number } = {}): this {
    const spawnX = opts.x ?? 0;
    const spawnY = opts.y ?? 5;
    const spawnZ = opts.z ?? 5;

    this.initPromise.then(() => {
      const body = this.physics.createPlayerBody(spawnX, spawnY, spawnZ);
      this.player = new PlayerController(
        body,
        this.physics,
        this.renderer.camera,
        this.renderer.getCanvas(),
        opts,
        this.world
      );
      // Wire up death callback - respawn at provided coords or default
      this.player.onDeath = () => {
        this.respawn(opts.x ?? 0, (opts.y ?? 5), opts.z ?? 0);
      };
    });
    return this;
  }

  // --- Game loop ---

  onTick(callback: (dt: number) => void): this {
    this.onTickCallbacks.push(callback);
    return this;
  }

  async start(): Promise<void> {
    await this.initPromise;

    // Build texture atlas from all registered block types
    try {
      const atlas = await this.registry.buildAtlas();
      this.renderer.setAtlas(atlas);
      console.log('VoxelCraft: Texture atlas built successfully');
    } catch (e) {
      console.warn('VoxelCraft: Atlas build failed, using flat colors', e);
    }

    this.renderer.buildWorldMesh(this.world);
    console.log('VoxelCraft: World mesh built, chunks:', this.world.getChunkKeys().length);
    this.physics.createGroundColliders(this.world);
    this.running = true;

    let lastTime = performance.now();
    const loop = (time: number) => {
      if (!this.running) return;
      const dt = Math.min((time - lastTime) / 1000, 0.05); // Cap at 50ms
      lastTime = time;

      // Update moving platforms
      for (const platform of this.platforms) {
        platform.update(dt);
      }

      // Detect if player is on a platform BEFORE physics
      if (this.player && this.platforms.length > 0) {
        const pos = this.player.getPosition();
        for (const platform of this.platforms) {
          if (platform.isPointAbove(pos.x, pos.y, pos.z)) {
            this.player.setPlatformDelta(platform.deltaX, platform.deltaZ);
            break;
          }
        }
      }

      // Player update sets velocity (WASD + platform delta)
      if (this.player) {
        this.player.update();
      }

      // Physics step applies the velocity
      this.physics.step(1 / 60);

      for (const cb of this.onTickCallbacks) {
        cb(dt);
      }

      this.renderer.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  // --- Moving platforms ---

  addMovingPlatform(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    opts?: PlatformOptions
  ): this {
    // Platforms are created after start() since they need the scene and atlas
    this.initPromise.then(() => {
      const platform = new MovingPlatform(
        this.renderer.scene,
        this.physics,
        this.registry,
        this.registry.atlas,
        x1, y1, z1,
        x2, y2, z2,
        opts
      );
      this.platforms.push(platform);
    });
    return this;
  }

  // --- Raycasting (for block placement/removal) ---

  raycast(maxDist = 8): RaycastHit | null {
    const cam = this.renderer.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    return voxelRaycast(
      this.world,
      cam.position.x, cam.position.y, cam.position.z,
      dir.x, dir.y, dir.z,
      maxDist
    );
  }

  // Place a block where the player is looking (on the face they're pointing at)
  placeBlockAtCursor(block: string | number, maxDist = 8): boolean {
    const hit = this.raycast(maxDist);
    if (!hit) return false;
    const id = typeof block === 'string' ? this.registry.getId(block) : block;
    const bt = this.registry.get(id);
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    this.world.setBlock(px, py, pz, id);
    this.renderer.rebuildChunk(this.world, px, py, pz);
    // Also rebuild neighbor chunk if on boundary
    if (hit.nx !== 0) this.renderer.rebuildChunk(this.world, hit.x, hit.y, hit.z);
    if (hit.ny !== 0) this.renderer.rebuildChunk(this.world, hit.x, hit.y, hit.z);
    if (hit.nz !== 0) this.renderer.rebuildChunk(this.world, hit.x, hit.y, hit.z);
    // Add physics collider for solid blocks
    if (bt?.solid !== false) {
      this.physics.addBlockCollider(px, py, pz);
    }
    return true;
  }

  // Remove the block the player is looking at
  removeBlockAtCursor(maxDist = 8): boolean {
    const hit = this.raycast(maxDist);
    if (!hit) return false;
    this.world.setBlock(hit.x, hit.y, hit.z, 0);
    this.renderer.rebuildChunk(this.world, hit.x, hit.y, hit.z);
    // Remove physics collider
    this.physics.removeBlockCollider(hit.x, hit.y, hit.z);
    return true;
  }

  // --- Accessors ---

  getPlayerPosition(): { x: number; y: number; z: number } | null {
    return this.player?.getPosition() ?? null;
  }

  respawn(x?: number, y?: number, z?: number): void {
    this.player?.setPosition(x ?? 0, y ?? 5, z ?? 0);
  }

  getWorld() { return this.world; }
  getRegistry() { return this.registry; }
  getScene() { return this.renderer.scene; }
  getCamera() { return this.renderer.camera; }
  getThree() { return import('three'); }

  // --- Persistence ---

  // Enable auto-save: saves world to localStorage every intervalSec seconds + on page unload
  autoSave(key = 'voxelcraft-world', intervalSec = 30): this {
    this.saveKey = key;

    // Save on interval
    this.autoSaveInterval = window.setInterval(() => {
      this.saveEdits();
    }, intervalSec * 1000);

    // Save on page close
    window.addEventListener('beforeunload', () => {
      this.saveEdits();
    });

    return this;
  }

  // Save current world to localStorage
  save(key?: string): boolean {
    const k = key ?? this.saveKey ?? 'voxelcraft-world';
    try {
      const data = this.world.serialize();
      localStorage.setItem(k, JSON.stringify(data));
      console.log('VoxelCraft: World saved');
      return true;
    } catch (e) {
      console.warn('VoxelCraft: Save failed', e);
      return false;
    }
  }

  // Load world from localStorage (replaces current world entirely)
  load(key?: string): boolean {
    const k = key ?? this.saveKey ?? 'voxelcraft-world';
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.world.deserialize(data);
      console.log('VoxelCraft: World loaded from save');
      return true;
    } catch (e) {
      console.warn('VoxelCraft: Load failed', e);
      return false;
    }
  }

  // Load saved blocks on top of the base world (code-defined world + player edits)
  loadEdits(key?: string): boolean {
    const k = (key ?? this.saveKey ?? 'voxelcraft-world') + '-edits';
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.world.merge(data);
      console.log('VoxelCraft: Player edits loaded');
      return true;
    } catch (e) {
      console.warn('VoxelCraft: Load edits failed', e);
      return false;
    }
  }

  // Save only the diff between current world and what code defined
  // This way code changes (new lava, NPCs) still apply, but player-placed blocks persist
  saveEdits(key?: string): boolean {
    const k = (key ?? this.saveKey ?? 'voxelcraft-world') + '-edits';
    try {
      const data = this.world.serialize();
      localStorage.setItem(k, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('VoxelCraft: Save edits failed', e);
      return false;
    }
  }

  // Clear saved data
  clearSave(key?: string): void {
    const k = key ?? this.saveKey ?? 'voxelcraft-world';
    localStorage.removeItem(k);
    localStorage.removeItem(k + '-edits');
    console.log('VoxelCraft: Save cleared');
  }

  // Debug helper
  _debugGetAtlas() { return this.registry.atlas; }
}
