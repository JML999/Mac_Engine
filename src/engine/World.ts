import { BlockRegistry, BlockType } from './BlockRegistry';

export const CHUNK_SIZE = 16;

export interface ChunkCoord {
  cx: number;
  cy: number;
  cz: number;
}

export class VoxelWorld {
  readonly registry: BlockRegistry;
  private chunks: Map<string, Uint8Array> = new Map();

  constructor(registry: BlockRegistry) {
    this.registry = registry;
  }

  private chunkKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  private getOrCreateChunk(cx: number, cy: number, cz: number): Uint8Array {
    const key = this.chunkKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private localIndex(lx: number, ly: number, lz: number): number {
    return lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
  }

  setBlock(x: number, y: number, z: number, blockId: number): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunk = this.getOrCreateChunk(cx, cy, cz);
    chunk[this.localIndex(lx, ly, lz)] = blockId;
  }

  getBlock(x: number, y: number, z: number): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this.chunkKey(cx, cy, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[this.localIndex(lx, ly, lz)];
  }

  isSolid(x: number, y: number, z: number): boolean {
    const id = this.getBlock(x, y, z);
    if (id === 0) return false;
    const bt = this.registry.get(id);
    return bt?.solid !== false;
  }

  getChunkKeys(): string[] {
    return Array.from(this.chunks.keys());
  }

  getChunkData(cx: number, cy: number, cz: number): Uint8Array | undefined {
    return this.chunks.get(this.chunkKey(cx, cy, cz));
  }

  // Serialize all chunks to a JSON-safe object
  serialize(): Record<string, number[]> {
    const data: Record<string, number[]> = {};
    for (const [key, chunk] of this.chunks.entries()) {
      data[key] = Array.from(chunk);
    }
    return data;
  }

  // Load chunks from serialized data (replaces current world)
  deserialize(data: Record<string, number[]>): void {
    this.chunks.clear();
    for (const [key, arr] of Object.entries(data)) {
      this.chunks.set(key, new Uint8Array(arr));
    }
  }

  // Merge saved data on top of current world (saved blocks override base world)
  merge(data: Record<string, number[]>): void {
    for (const [key, arr] of Object.entries(data)) {
      const saved = new Uint8Array(arr);
      const existing = this.chunks.get(key);
      if (existing) {
        // Overwrite only non-zero blocks from save, but also apply zeros (removed blocks)
        for (let i = 0; i < saved.length; i++) {
          existing[i] = saved[i];
        }
      } else {
        this.chunks.set(key, saved);
      }
    }
  }

  generateFlat(sizeX: number, sizeZ: number, groundBlock: string | number = 'grass', depth = 3): void {
    const blockId = typeof groundBlock === 'string'
      ? this.registry.getId(groundBlock)
      : groundBlock;
    const dirtId = this.registry.getId('dirt') || blockId;
    const stoneId = this.registry.getId('stone') || dirtId;

    for (let x = -Math.floor(sizeX / 2); x < Math.ceil(sizeX / 2); x++) {
      for (let z = -Math.floor(sizeZ / 2); z < Math.ceil(sizeZ / 2); z++) {
        this.setBlock(x, 0, z, blockId);
        for (let d = 1; d < depth; d++) {
          this.setBlock(x, -d, z, d < depth - 1 ? dirtId : stoneId);
        }
      }
    }
  }
}
