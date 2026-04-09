// Runtime texture atlas builder - packs individual block PNGs into a single atlas texture
// Similar to Hytopia's BlockTextureAtlasManager but simplified for standalone use
import * as THREE from 'three';

const TILE_SIZE = 24;   // Hytopia uses 24x24 block textures
const PADDING = 2;      // Padding to prevent bleeding
const PADDED_TILE = TILE_SIZE + PADDING * 2;

export interface AtlasEntry {
  u0: number; v0: number; // top-left UV
  u1: number; v1: number; // bottom-right UV
}

export class TextureAtlas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private entries: Map<string, AtlasEntry> = new Map();
  private nextX = 0;
  private nextY = 0;
  private rowHeight = 0;
  private atlasSize: number;
  private loadPromises: Promise<void>[] = [];

  constructor(size = 512) {
    this.atlasSize = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    // Start fully transparent - alphaTest will discard unmapped areas
    this.ctx.clearRect(0, 0, size, size);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.flipY = false; // We handle UV mapping ourselves
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
  }

  // Register a texture to be loaded
  addTexture(key: string, url: string): void {
    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.packImage(key, img);
        resolve();
      };
      img.onerror = () => {
        // Generate a colored fallback
        console.warn(`Failed to load texture: ${url}`);
        resolve();
      };
      img.src = url;
    });
    this.loadPromises.push(promise);
  }

  private packImage(key: string, img: HTMLImageElement): void {
    // Find space in atlas
    if (this.nextX + PADDED_TILE > this.atlasSize) {
      this.nextX = 0;
      this.nextY += this.rowHeight;
      this.rowHeight = 0;
    }

    const x = this.nextX + PADDING;
    const y = this.nextY + PADDING;

    // Clear the tile area (including padding) to transparent so alpha works for leaves etc.
    this.ctx.clearRect(x - PADDING, y - PADDING, TILE_SIZE + PADDING * 2, TILE_SIZE + PADDING * 2);

    // Draw the texture
    this.ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);

    // Padding: repeat edge pixels to prevent seam bleeding on opaque textures
    this.ctx.drawImage(img, 0, 0, img.width, 1, x, y - PADDING, TILE_SIZE, PADDING);
    this.ctx.drawImage(img, 0, img.height - 1, img.width, 1, x, y + TILE_SIZE, TILE_SIZE, PADDING);
    this.ctx.drawImage(img, 0, 0, 1, img.height, x - PADDING, y, PADDING, TILE_SIZE);
    this.ctx.drawImage(img, img.width - 1, 0, 1, img.height, x + TILE_SIZE, y, PADDING, TILE_SIZE);

    // Store UV coordinates
    const u0 = x / this.atlasSize;
    const v0 = y / this.atlasSize;
    const u1 = (x + TILE_SIZE) / this.atlasSize;
    const v1 = (y + TILE_SIZE) / this.atlasSize;
    this.entries.set(key, { u0, v0, u1, v1 });

    this.nextX += PADDED_TILE;
    this.rowHeight = Math.max(this.rowHeight, PADDED_TILE);
  }

  async build(): Promise<THREE.CanvasTexture> {
    await Promise.all(this.loadPromises);
    this.texture.needsUpdate = true;
    return this.texture;
  }

  getEntry(key: string): AtlasEntry | undefined {
    return this.entries.get(key);
  }

  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  debugEntryCount(): number {
    return this.entries.size;
  }

  // Expose canvas for debugging
  debugCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  // Map a [0-1] face UV to atlas UV for a specific texture
  mapUV(key: string, u: number, v: number): [number, number] {
    const entry = this.entries.get(key);
    if (!entry) return [u, v]; // fallback
    // CanvasTexture with flipY=true handles the Y flip, so map directly
    const mappedU = entry.u0 + u * (entry.u1 - entry.u0);
    const mappedV = entry.v0 + v * (entry.v1 - entry.v0);
    return [mappedU, mappedV];
  }
}
