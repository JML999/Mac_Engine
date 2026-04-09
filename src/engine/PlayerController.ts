import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsEngine } from './Physics';

// Hytopia's exact movement constants from DefaultPlayerEntityController.ts
const HYTOPIA_WALK_VELOCITY = 4;
const HYTOPIA_RUN_VELOCITY = 8;
const HYTOPIA_JUMP_VELOCITY = 10;

export interface PlayerOptions {
  speed?: number;
  runSpeed?: number;
  jumpForce?: number;
  mouseSensitivity?: number;
  type?: 'first-person' | 'third-person';
}

export class PlayerController {
  private body: RAPIER.RigidBody;
  private physics: PhysicsEngine;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  private yaw = 0;
  private pitch = 0;
  private keys: Set<string> = new Set();
  private locked = false;

  private speed: number;
  private runSpeed: number;
  private jumpForce: number;
  private sensitivity: number;
  private mode: 'first-person' | 'third-person';
  private thirdPersonOffset = new THREE.Vector3(0, 6, 12);
  private running = false;
  private jumpPressed = false;
  /** Platform the player is currently riding */
  private _platformDeltaX = 0;
  private _platformDeltaZ = 0;
  private _onPlatform = false;

  constructor(
    body: RAPIER.RigidBody,
    physics: PhysicsEngine,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    opts: PlayerOptions = {}
  ) {
    this.body = body;
    this.physics = physics;
    this.camera = camera;
    this.canvas = canvas;
    this.speed = opts.speed ?? HYTOPIA_WALK_VELOCITY;
    this.runSpeed = opts.runSpeed ?? HYTOPIA_RUN_VELOCITY;
    this.jumpForce = opts.jumpForce ?? HYTOPIA_JUMP_VELOCITY;
    this.sensitivity = opts.mouseSensitivity ?? 0.002;
    this.mode = opts.type ?? 'third-person';

    this.setupInput();
  }

  private setupInput() {
    // Pointer lock
    this.canvas.addEventListener('click', () => {
      if (!this.locked) this.canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
    });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code.toLowerCase());
    });
  }

  update(): void {
    const pos = this.body.translation();

    // Movement direction relative to camera yaw
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3(0, 0, 0);
    if (this.keys.has('keyw') || this.keys.has('arrowup')) move.add(forward);
    if (this.keys.has('keys') || this.keys.has('arrowdown')) move.sub(forward);
    if (this.keys.has('keya') || this.keys.has('arrowleft')) move.sub(right);
    if (this.keys.has('keyd') || this.keys.has('arrowright')) move.add(right);

    // Shift to run (Hytopia style)
    this.running = this.keys.has('shiftleft') || this.keys.has('shiftright');
    const currentSpeed = this.running ? this.runSpeed : this.speed;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(currentSpeed);
    }

    // Apply horizontal velocity, preserve vertical
    // If on a moving platform, add its per-frame displacement as velocity
    const vel = this.body.linvel();
    let finalX = move.x;
    let finalZ = move.z;
    if (this._onPlatform) {
      // Convert per-frame delta to velocity (multiply by 60 since physics runs at 60hz)
      finalX += this._platformDeltaX * 60;
      finalZ += this._platformDeltaZ * 60;
      this._onPlatform = false;
      this._platformDeltaX = 0;
      this._platformDeltaZ = 0;
    }
    this.body.setLinvel({ x: finalX, y: vel.y, z: finalZ }, true);

    // Jump - only on initial press, not while held
    const spaceDown = this.keys.has('space');
    if (spaceDown && !this.jumpPressed && this.physics.isOnGround(this.body)) {
      this.body.setLinvel({ x: finalX, y: this.jumpForce, z: finalZ }, true);
    }
    this.jumpPressed = spaceDown;

    // Update camera
    const playerPos = this.body.translation();

    if (this.mode === 'first-person') {
      this.camera.position.set(playerPos.x, playerPos.y + 0.7, playerPos.z);
      const lookDir = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(
        this.camera.position.x + lookDir.x,
        this.camera.position.y + lookDir.y,
        this.camera.position.z + lookDir.z
      );
    } else {
      // Third person
      const offset = this.thirdPersonOffset.clone();
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.camera.position.set(
        playerPos.x + offset.x,
        playerPos.y + offset.y,
        playerPos.z + offset.z
      );
      this.camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z);
    }
  }

  getPosition(): { x: number; y: number; z: number } {
    const t = this.body.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  getBody(): RAPIER.RigidBody {
    return this.body;
  }

  /** Called each frame when player is standing on a moving platform */
  setPlatformDelta(dx: number, dz: number): void {
    this._onPlatform = true;
    this._platformDeltaX = dx;
    this._platformDeltaZ = dz;
  }

  setPosition(x: number, y: number, z: number): void {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
}
