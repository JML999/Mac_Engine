import { VoxelCraft as _VoxelCraft } from './VoxelCraft';

// Export for CDN usage
export { _VoxelCraft as VoxelCraft };

// Also export engine internals for advanced users
export { BlockRegistry, type BlockType } from './engine/BlockRegistry';
export { VoxelWorld, CHUNK_SIZE } from './engine/World';
export { VoxelRenderer } from './engine/Renderer';
export { PhysicsEngine } from './engine/Physics';
export { PlayerController, type PlayerOptions } from './engine/PlayerController';
export { TextureAtlas } from './engine/TextureAtlas';
export { voxelRaycast, type RaycastHit } from './engine/VoxelRaycast';

// For IIFE/CDN: attach VoxelCraft constructor directly to window
if (typeof window !== 'undefined') {
  (window as any).VoxelCraft = _VoxelCraft;
}
