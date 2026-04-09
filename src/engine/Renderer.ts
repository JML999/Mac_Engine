// Renderer using Hytopia's approach:
// - MeshBasicMaterial with onBeforeCompile for vertex lighting (no Three.js lights)
// - Post-processing: bloom + SMAA
// - Skybox + fog
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VoxelWorld, CHUNK_SIZE } from './World';
import { buildChunkMesh } from './ChunkMesher';
import { TextureAtlas } from './TextureAtlas';

// Block material: MeshBasicMaterial with vertex colors
// AO, face shading, and sky light are baked into vertex colors by the mesher (like Hytopia)
// MeshBasicMaterial = no GPU lighting cost, all lighting is pre-computed per-vertex
function createBlockMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.FrontSide,
    alphaTest: 0.05, // Hytopia's ALPHA_TEST_THRESHOLD - discards transparent leaf pixels
  });
}

export class VoxelRenderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly ambientLight: { color: THREE.Color; intensity: number };

  private chunkMeshes: Map<string, THREE.Mesh> = new Map();
  private container: HTMLElement;
  private blockMaterial: THREE.MeshBasicMaterial;
  private composer: EffectComposer | null = null;
  private usePostProcessing = true;
  private atlas: TextureAtlas | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Hytopia ambient light defaults
    this.ambientLight = {
      color: new THREE.Color(1, 1, 1),
      intensity: 1.0,
    };

    this.scene = new THREE.Scene();

    // Sky blue background matching Hytopia's aesthetic
    this.scene.background = new THREE.Color(0.55, 0.78, 1.0);
    this.scene.fog = new THREE.Fog(0x8cc7ff, 80, 220);

    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 500);
    this.camera.position.set(0, 12, 20);

    // Hytopia: antialias false, handled by SMAA post-processing
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Block material (MeshBasicMaterial - same as Hytopia, no GPU lighting)
    this.blockMaterial = createBlockMaterial();

    // Post-processing chain (Hytopia: RenderPass -> Bloom -> SMAA -> Output)
    this.setupPostProcessing(w, h);

    window.addEventListener('resize', () => this.onResize());
  }

  private setupPostProcessing(w: number, h: number) {
    const renderTarget = new THREE.WebGLRenderTarget(w, h, {
      depthTexture: new THREE.DepthTexture(w, h),
      type: THREE.HalfFloatType,
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Bloom pass (Hytopia uses WhiteCoreBloomPass, we use UnrealBloom as approximation)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.3,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(bloomPass);

    // SMAA anti-aliasing (same as Hytopia)
    const smaaPass = new SMAAPass(w, h);
    this.composer.addPass(smaaPass);

    this.composer.addPass(new OutputPass());
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  }

  setAtlas(atlas: TextureAtlas): void {
    this.atlas = atlas;
    const tex = atlas.getTexture();
    console.log('Atlas texture size:', tex.image.width, 'x', tex.image.height);
    console.log('Atlas entries:', atlas.debugEntryCount());
    this.blockMaterial.map = tex;
    this.blockMaterial.needsUpdate = true;
  }

  buildWorldMesh(world: VoxelWorld): void {
    for (const mesh of this.chunkMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunkMeshes.clear();

    for (const key of world.getChunkKeys()) {
      const [cx, cy, cz] = key.split(',').map(Number);
      const geo = buildChunkMesh(world, cx, cy, cz, this.atlas);
      if (!geo) continue;

      const mesh = new THREE.Mesh(geo, this.blockMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldAutoUpdate = false;
      this.scene.add(mesh);
      this.chunkMeshes.set(key, mesh);
    }
  }

  rebuildChunk(world: VoxelWorld, wx: number, wy: number, wz: number): void {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = `${cx},${cy},${cz}`;

    const old = this.chunkMeshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.chunkMeshes.delete(key);
    }

    const geo = buildChunkMesh(world, cx, cy, cz, this.atlas);
    if (!geo) return;

    const mesh = new THREE.Mesh(geo, this.blockMaterial);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    this.scene.add(mesh);
    this.chunkMeshes.set(key, mesh);
  }

  render(): void {
    if (this.usePostProcessing && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
