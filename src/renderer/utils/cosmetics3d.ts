import * as THREE from 'three';
import { SkinViewer } from 'skinview3d';
import { ShopCosmetic } from '../types';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
}

export class Cosmetics3DRenderer {
  private viewer: SkinViewer;
  private attachedObjects: THREE.Object3D[] = [];
  private animationFrameId: number | null = null;
  private wingLeft: THREE.Object3D | null = null;
  private wingRight: THREE.Object3D | null = null;
  private wingLeftTip: THREE.Object3D | null = null;
  private wingRightTip: THREE.Object3D | null = null;
  private haloMesh: THREE.Object3D | null = null;

  constructor(viewer: SkinViewer) {
    this.viewer = viewer;
    this.startAnimationLoop();
  }

  private startAnimationLoop() {
    let time = 0;
    const animate = () => {
      time += 0.045;

      // Animar aleteo orgánico de Baby Dragon Wings estilo Lunar Client
      if (this.wingLeft && this.wingRight) {
        // Articulación principal del hombro (Flap Yaw + Pitch + Roll)
        const flapYaw = Math.sin(time * 2.8) * 0.38 + 0.22;
        const flapPitch = Math.sin(time * 2.8 + 0.2) * 0.1 - 0.05;
        const flapRoll = Math.cos(time * 2.8) * 0.06;

        this.wingLeft.rotation.y = flapYaw;
        this.wingLeft.rotation.x = flapPitch;
        this.wingLeft.rotation.z = flapRoll;

        this.wingRight.rotation.y = -flapYaw;
        this.wingRight.rotation.x = flapPitch;
        this.wingRight.rotation.z = -flapRoll;

        // Articulación secundaria del codo (Desfasaje de apertura y flexibilidad)
        if (this.wingLeftTip && this.wingRightTip) {
          const elbowFlap = Math.sin(time * 2.8 + 0.5) * 0.26;
          this.wingLeftTip.rotation.y = elbowFlap;
          this.wingRightTip.rotation.y = -elbowFlap;
        }
      }

      // Animar rotación suave del Halo 3D si está presente
      if (this.haloMesh) {
        this.haloMesh.rotation.y += 0.02;
        this.haloMesh.position.y = 8.5 + Math.sin(time * 2) * 0.3;
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  public clearAllCosmetics() {
    for (const obj of this.attachedObjects) {
      if (obj.parent) {
        obj.parent.remove(obj);
      }
    }
    this.attachedObjects = [];
    this.wingLeft = null;
    this.wingRight = null;
    this.wingLeftTip = null;
    this.wingRightTip = null;
    this.haloMesh = null;
    this.viewer.resetCape();
  }

  public updateCosmetics(
    activeCape: ShopCosmetic | null,
    activeWings: ShopCosmetic | null,
    activeHat: ShopCosmetic | null,
    activeBandana: ShopCosmetic | null
  ) {
    this.clearAllCosmetics();

    const player = this.viewer.playerObject;
    if (!player || !player.skin) return;

    const head = player.skin.head;
    const body = player.skin.body;

    // 1. Renderizar Capa
    if (activeCape && activeCape.texture_url) {
      this.viewer.loadCape(activeCape.texture_url);
    }

    // 2. Renderizar Alas 3D estilo Lunar Client
    if (activeWings && body) {
      this.attachWings(body, activeWings);
    }

    // 3. Renderizar Sombreros / Coronas / Halos 3D
    if (activeHat && head) {
      this.attachHat(head, activeHat);
    }

    // 4. Renderizar Bandanas / Máscaras / Visores 3D
    if (activeBandana && head) {
      this.attachBandana(head, activeBandana);
    }
  }

  /**
   * Construye una membrana festoneada de dragón con curvas de Bézier idénticas a Lunar Client
   */
  private createDragonWingMembrane(isLeft: boolean, color: number): THREE.Mesh {
    const shape = new THREE.Shape();
    const sign = isLeft ? 1 : -1;

    // Forma festoneada de membrana de dragón
    shape.moveTo(0, 0); // Codo
    shape.lineTo(sign * 4.4, -1.2); // Extremo costilla superior
    shape.quadraticCurveTo(sign * 3.4, -2.8, sign * 2.2, -4.2); // Arco festoneado 1
    shape.quadraticCurveTo(sign * 1.5, -3.8, sign * 0.6, -3.4); // Arco festoneado 2
    shape.quadraticCurveTo(sign * 0.1, -1.8, 0, 0); // Regreso a la base

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });

    return new THREE.Mesh(geo, mat);
  }

  private attachWings(body: THREE.Object3D, cosmetic: ShopCosmetic) {
    const wingsGroup = new THREE.Group();
    // Posición perfecta en la parte alta de la espalda entre los omóplatos
    wingsGroup.position.set(0, 5.0, 2.1);

    const isBlackDragon =
      cosmetic.id === 'wings-fallen-angel-void' ||
      cosmetic.id.includes('dragon') ||
      cosmetic.id.includes('black') ||
      cosmetic.id.includes('void') ||
      cosmetic.category === 'wings';

    const isAngel = cosmetic.id.includes('angel') && !isBlackDragon;
    const isMecha = cosmetic.model_type === 'mecha';

    // Colores fieles a Lunar Client Baby Dragon Wings (Black)
    const boneColor = isBlackDragon ? 0x121218 : isAngel ? 0xfef08a : isMecha ? 0x0f172a : 0x1c1917;
    const clawColor = isBlackDragon ? 0x050508 : isAngel ? 0xffffff : isMecha ? 0x00ffff : 0x0a0a0a;
    const membraneColor = isBlackDragon ? 0x1f1f2a : isAngel ? 0xf8fafc : isMecha ? 0x0284c7 : 0x27272a;

    // === ALA IZQUIERDA ===
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(1.2, 0, 0);

    // 1. Hueso del brazo superior (Shoulder to Elbow)
    const armGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.8, 6);
    const boneMat = new THREE.MeshBasicMaterial({ color: boneColor });
    const armMesh = new THREE.Mesh(armGeo, boneMat);
    armMesh.position.set(1.1, 1.1, 0);
    armMesh.rotation.z = -Math.PI / 4;
    leftShoulder.add(armMesh);

    // 2. Articulación del codo (Elbow Group)
    const leftElbow = new THREE.Group();
    leftElbow.position.set(2.1, 2.1, 0);

    // Garra/Espolón característico superior de dragón estilo Lunar
    const clawGeo = new THREE.ConeGeometry(0.28, 1.1, 5);
    const clawMat = new THREE.MeshBasicMaterial({ color: clawColor });
    const clawMesh = new THREE.Mesh(clawGeo, clawMat);
    clawMesh.position.set(0, 0.4, 0.1);
    clawMesh.rotation.z = 0.2;
    clawMesh.rotation.x = -0.3;
    leftElbow.add(clawMesh);

    // 3. Costillas/Huesos radiales de dragón
    const ribMat = new THREE.MeshBasicMaterial({ color: boneColor });

    // Costilla 1 (Superior/Larga)
    const rib1Geo = new THREE.CylinderGeometry(0.14, 0.22, 4.6, 5);
    const rib1 = new THREE.Mesh(rib1Geo, ribMat);
    rib1.position.set(2.2, -0.6, 0);
    rib1.rotation.z = -0.65;
    leftElbow.add(rib1);

    // Costilla 2 (Central)
    const rib2Geo = new THREE.CylinderGeometry(0.12, 0.2, 4.4, 5);
    const rib2 = new THREE.Mesh(rib2Geo, ribMat);
    rib2.position.set(1.1, -1.8, 0);
    rib2.rotation.z = -0.3;
    leftElbow.add(rib2);

    // Costilla 3 (Inferior)
    const rib3Geo = new THREE.CylinderGeometry(0.1, 0.18, 3.4, 5);
    const rib3 = new THREE.Mesh(rib3Geo, ribMat);
    rib3.position.set(0.3, -1.4, 0);
    rib3.rotation.z = 0.05;
    leftElbow.add(rib3);

    // 4. Membrana curvada festoneada
    const membraneLeft = this.createDragonWingMembrane(true, membraneColor);
    leftElbow.add(membraneLeft);

    leftShoulder.add(leftElbow);

    // === ALA DERECHA (Simétrica) ===
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(-1.2, 0, 0);

    const armMeshR = new THREE.Mesh(armGeo, boneMat);
    armMeshR.position.set(-1.1, 1.1, 0);
    armMeshR.rotation.z = Math.PI / 4;
    rightShoulder.add(armMeshR);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(-2.1, 2.1, 0);

    const clawMeshR = new THREE.Mesh(clawGeo, clawMat);
    clawMeshR.position.set(0, 0.4, 0.1);
    clawMeshR.rotation.z = -0.2;
    clawMeshR.rotation.x = -0.3;
    rightElbow.add(clawMeshR);

    const rib1R = new THREE.Mesh(rib1Geo, ribMat);
    rib1R.position.set(-2.2, -0.6, 0);
    rib1R.rotation.z = 0.65;
    rightElbow.add(rib1R);

    const rib2R = new THREE.Mesh(rib2Geo, ribMat);
    rib2R.position.set(-1.1, -1.8, 0);
    rib2R.rotation.z = 0.3;
    rightElbow.add(rib2R);

    const rib3R = new THREE.Mesh(rib3Geo, ribMat);
    rib3R.position.set(-0.3, -1.4, 0);
    rib3R.rotation.z = -0.05;
    rightElbow.add(rib3R);

    const membraneRight = this.createDragonWingMembrane(false, membraneColor);
    rightElbow.add(membraneRight);

    rightShoulder.add(rightElbow);

    wingsGroup.add(leftShoulder);
    wingsGroup.add(rightShoulder);

    body.add(wingsGroup);
    this.attachedObjects.push(wingsGroup);
    this.wingLeft = leftShoulder;
    this.wingRight = rightShoulder;
    this.wingLeftTip = leftElbow;
    this.wingRightTip = rightElbow;
  }

  private attachHat(head: THREE.Object3D, cosmetic: ShopCosmetic) {
    const hatGroup = new THREE.Group();

    if (cosmetic.model_type === 'halo' || cosmetic.id.includes('halo')) {
      // Halo Sagrado Flotante
      const torusGeo = new THREE.TorusGeometry(3.5, 0.4, 8, 24);
      const torusMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const torusMesh = new THREE.Mesh(torusGeo, torusMat);
      torusMesh.rotation.x = Math.PI / 2;
      torusMesh.position.set(0, 8.5, 0);
      hatGroup.add(torusMesh);
      this.haloMesh = torusMesh;
    } else if (cosmetic.model_type === 'catears' || cosmetic.id.includes('cat')) {
      // Orejas de Gato Neko 3D
      const earGeo = new THREE.ConeGeometry(1.4, 2.5, 4);
      const isBlack = cosmetic.id.includes('black');
      const earMat = new THREE.MeshBasicMaterial({ color: isBlack ? 0x111111 : 0xf472b6 });

      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(2.8, 5, 0);
      earL.rotation.z = -0.2;

      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(-2.8, 5, 0);
      earR.rotation.z = 0.2;

      hatGroup.add(earL);
      hatGroup.add(earR);
    } else if (cosmetic.model_type === 'horns' || cosmetic.id.includes('horn')) {
      // Cuernos de Demonio Carmesí 3D
      const hornGeo = new THREE.ConeGeometry(1.2, 3.5, 4);
      const hornMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });

      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(2.2, 5.2, 2);
      hornL.rotation.x = -0.4;
      hornL.rotation.z = -0.3;

      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(-2.2, 5.2, 2);
      hornR.rotation.x = -0.4;
      hornR.rotation.z = 0.3;

      hatGroup.add(hornL);
      hatGroup.add(hornR);
    } else {
      // Corona Imperial de Oro / Obsidiana
      const isObsidian = cosmetic.id.includes('rafa') || cosmetic.id.includes('obsidian');
      const crownBaseGeo = new THREE.CylinderGeometry(4.3, 4.3, 1.2, 8, 1, true);
      const crownMat = new THREE.MeshBasicMaterial({
        color: isObsidian ? 0x1e1b4b : 0xf59e0b,
        side: THREE.DoubleSide
      });
      const baseMesh = new THREE.Mesh(crownBaseGeo, crownMat);
      baseMesh.position.set(0, 4.6, 0);
      hatGroup.add(baseMesh);

      // Puntas de la corona
      for (let i = 0; i < 4; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.8, 1.6, 4);
        const gemColor = isObsidian ? 0x10b981 : 0xef4444;
        const spikeMat = new THREE.MeshBasicMaterial({ color: gemColor });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = (i * Math.PI) / 2;
        spike.position.set(Math.cos(angle) * 4.2, 5.8, Math.sin(angle) * 4.2);
        hatGroup.add(spike);
      }
    }

    head.add(hatGroup);
    this.attachedObjects.push(hatGroup);
  }

  private attachBandana(head: THREE.Object3D, cosmetic: ShopCosmetic) {
    const bandanaGroup = new THREE.Group();

    if (cosmetic.model_type === 'visor' || cosmetic.id.includes('visor')) {
      // Visor Cyber HUD
      const visorGeo = new THREE.BoxGeometry(7.5, 1.8, 0.4);
      const visorMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.8
      });
      const visorMesh = new THREE.Mesh(visorGeo, visorMat);
      visorMesh.position.set(0, 0.5, 4.2);
      bandanaGroup.add(visorMesh);
    } else if (cosmetic.model_type === 'glasses' || cosmetic.id.includes('glasses')) {
      // Gafas Thug Life Pixel
      const glassGeo = new THREE.BoxGeometry(7.2, 1.4, 0.3);
      const glassMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, 0.5, 4.2);
      bandanaGroup.add(glassMesh);
    } else {
      // Bandana Ninja / Máscara Facial
      const isRed = cosmetic.id.includes('oni');
      const maskGeo = new THREE.BoxGeometry(8.3, 3.2, 8.3);
      const maskMat = new THREE.MeshBasicMaterial({
        color: isRed ? 0x991b1b : 0x18181b
      });
      const maskMesh = new THREE.Mesh(maskGeo, maskMat);
      maskMesh.position.set(0, -2.4, 0);
      bandanaGroup.add(maskMesh);
    }

    head.add(bandanaGroup);
    this.attachedObjects.push(bandanaGroup);
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearAllCosmetics();
  }
}
