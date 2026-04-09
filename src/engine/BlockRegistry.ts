import { TextureAtlas } from './TextureAtlas';

export interface BlockType {
  id: number;
  name: string;
  color: [number, number, number]; // RGB 0-1 (fallback when no texture)
  topColor?: [number, number, number];
  bottomColor?: [number, number, number];
  transparent?: boolean;
  solid?: boolean;
  alphaTest?: boolean;    // Texture has cutout alpha (leaves, vines) - don't cull neighbor faces
  // Texture keys into the atlas
  textureAll?: string;     // Single texture for all faces
  textureTop?: string;     // +Y face
  textureBottom?: string;  // -Y face
  textureSide?: string;    // +/-X, +/-Z faces
}

const BASE = '/textures/blocks';

// Default blocks using Hytopia's actual textures
const DEFAULT_BLOCKS: BlockType[] = [
  { id: 1, name: 'grass', color: [0.36, 0.60, 0.25],
    textureTop: `${BASE}/grass-block/+y.png`, textureBottom: `${BASE}/dirt.png`, textureSide: `${BASE}/grass-block/+x.png`,
    topColor: [0.36, 0.60, 0.25], bottomColor: [0.45, 0.32, 0.22], solid: true },
  { id: 2, name: 'dirt', color: [0.45, 0.32, 0.22], textureAll: `${BASE}/dirt.png`, solid: true },
  { id: 3, name: 'stone', color: [0.50, 0.50, 0.50], textureAll: `${BASE}/stone.png`, solid: true },
  { id: 4, name: 'sand', color: [0.86, 0.82, 0.60], textureAll: `${BASE}/sand.png`, solid: true },
  { id: 5, name: 'wood', color: [0.55, 0.36, 0.20],
    textureTop: `${BASE}/oak-log/+y.png`, textureBottom: `${BASE}/oak-log/-y.png`, textureSide: `${BASE}/oak-log/+x.png`,
    topColor: [0.50, 0.40, 0.25], solid: true },
  { id: 6, name: 'leaves', color: [0.22, 0.50, 0.18], textureAll: `${BASE}/leaves.png`, solid: true, alphaTest: true },
  { id: 7, name: 'water', color: [0.20, 0.40, 0.80], textureAll: `${BASE}/water.png`, transparent: true, solid: false },
  { id: 8, name: 'brick', color: [0.65, 0.30, 0.25], textureAll: `${BASE}/bricks.png`, solid: true },
  { id: 9, name: 'cobblestone', color: [0.42, 0.42, 0.42], textureAll: `${BASE}/cobblestone.png`, solid: true },
  { id: 10, name: 'snow', color: [0.95, 0.95, 0.98], textureAll: `${BASE}/snow.png`, solid: true },
  { id: 11, name: 'glass', color: [0.75, 0.85, 0.95], textureAll: `${BASE}/glass.png`, transparent: true, solid: true, alphaTest: true },
  { id: 12, name: 'lava', color: [0.90, 0.35, 0.05], textureAll: `${BASE}/lava.png`, solid: false },
  { id: 13, name: 'gold', color: [0.90, 0.75, 0.20], textureAll: `${BASE}/gold.png`, solid: true },
  { id: 14, name: 'iron', color: [0.70, 0.68, 0.65], textureAll: `${BASE}/iron.png`, solid: true },
  { id: 15, name: 'planks', color: [0.70, 0.55, 0.30], textureAll: `${BASE}/planks.png`, solid: true },
];

export class BlockRegistry {
  private blocks: Map<number, BlockType> = new Map();
  private nameToId: Map<string, number> = new Map();
  private nextId = 100;
  atlas: TextureAtlas | null = null;

  constructor() {
    for (const block of DEFAULT_BLOCKS) {
      this.register(block);
    }
  }

  register(block: BlockType): void {
    this.blocks.set(block.id, { solid: true, transparent: false, ...block });
    this.nameToId.set(block.name.toLowerCase(), block.id);
  }

  get(idOrName: number | string): BlockType | undefined {
    if (typeof idOrName === 'number') return this.blocks.get(idOrName);
    return this.blocks.get(this.nameToId.get(idOrName.toLowerCase()) ?? -1);
  }

  getId(name: string): number {
    return this.nameToId.get(name.toLowerCase()) ?? 0;
  }

  addCustom(name: string, color: [number, number, number], opts?: Partial<BlockType>): number {
    const id = this.nextId++;
    this.register({ id, name, color, ...opts });
    return id;
  }

  getAll(): BlockType[] {
    return Array.from(this.blocks.values());
  }

  // Build texture atlas from all registered block textures
  async buildAtlas(): Promise<TextureAtlas> {
    const atlas = new TextureAtlas(512);
    const added = new Set<string>();

    for (const bt of this.blocks.values()) {
      const textures = [bt.textureAll, bt.textureTop, bt.textureBottom, bt.textureSide].filter(Boolean) as string[];
      for (const tex of textures) {
        if (!added.has(tex)) {
          atlas.addTexture(tex, tex);
          added.add(tex);
        }
      }
    }

    await atlas.build();
    this.atlas = atlas;
    return atlas;
  }

  // Get the texture key for a specific face of a block
  getTextureKey(blockId: number, face: string): string | null {
    const bt = this.blocks.get(blockId);
    if (!bt) return null;
    if (face === 'top' && bt.textureTop) return bt.textureTop;
    if (face === 'bottom' && bt.textureBottom) return bt.textureBottom;
    if ((face === 'left' || face === 'right' || face === 'front' || face === 'back') && bt.textureSide) return bt.textureSide;
    return bt.textureAll ?? null;
  }
}
