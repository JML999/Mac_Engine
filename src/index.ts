import { VoxelCraft } from './VoxelCraft';

// Export for CDN usage - attaches to window.VoxelCraft
export { VoxelCraft };

// Also export engine internals for advanced users
export { BlockRegistry, type BlockType } from './engine/BlockRegistry';
export { VoxelWorld, CHUNK_SIZE } from './engine/World';
export { VoxelRenderer } from './engine/Renderer';
export { PhysicsEngine } from './engine/Physics';
export { PlayerController, type PlayerOptions } from './engine/PlayerController';
export { TextureAtlas } from './engine/TextureAtlas';
