import { Component, Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Grid, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { reduceMotion } from '../../three/scene-utils.js';
import { applyStructureOverrides } from './plantStructureOverrides.js';
import { fitPerspectiveObject } from './cameraFit.js';

const MODEL_SRC = '/models/iona-tesis-3d.glb';
useGLTF.preload(MODEL_SRC);

const CAMERA_DURATION = reduceMotion ? 0.01 : 0.8;
const CAMERA_EASE = 'power2.inOut';

const SHADOW_BAKE_INTERVAL = 1 / 12;

const CAMERA_FOV = 35;

const OVERVIEW_DIR = new THREE.Vector3(1, 0.8, 1).normalize();

const FOCUS_DIR = new THREE.Vector3(0.65, 0.42, 0.75).normalize();

const HOVER_LIFT = 0.18;
const HOVER_DURATION = reduceMotion ? 0.01 : 0.35;
const HOVER_EASE = 'power2.out';
const HOVER_WORM_COLOR_A = '#78dc77';
const HOVER_WORM_COLOR_B = '#c0d8c4';

const plantData = {
  digester: {
    title: 'Çürütücü',
    description: 'Organik atıkların metan gazına dönüştüğü mezofilik reaktör merkezi.',
    photo: '/images/equipment/digester-exterior.jpg',
    subComponents: [
      {
        name: 'Tabliye ve Perde Karıştırıcıları',
        spec: '15 kW, 320 RPM',
        description: 'Reaktör içindeki biyokütlenin homojen dağılımını sağlayan, kabuk ve sedimentasyon oluşumunu önleyen çift katmanlı karıştırma sistemi.',
        specs: [
          'Tabliye (Deck) Karıştırıcıları: Armatech Twin',
          'Perde (Wall) Karıştırıcıları: Armatech Evoplus'
        ],
        photo: '/images/equipment/digester-mixer.jpg'
      },
      {
        name: 'Isıtma Eşanjörü',
        spec: 'Paslanmaz Çelik Borulu',
        description: 'Reaktör iç sıcaklığını bakteri popülasyonu için gerekli mezofilik aralıkta stabil tutan kapalı devre ısıtma sistemi.',
        specs: [
          'Paslanmaz çelik (AISI 316) borulu eşanjör',
          'Çalışma Sıcaklığı: 38°C – 42°C',
          'Kojenerasyon atık ısısıyla beslenir',
          'Duvar içi gömülü spiral boru yerleşimi'
        ],
        photo: '/images/equipment/digester-heat-exchanger.jpg'
      },
      {
        name: 'Enstrümantasyon ve Sensörler',
        spec: 'Sürekli Proses İzleme',
        description: 'Reaktör içindeki kritik proses parametrelerini kesintisiz ölçerek SCADA sistemine aktaran ölçüm ekipmanları.',
        specs: [
          'Radar Seviye Sensörü (Radar Level Sensor)',
          'PT100 Sıcaklık Sensörleri',
          'Biyogaz Basınç Transmitterleri',
          'pH ve Redoks (ORP) Ölçüm Probları'
        ]
      }
    ]
  },
  engine_room: {
    title: 'Kojenerasyon Odası',
    description: 'Üretilen biyogazın elektrik ve ısı enerjisine dönüştürüldüğü kojenerasyon ünitesi.',
    photo: '/images/equipment/engine-room.jpg',
    subComponents: [
      {
        name: 'Gaz Motoru (V12)',
        spec: '1.2 MW Elektriksel Güç',
        description: 'Üretilen biyogazı yüksek verimle elektrik enerjisine dönüştüren, endüstriyel içten yanmalı kojenerasyon motoru.',
        specs: [
          'Müşteri talebine göre Jenbacher, MWM veya Caterpillar biyogaz motor entegrasyonu',
          'Elektriksel Verim: >%42',
          'Otomatik yük takibi (load-following) kontrolü',
          'Gerçek zamanlı emisyon izleme (NOx / CO)'
        ],
        photo: '/images/equipment/engine-room.jpg'
      },
      {
        name: 'Egzoz Isı Geri Kazanımı',
        spec: '85°C Su Çıkışı',
        description: 'Motordan çıkan yüksek sıcaklıktaki egzoz gazından enerji geri kazanan ısı eşanjör ünitesi.',
        specs: [
          'Egzoz gazı / su plakalı eşanjör',
          'Çıkış Suyu Sıcaklığı: ~85°C',
          'Reaktör ısıtma devresine entegre',
          'Otomatik bypass ve aşırı ısınma koruması'
        ],
        photo: '/images/equipment/engine-room-heat-recovery.jpg'
      }
    ]
  },
  pump_room: {
    title: 'Pompa Odası',
    description: 'Tesis içi substrat ve atık transferinin yönetildiği hidrolik merkez.',
    photo: '/images/equipment/pump-room.jpg',
    subComponents: [
      {
        name: 'Loblu Pompa (Rotary Lobe)',
        spec: 'Yüksek Viskozite Uyumlu, 80 m³/h',
        description: 'Katı madde oranı yüksek çamurun tesis içinde kesintisiz, tıkanmadan transferini sağlayan pozitif deplasmanlı pompa.',
        specs: [
          'Marka Referansı: Vogelsang / Börger tipi loblu pompa',
          'Kapasite: 80 m³/h',
          'Değiştirilebilir aşınma plakaları (wear plate)',
          'Kuru çalışmaya karşı mekanik salmastra koruması'
        ],
        photo: '/images/equipment/pump-room-lobe-pump.jpg'
      },
      {
        name: 'Maseratör (Parçalayıcı)',
        spec: 'Çift Şaftlı Bıçak',
        description: 'Pompa ve boru hattına zarar verebilecek lif, plastik ve sert yabancı maddeleri parçalayan öğütme ünitesi.',
        specs: [
          'Çift şaftlı, karşılıklı dönen kesici bıçak sistemi',
          'Sertleştirilmiş çelik (hardened steel) bıçak malzemesi',
          'Hat üzerine (in-line) flanşlı montaj',
          'Aşırı yük algılama ve otomatik ters yön (reverse) fonksiyonu'
        ],
        photo: '/images/equipment/pump-room-macerator.jpg'
      }
    ]
  },
  scada_room: {
    title: 'SCADA Kontrol Odası',
    description: 'Tesisin tüm otomasyon, ölçüm ve güvenlik verilerinin anlık olarak izlendiği beyin.',
    photo: '/images/equipment/scada-room.jpg',
    subComponents: [
      {
        name: 'Biyogaz Analizörü',
        spec: 'Sürekli CH₄, H₂S, O₂ Ölçümü',
        description: 'Üretilen gazın kalitesini saniye saniye analiz ederek gaz kalitesini SCADA sistemine raporlayan ölçüm cihazı.',
        specs: [
          'Ölçülen Parametreler: CH₄, CO₂, O₂, H₂S',
          'Numune alma hattı (sample line) ile sürekli analiz',
          'Yüksek H₂S alarm eşiği bildirimi',
          '4-20mA / Modbus çıkışlı PLC entegrasyonu'
        ],
        photo: '/images/equipment/scada-gas-analyzer.jpg'
      },
      {
        name: 'Ana PLC Panosu',
        spec: 'Yedekli Sistem Otomasyonu',
        description: 'Tesisteki tüm motor, valf ve sensörlerin algoritmik kontrolünü sağlayan merkezi otomasyon ve kumanda panosu.',
        specs: [
          'Endüstriyel PLC altyapısı (Siemens S7 / Allen-Bradley uyumlu)',
          'Uzaktan izleme ve SCADA arayüzü',
          'Yedekli güç kaynağı (redundant PSU)',
          'Alarm ve olay kayıt (event log) sistemi'
        ],
        photo: '/images/equipment/scada-plc-panel.jpg'
      }
    ]
  },
  feed_pool: {
    title: 'Besleme Havuzu',
    description: 'Tesise gelen günlük taze atıkların homojenize edilip sisteme hazırlandığı ön kabul ünitesi.',
    photo: '/images/equipment/feed-pool.jpg',
    subComponents: [
      {
        name: 'Dalgıç Karıştırıcı',
        spec: '22 kW',
        description: 'Farklı atık türlerini birbirine harmanlayarak çürütücüye standart kalitede besin hazırlayan karıştırma ünitesi.',
        specs: [
          'IONA Marka Dalgıç Karıştırıcılar',
          'Güç: 22 kW',
          'Paslanmaz çelik pervane',
          'Seviye sensörüyle otomatik çalışma senkronizasyonu'
        ],
        photo: '/images/equipment/feed-pool.jpg',
        video: '/videos/digester-mixer.mp4'
      }
    ]
  },
  
  biogas_mixer: {
    title: 'Ağır Hizmet Dalgıç Karıştırıcı & Homojenizatör',
    description: 'Yüksek Verimli Hidrodinamik Biyogaz Mikseri',
    photo: '/images/equipment/digester-mixer.jpg',
    specs: [
      '⚙️ Motor Gücü: 15 - 22 kW (IE4 Süper Premium Verim)',
      '🌪️ Pervane Tipi: Özel Açılı Çift/Üç Kanatlı Helisel Bıçak (Kırmızı Koruma Kaplamalı)',
      '🛡️ Malzeme Dayanımı: AISI 304 / 316 Paslanmaz Çelik, Agresif pH ve H2S Koruması',
      '🎯 Fonksiyon: Yüzey kabuklaşmasını önleme, taban çökeltisi giderme ve homojen sıcaklık dağılımı.'
    ],
    subComponents: [],
    returnTo: 'digester'
  }
};

function findStructureNode(node, plantRoot) {
  while (node && node.parent !== plantRoot) node = node.parent;
  return node;
}

function findMixerNode(node, plantRoot) {
  while (node && node.parent !== plantRoot) {
    if (node.name === 'biogas_mixer') return node;
    node = node.parent;
  }
  return null;
}

function meshBaseName(name) {
  return name.replace(/_\d+$/, '');
}

function attachHoverWormShader(material) {
  const uniforms = {
    uTime: { value: 0 },
    uHoverActive: { value: 0 },
    uHoverColorA: { value: new THREE.Color(HOVER_WORM_COLOR_A) },
    uHoverColorB: { value: new THREE.Color(HOVER_WORM_COLOR_B) },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoverPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoverPos = transformed;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHoverPos;
        uniform float uTime;
        uniform float uHoverActive;
        uniform vec3 uHoverColorA;
        uniform vec3 uHoverColorB;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if ( uHoverActive > 0.0 ) {
          vec3 hoverViewDir = normalize( vViewPosition );
          float hoverRim = pow( 1.0 - clamp( dot( normalize( vNormal ), hoverViewDir ), 0.0, 1.0 ), 2.0 );
          float hoverFlow = sin( vHoverPos.x * 0.35 + vHoverPos.y * 0.55 + vHoverPos.z * 0.35 - uTime * 2.2 );
          float hoverBand = smoothstep( 0.2, 1.0, hoverFlow );
          float hoverMix = sin( uTime * 1.1 + vHoverPos.y * 0.4 ) * 0.5 + 0.5;
          vec3 hoverWormColor = mix( uHoverColorA, uHoverColorB, hoverMix );
          totalEmissiveRadiance += hoverWormColor * hoverRim * hoverBand * uHoverActive * 0.45;
        }`
      );
  };

  return uniforms;
}

function attachFlowPulseShader(material, color) {
  const uniforms = {
    uFlowTime: { value: 0 },
    uFlowActive: { value: 0 },
    uFlowColor: { value: new THREE.Color(color) },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlowPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlowPos = transformed;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFlowPos;
        uniform float uFlowTime;
        uniform float uFlowActive;
        uniform vec3 uFlowColor;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if ( uFlowActive > 0.0 ) {
          float flowAxis = ( vFlowPos.x + vFlowPos.y + vFlowPos.z ) * 0.85;
          float flowDash = fract( flowAxis - uFlowTime * 1.6 );
          float flowBand = smoothstep( 0.0, 0.06, flowDash ) * ( 1.0 - smoothstep( 0.3, 0.4, flowDash ) );
          float flowPulse = 0.7 + sin( uFlowTime * 2.4 ) * 0.3;
          totalEmissiveRadiance += uFlowColor * flowBand * flowPulse * uFlowActive * 2.4;
        }`
      );
  };

  return uniforms;
}

const DIGESTER_WALL_MESH_NAME = 'tank_wall';
const DIGESTER_WALL_STRIPE_REPEAT_X = 200;

function createDigesterWallAlbedoTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(214, 214, 210)';
  ctx.fillRect(0, 0, size / 2, size);
  ctx.fillStyle = 'rgb(196, 196, 192)';
  ctx.fillRect(size / 2, 0, size / 2, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(DIGESTER_WALL_STRIPE_REPEAT_X, 1);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const FOUNDATION_MESH_NAMES = new Set(['foundation_pad', 'wall_plinth', 'slab', 'pool_pad']);

const DIGESTER_LATTICE_MESH_NAMES = new Set(['wall_rib', 'wall_band']);

const DIGESTER_WALKWAY_FENCE_MESH_NAMES = new Set(['rail_post', 'platform_rail', 'platform_post', 'top_ring']);

const DIGESTER_DOME_MESH_NAMES = new Set(['gas_dome', 'dome_seam']);

const DIGESTER_PIPE_MESH_NAMES = new Set([
  'feed_nozzle',
  'feed_nozzle_flange',
  'heat_inlet_nozzle',
  'heat_inlet_nozzle_flange',
  'heat_return_nozzle',
  'heat_return_nozzle_flange',
  'pressure_relief_valve',
  'relief_cap',
]);

const DIGESTER_GRATING_MESH_NAMES = new Set(['dome_walkway', 'walkway_inner_kerb', 'top_platform', 'stair_tread']);

const DIGESTER_RAILING_MESH_NAMES = new Set(['walkway_rail', 'walkway_midrail', 'walkway_post', 'stair_handrail_1', 'stair_handrail_2']);

const DIGESTER_MIXER_MESH_NAMES = new Set([
  'side_mixer_collar', 'side_mixer_housing', 'side_mixer_shaft',
  'side_mixer_hub', 'side_mixer_blade', 'side_mixer_beacon'
]);

const BUILDING_MAST_MESH_NAMES = new Set(['radio_mast']);
const BUILDING_STACK_MESH_NAMES = new Set(['exhaust_stack', 'exhaust_cap']);
const BUILDING_MECH_CASING_MESH_NAMES = new Set(['roof_ac_unit', 'roof_radiator', 'radiator_fan', 'roof_vent']);
const BUILDING_PIPE_MESH_NAMES = new Set(['pump_suction', 'pump_discharge', 'discharge_header', 'header_riser']);

const BUILDING_ROOF_MESH_NAMES = new Set(['roof', 'roof_fascia']);
const BUILDING_WINDOW_MESH_NAMES = new Set(['window']);
const BUILDING_DOOR_MESH_NAMES = new Set(['door']);
const BUILDING_DOOR_HANDLE_MESH_NAMES = new Set(['door_handle']);

const FEED_POOL_HARDWARE_MESH_NAMES = new Set([
  'pool_mixer_shaft',
  'pool_bridge',
  'pool_mixer_drive',
  'pool_mixer_blade',
  'pool_rim',
]);

function createGratingTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(224, 224, 221)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgb(55, 56, 58)';
  ctx.lineWidth = 7;
  const step = 32;
  for (let offset = -size; offset < size * 2; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const BUILDING_WALL_MESH_NAMES = new Set(['wall_front', 'wall_back', 'wall_right', 'wall_left']);

const BUILDING_STRUCTURAL_STEEL_MESH_NAMES = new Set(['canopy_post']);

const ENGINE_ROOM_WALL_MESH_NAMES = new Set(['container_wall']);
const ENGINE_ROOM_FRAME_MESH_NAMES = new Set(['container_frame']);
const ENGINE_ROOM_STACK_MESH_NAMES = new Set(['container_stack']);
const ENGINE_ROOM_FAN_MESH_NAMES = new Set(['container_fan']);

const ENGINE_ROOM_HAZARD_MESH_NAMES = new Set(['container_hazard_stripe']);

const SITE_PIPING_FEED_MESH_NAMES = new Set([
  'feed_from_pool', 'pool_flange', 'feed_to_digester', 'digester_feed_flange',
]);
const SITE_PIPING_GAS_MESH_NAMES = new Set([
  'gas_main', 'gas_wall_flange', 'gas_elbow', 'gas_header', 'gas_train',
  'gas_into_chp', 'gas_wall_flange_chp',
]);
const SITE_PIPING_POWER_MESH_NAMES = new Set([
  'cable_tray_main', 'cable_tray_post', 'cable_drop_chp', 'cable_to_pumps', 'scada_junction_box',
]);

const FLOW_FEED_COLOR = HOVER_WORM_COLOR_A;
const FLOW_GAS_COLOR = '#ffb020';
const FLOW_POWER_COLOR = '#4dd9e8';

function createSandwichPanelBumpTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const seamFraction = 0.15;
  const seamStart = size * (1 - seamFraction);
  ctx.fillStyle = 'rgb(220, 220, 220)';
  ctx.fillRect(0, 0, size, seamStart);
  ctx.fillStyle = 'rgb(40, 40, 40)';
  ctx.fillRect(0, seamStart, size, size - seamStart);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);
  
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const POOL_WALL_MESH_NAME = 'pool_wall';

const FEED_PIPE_GAP_RADIUS = 0.3;
const FEED_PIPE_GAP_START_Z = -1.8; // slight overlap past feed_to_digester's measured ≈-1.54 end
const FEED_PIPE_GAP_END_Z = 5.5; // slight overlap past feed_from_pool's measured 5.2 end
const FEED_PIPE_GAP_X = 18.05; // midpoint of the two measured stub centers (18.0 / 18.10)
const FEED_PIPE_GAP_Y = 2.82;

function FeedPipeGapFill() {
  const length = FEED_PIPE_GAP_END_Z - FEED_PIPE_GAP_START_Z;
  const centerZ = (FEED_PIPE_GAP_START_Z + FEED_PIPE_GAP_END_Z) / 2;
  return (
    <mesh
      position={[FEED_PIPE_GAP_X, FEED_PIPE_GAP_Y, centerZ]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
      raycast={() => null}
    >
      <cylinderGeometry args={[FEED_PIPE_GAP_RADIUS, FEED_PIPE_GAP_RADIUS, length, 20]} />
      <meshStandardMaterial color="#c0c0c0" roughness={1} metalness={0.1} />
    </mesh>
  );
}

const Model = memo(function Model({ plantRootRef, onReady, onSelect, onReset, selected, flowActive }) {
  const { scene: cachedScene } = useGLTF(MODEL_SRC);
  const scene = useMemo(() => new THREE.Group(), []);
  
  const materialsRef = useRef(new Map());
  
  const baseYRef = useRef(new Map());
  const hoveredNameRef = useRef(null);
  
  const hoverUniformsRef = useRef(new Map());
  
  const namedMeshMaterialsRef = useRef(new Map());
  
  const digesterMixersRef = useRef({ propellerHubs: [], beacons: [] });
  
  const tankWallMeshesRef = useRef([]);
  
  const flowUniformsRef = useRef([]);

  const canvasEl = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const reset = () => {
      hoveredNameRef.current = null;
      canvasEl.style.cursor = '';
    };
    canvasEl.addEventListener('pointerleave', reset);
    return () => {
      canvasEl.removeEventListener('pointerleave', reset);
      canvasEl.style.cursor = '';
    };
  }, [canvasEl]);

  useLayoutEffect(() => {
    // Own all mutable resources; the loader cache is immutable.
    const owned = cachedScene.clone(true);
    const resources = new Set();
    const sourceTextures = new Set();
    const geometries = new Map();
    const sourceMaterials = new Map();
    cachedScene.traverse(node => {
      (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach(material => {
        Object.values(material).forEach(value => { if (value?.isTexture) sourceTextures.add(value); });
      });
    });
    owned.traverse(node => {
      if (!node.isMesh) return;
      if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
      node.geometry = geometries.get(node.geometry);
      resources.add(node.geometry);
      const copy = material => {
        if (!sourceMaterials.has(material)) sourceMaterials.set(material, material.clone());
        const clone = sourceMaterials.get(material); resources.add(clone); return clone;
      };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    });
    scene.add(owned);
    const plantRoot = owned.getObjectByName('biogas_plant') ?? owned;
    plantRootRef.current = plantRoot;

    const { propellerHubs, beacons } = applyStructureOverrides(plantRoot);
    digesterMixersRef.current = { propellerHubs, beacons };

    const materials = new Map();
    const baseYs = new Map();
    const hoverUniforms = new Map();
    const namedMeshMaterials = new Map();
    
    const tankWallMeshes = [];
    
    const flowUniforms = [];

    const sandwichPanelTexture = createSandwichPanelBumpTexture();
    plantRoot.children.forEach((structure) => {

      const material = new THREE.MeshPhysicalMaterial({
        color: '#f8fafc',
        roughness: 1.0,
        metalness: 0.0,
        clearcoat: 0,
        clearcoatRoughness: 0,
      });
      const uniformsList = [attachHoverWormShader(material)];
      const structureNamedMaterials = new Map();

      if (structure.name === 'digester') {
        
        const wallMaterial = new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          metalness: 0.0,
          roughness: 1.0,
          map: createDigesterWallAlbedoTexture(),
          
          depthWrite: true,
          depthTest: true,
        });
        wallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(wallMaterial));
        structureNamedMaterials.set(DIGESTER_WALL_MESH_NAME, wallMaterial);

        const domeMaterial = new THREE.MeshPhysicalMaterial({
          color: '#e2e8f0',
          metalness: 0.7,
          roughness: 0.4,
          clearcoat: 0.2,
          clearcoatRoughness: 0.15,
          anisotropy: 0.55,
          anisotropyRotation: Math.PI / 2,
          depthWrite: true,
          depthTest: true,
        });
        domeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(domeMaterial));
        DIGESTER_DOME_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, domeMaterial));

        const pipeMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        pipeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(pipeMaterial));
        DIGESTER_PIPE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, pipeMaterial));

        const railingMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        railingMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(railingMaterial));
        DIGESTER_RAILING_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, railingMaterial));

        const gratingMaterial = new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          metalness: 0,
          roughness: 1.0,
        });
        gratingMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(gratingMaterial));
        DIGESTER_GRATING_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, gratingMaterial));
      }

      if (['pump_room', 'engine_room', 'scada_room'].includes(structure.name)) {
        
        const sandwichPanelMaterial = new THREE.MeshStandardMaterial({
          color: '#94a3b8',
          metalness: 0.2,
          roughness: 0.6,
          bumpMap: sandwichPanelTexture,
          bumpScale: 0.5,
        });
        sandwichPanelMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(sandwichPanelMaterial));
        BUILDING_WALL_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, sandwichPanelMaterial));

        const roofMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        roofMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(roofMaterial));
        BUILDING_ROOF_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, roofMaterial));

        const windowMaterial = new THREE.MeshPhysicalMaterial({
          color: '#1e2b33',
          metalness: 0.2,
          roughness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
        });
        windowMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(windowMaterial));
        BUILDING_WINDOW_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, windowMaterial));

        const doorMaterial = new THREE.MeshStandardMaterial({
          color: '#8b8f93',
          metalness: 0.25,
          roughness: 0.55,
        });
        doorMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(doorMaterial));
        BUILDING_DOOR_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, doorMaterial));

        const doorHandleMaterial = new THREE.MeshStandardMaterial({
          color: '#c7c9cc',
          metalness: 0.85,
          roughness: 0.25,
        });
        doorHandleMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(doorHandleMaterial));
        BUILDING_DOOR_HANDLE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, doorHandleMaterial));

        const mastMaterial = new THREE.MeshStandardMaterial({
          color: '#9a9d9f',
          metalness: 0.75,
          roughness: 0.3,
        });
        mastMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(mastMaterial));
        BUILDING_MAST_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, mastMaterial));

        const stackMaterial = new THREE.MeshStandardMaterial({
          color: '#7e8184',
          metalness: 0.75,
          roughness: 0.3,
        });
        stackMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(stackMaterial));
        BUILDING_STACK_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, stackMaterial));

        const grilleTexture = createGratingTexture();
        grilleTexture.repeat.set(3, 3);
        grilleTexture.needsUpdate = true;
        const mechCasingMaterial = new THREE.MeshStandardMaterial({
          
          color: '#a0a3a5',
          metalness: 0.7,
          roughness: 0.3,
          map: grilleTexture,
          bumpMap: grilleTexture,
          bumpScale: 0.2,
        });
        mechCasingMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(mechCasingMaterial));
        BUILDING_MECH_CASING_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, mechCasingMaterial));

        const buildingPipeMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        buildingPipeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(buildingPipeMaterial));
        BUILDING_PIPE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, buildingPipeMaterial));

        const structuralSteelMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        structuralSteelMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(structuralSteelMaterial));
        BUILDING_STRUCTURAL_STEEL_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, structuralSteelMaterial));
      }

      if (structure.name === 'engine_room') {
        
        const wallMaterial = new THREE.MeshStandardMaterial({
          color: '#94a3b8',
          metalness: 0.2,
          roughness: 0.6,
        });
        wallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(wallMaterial));
        ENGINE_ROOM_WALL_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, wallMaterial));

        const frameMaterial = new THREE.MeshStandardMaterial({
          color: '#54585c',
          metalness: 0.35,
          roughness: 0.45,
        });
        frameMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(frameMaterial));
        ENGINE_ROOM_FRAME_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, frameMaterial));

        const stackMaterial = new THREE.MeshStandardMaterial({
          color: '#c7cbce',
          metalness: 0.6,
          roughness: 0.3,
        });
        stackMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(stackMaterial));
        ENGINE_ROOM_STACK_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, stackMaterial));

        const fanMaterial = new THREE.MeshStandardMaterial({
          color: '#3a3d40',
          metalness: 0.5,
          roughness: 0.4,
        });
        fanMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(fanMaterial));
        ENGINE_ROOM_FAN_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, fanMaterial));

        const hazardMaterial = new THREE.MeshStandardMaterial({
          color: '#f4c430',
          metalness: 0.1,
          roughness: 0.6,
        });
        hazardMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(hazardMaterial));
        ENGINE_ROOM_HAZARD_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, hazardMaterial));
      }

      if (structure.name === 'feed_pool') {
        
        const poolWallMaterial = new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          metalness: 0.0,
          roughness: 1.0,
        });
        poolWallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(poolWallMaterial));
        structureNamedMaterials.set(POOL_WALL_MESH_NAME, poolWallMaterial);

        const poolHardwareMaterial = new THREE.MeshStandardMaterial({
          color: '#9a9c9e',
          metalness: 0.7,
          roughness: 0.4,
        });
        poolHardwareMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(poolHardwareMaterial));
        FEED_POOL_HARDWARE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, poolHardwareMaterial));
      }

      if (structure.name === 'site_piping') {
        
        const feedMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b', metalness: 0.1, roughness: 0.8,
        });
        feedMaterial.needsUpdate = true;
        flowUniforms.push(attachFlowPulseShader(feedMaterial, FLOW_FEED_COLOR));
        SITE_PIPING_FEED_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, feedMaterial));

        const gasMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b', metalness: 0.1, roughness: 0.8,
        });
        gasMaterial.needsUpdate = true;
        flowUniforms.push(attachFlowPulseShader(gasMaterial, FLOW_GAS_COLOR));
        SITE_PIPING_GAS_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, gasMaterial));

        const powerMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b', metalness: 0.1, roughness: 0.8,
        });
        powerMaterial.needsUpdate = true;
        flowUniforms.push(attachFlowPulseShader(powerMaterial, FLOW_POWER_COLOR));
        SITE_PIPING_POWER_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, powerMaterial));
      }

      const concreteMaterial = new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        metalness: 0.0,
        roughness: 1.0,
      });
      concreteMaterial.needsUpdate = true;
      uniformsList.push(attachHoverWormShader(concreteMaterial));
      FOUNDATION_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, concreteMaterial));

      hoverUniforms.set(structure.name, uniformsList);
      namedMeshMaterials.set(structure.name, structureNamedMaterials);
      materials.set(structure.name, material);
      baseYs.set(structure.name, structure.position.y);
    });
    materialsRef.current = materials;
    baseYRef.current = baseYs;
    hoverUniformsRef.current = hoverUniforms;
    namedMeshMaterialsRef.current = namedMeshMaterials;
    flowUniformsRef.current = flowUniforms;

    scene.traverse((child) => {
      if (!child.isMesh) return;
      const structure = findStructureNode(child, plantRoot);
      const material = structure && materials.get(structure.name);
      if (!material) return;
      
      const baseName = meshBaseName(child.name);
      
      if (
        structure.name === 'digester' &&
        (DIGESTER_LATTICE_MESH_NAMES.has(baseName) || DIGESTER_WALKWAY_FENCE_MESH_NAMES.has(baseName))
      ) {
        child.visible = false;
        return;
      }
      
      if (structure.name === 'digester' && DIGESTER_MIXER_MESH_NAMES.has(baseName)) {
        return;
      }
      
      const override = namedMeshMaterials.get(structure.name)?.get(baseName);
      child.material = override ?? material;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
      
      if (structure.name === 'digester' && baseName === DIGESTER_WALL_MESH_NAME) {
        tankWallMeshes.push(child);
      }
    });
    tankWallMeshesRef.current = tankWallMeshes;

    const collectMaterial = material => {
      resources.add(material);
      Object.values(material).forEach(value => { if (value?.isTexture && !sourceTextures.has(value)) resources.add(value); });
    };
    owned.traverse(node => {
      if (node.geometry) resources.add(node.geometry);
      (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach(collectMaterial);
    });
    materials.forEach(collectMaterial);
    namedMeshMaterials.forEach(map => map.forEach(collectMaterial));
    resources.add(sandwichPanelTexture);
    onReady(plantRoot);
    return () => {
      owned.traverse(node => gsap.killTweensOf(node.position));
      hoverUniforms.forEach(list => list.forEach(u => gsap.killTweensOf(u.uHoverActive)));
      flowUniforms.forEach(u => gsap.killTweensOf(u.uFlowActive));
      resources.forEach(resource => { gsap.killTweensOf(resource); resource.dispose?.(); });
      scene.remove(owned);
      if (plantRootRef.current === plantRoot) plantRootRef.current = null;
    };
  }, [cachedScene, scene, plantRootRef, onReady]);

  const effectiveSelectedName = selected?.name === 'biogas_mixer' ? 'digester' : selected?.name;

  useEffect(() => {
    materialsRef.current.forEach((material, name) => {
      const isActive = Boolean(selected) && name === effectiveSelectedName;
      material.transparent = isActive;
      material.opacity = isActive ? 0.25 : 1;
      material.depthWrite = !isActive;
      material.needsUpdate = true;
    });
    
    namedMeshMaterialsRef.current.forEach((structureNamedMaterials, structureName) => {
      const isActive = Boolean(selected) && structureName === effectiveSelectedName;
      structureNamedMaterials.forEach((material) => {
        material.transparent = isActive;
        material.opacity = isActive ? 0.25 : 1;
      material.depthWrite = !isActive;
        material.needsUpdate = true;
      });
    });
    
    const digesterActive = effectiveSelectedName === 'digester';
    tankWallMeshesRef.current.forEach((mesh) => {
      mesh.raycast = digesterActive ? () => {} : THREE.Mesh.prototype.raycast;
    });
  }, [selected]);

  const animateMixerHover = useCallback((isHovering) => {
    const hub = digesterMixersRef.current.propellerHubs[0];
    const blade = hub?.children.find((c) => c.name === 'side_mixer_blade');
    const material = blade?.material;
    if (!material) return;
    
    gsap.to(material, {
      emissiveIntensity: isHovering ? 0.95 : 0.5,
      duration: HOVER_DURATION,
      ease: HOVER_EASE,
      onUpdate: invalidate,
    });
  }, []);

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      
      if (selected?.name === 'digester') {
        const mixer = findMixerNode(event.object, plantRoot);
        if (mixer) {
          onSelect(mixer);
          return;
        }
      }
      const node = findStructureNode(event.object, plantRoot);
      if (node && Object.prototype.hasOwnProperty.call(plantData, node.name)) {
        onSelect(node);
      } else {
        onReset();
      }
    },
    [plantRootRef, onSelect, onReset, selected]
  );

  const animateHover = useCallback((node, isHovering) => {
    const uniformsList = hoverUniformsRef.current.get(node.name);
    if (uniformsList) {
      uniformsList.forEach((uniforms) => {
        gsap.to(uniforms.uHoverActive, {
          value: isHovering ? 1 : 0,
          duration: HOVER_DURATION,
          ease: HOVER_EASE,
      onUpdate: invalidate,
        });
      });
    }
    const baseY = baseYRef.current.get(node.name) ?? 0;
    gsap.to(node.position, {
      y: isHovering ? baseY + HOVER_LIFT : baseY,
      duration: HOVER_DURATION,
      ease: HOVER_EASE,
      onUpdate: invalidate,
    });
  }, []);

  const handlePointerOver = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      if (selected?.name === 'digester') {
        const mixer = findMixerNode(event.object, plantRoot);
        if (mixer) {
          if (hoveredNameRef.current !== 'biogas_mixer') {
            hoveredNameRef.current = 'biogas_mixer';
            canvasEl.style.cursor = 'pointer';
            animateMixerHover(true);
          }
          return;
        }
      }
      const node = findStructureNode(event.object, plantRoot);
      if (!node || !Object.prototype.hasOwnProperty.call(plantData, node.name)) return;
      if (hoveredNameRef.current === node.name) return;
      hoveredNameRef.current = node.name;
      canvasEl.style.cursor = 'pointer';
      animateHover(node, true);
    },
    [plantRootRef, animateHover, animateMixerHover, selected, canvasEl]
  );

  const handlePointerOut = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      if (hoveredNameRef.current === 'biogas_mixer') {
        const stillOnMixer = selected?.name === 'digester' && findMixerNode(event.object, plantRoot);
        if (stillOnMixer) return;
        hoveredNameRef.current = null;
        canvasEl.style.cursor = '';
        animateMixerHover(false);
        return;
      }
      const node = findStructureNode(event.object, plantRoot);
      if (!node || !Object.prototype.hasOwnProperty.call(plantData, node.name)) return;
      hoveredNameRef.current = null;
      canvasEl.style.cursor = '';
      animateHover(node, false);
    },
    [plantRootRef, animateHover, animateMixerHover, selected, canvasEl]
  );

  useFrame((state, delta) => {
    const elapsed = reduceMotion ? 0 : state.clock.elapsedTime;
    hoverUniformsRef.current.forEach((uniformsList) => {
      uniformsList.forEach((uniforms) => {
        uniforms.uTime.value = elapsed;
      });
    });
    if (!reduceMotion) {
      digesterMixersRef.current.propellerHubs.forEach((hub) => {
        hub.rotation.z += delta * 1.4;
      });
    }
    digesterMixersRef.current.beacons.forEach((beacon, i) => {
      beacon.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 1.8 + i * 0.7) * 0.35;
    });
    if (!reduceMotion) {
      flowUniformsRef.current.forEach((uniforms) => {
        uniforms.uFlowTime.value = elapsed;
      });
    }
  });

  useEffect(() => {
    flowUniformsRef.current.forEach((uniforms) => {
      gsap.to(uniforms.uFlowActive, {
        value: flowActive ? 1 : 0,
        duration: reduceMotion ? 0.01 : 0.6,
        ease: 'power2.out',
      });
    });
  }, [flowActive]);

  const [mixerHintPos, setMixerHintPos] = useState(null);
  useEffect(() => {
    if (selected?.name !== 'digester') {
      setMixerHintPos(null);
      return;
    }
    const beacon = digesterMixersRef.current.beacons[0];
    if (!beacon) {
      setMixerHintPos(null);
      return;
    }
    setMixerHintPos(beacon.getWorldPosition(new THREE.Vector3()));
  }, [selected]);

  return (
    <>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      {mixerHintPos && (
        <Html position={mixerHintPos} center distanceFactor={8}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-full border border-[#78dc77]/50 bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_0_16px_rgba(120,220,119,0.5)] animate-pulse">
            ⚡ Dalgıç Karıştırıcı
          </div>
        </Html>
      )}
    </>
  );
});

const Rig = memo(function Rig({ plantRootRef, selected, groundY, groundScale, keyLightRef }) {
  const { camera, gl, size, invalidate } = useThree();
  const controlsRef = useRef(null);
  useLayoutEffect(() => {
    const root = plantRootRef.current;
    const controls = controlsRef.current;
    if (!root || !controls || !size.width || !size.height) return;
    root.updateMatrixWorld(true);

    const { position, center } = fitPerspectiveObject(selected ?? root, camera, selected ? FOCUS_DIR : OVERVIEW_DIR, selected ? 1.12 : 1.06);
    camera.far = Math.max(500, position.distanceTo(center) + groundScale * 3);
    camera.updateProjectionMatrix();
    const timeline = gsap.timeline({ onUpdate: () => { controls.update(); invalidate(); } });
    timeline.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    timeline.to(controls.target, { x: center.x, y: center.y, z: center.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    const light = keyLightRef.current;
    if (light) {
      const siteBox = new THREE.Box3().setFromObject(root);
      const siteCenter = siteBox.getCenter(new THREE.Vector3());
      const radius = siteBox.getSize(new THREE.Vector3()).length() * .65;
      light.position.copy(siteCenter).add(new THREE.Vector3(-.7, 1.4, .8).multiplyScalar(radius));
      light.target.position.copy(siteCenter);
      light.target.updateMatrixWorld();
      Object.assign(light.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: .5, far: radius * 5 });
      light.shadow.camera.updateProjectionMatrix();
      gl.shadowMap.needsUpdate = true;
    }
    return () => timeline.kill();
  }, [selected, size.width, size.height, groundScale, groundY, camera, gl, plantRootRef, keyLightRef]);
  const elapsed = useRef(0);
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; }, [gl]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current > SHADOW_BAKE_INTERVAL) { elapsed.current = 0; gl.shadowMap.needsUpdate = true; }
  });
  return <>
    <OrbitControls ref={controlsRef} enableRotate={false} enableZoom={false} enablePan={false} />
    <mesh position={[0, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[groundScale * 3, groundScale * 3]} />
      <shadowMaterial transparent opacity={.17} depthWrite={false} />
    </mesh>
    <Grid position={[0, groundY - .03, 0]} args={[groundScale * 1.4, groundScale * 1.4]}
      fadeDistance={groundScale * 1.3} fadeStrength={2} cellSize={5} cellThickness={.35}
      cellColor="#dddddd" sectionSize={25} sectionThickness={.5} sectionColor="#c8c8c8" />
  </>;
});

function TechSpecs({ items }) {
  return <div className="tech-specs" aria-label="Teknik özellikler">{items.map((item, i) =>
    <div className="tech-spec" key={item}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{item}</span></div>
  )}</div>;
}

function EquipmentImagePlaceholder() {
  return (
    <div className="h-64 w-full shrink-0 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-100 flex flex-col items-center justify-center gap-3 text-gray-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="w-10 h-10"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-label-caps text-label-caps text-gray-400 text-center px-6">
        Gerçek Ekipman Fotoğrafı
      </span>
    </div>
  );
}

function EquipmentMedia({ photo, video }) {
  if (video) {
    return (
      <video
        className="h-64 w-full shrink-0 rounded-2xl object-cover pointer-events-none"
        src={video}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
    );
  }
  if (photo) {
    return (
      <img
        className="h-64 w-full shrink-0 rounded-2xl object-cover"
        src={photo}
        alt=""
      />
    );
  }
  return <EquipmentImagePlaceholder />;
}

function DetailPanel({ structureKey, subIndex, onSelectSub, onBack, onClose, onReturnToParent }) {
  const structure = plantData[structureKey];
  if (!structure) return null;
  const sub = subIndex != null ? structure.subComponents[subIndex] : null;

  return (
    <div className="twin-detail flex flex-col gap-6" role="region" aria-label="Tesis bileşeni detayları" data-lenis-prevent>
      <div className="flex items-start justify-between gap-3">
        {sub ? (
          <button
            type="button"
            onClick={onBack}
            className="font-label-caps text-label-caps text-gray-500 hover:text-gray-800 transition-colors duration-200 inline-flex items-center gap-1.5"
          >
            <span aria-hidden="true" className="text-lg leading-none">&lsaquo;</span> {structure.title}
          </button>
        ) : (
          <span className="font-label-caps text-label-caps text-gray-500">Tesis Bileşeni</span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="shrink-0 -mt-1 -mr-1 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-800 hover:bg-black/5 transition-colors duration-200 leading-none text-2xl"
        >
          &times;
        </button>
      </div>

      {sub ? (
        <div className="flex flex-col gap-6">
          <EquipmentMedia photo={sub.photo} video={sub.video} />
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{sub.name}</h2>
            <p className="text-sm font-bold tracking-wide text-emerald-600">{sub.spec}</p>
          </div>
          <p className="text-base leading-relaxed text-gray-600">{sub.description}</p>
          {sub.specs && sub.specs.length > 0 && (
            <TechSpecs items={sub.specs} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {structure.photo && (
            <img
              className="h-48 w-full shrink-0 rounded-2xl object-cover"
              src={structure.photo}
              alt=""
            />
          )}
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{structure.title}</h2>
          <p className="text-base leading-relaxed text-gray-600">{structure.description}</p>
          {structure.specs && structure.specs.length > 0 && (
            <TechSpecs items={structure.specs} />
          )}
          <div className="flex flex-col gap-3">
            {structure.subComponents.map((component, index) => (
              <button
                key={component.name}
                type="button"
                onClick={() => onSelectSub(index)}
                className="twin-subcomponent"
              >
                <span className="block text-base font-bold text-gray-900">{component.name}</span>
                <span className="block text-sm text-gray-500 mt-0.5">{component.spec}</span>
              </button>
            ))}
          </div>
          {structure.returnTo && onReturnToParent && (
            <button
              type="button"
              onClick={() => onReturnToParent(structure.returnTo)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 font-label-caps text-label-caps py-3 transition-colors duration-200"
            >
              <span aria-hidden="true">↩️</span> Reaktör Görünümüne Dön
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TwinLoading({ onRetry }) {
  
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 text-slate-500">
      <span
        className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#2D9937] animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" role="status">
        Tesis Modeli Yükleniyor
      </span>
      {slow && (
        <button
          type="button"
          onClick={onRetry}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#2D9937] underline underline-offset-4 hover:text-[#1f6f28] transition-colors duration-200"
        >
          Uzun sürüyor — tekrar dene
        </button>
      )}
    </div>
  );
}

class TwinErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[IONA] 3D tesis modeli yüklenemedi:', error);
  }

  componentDidUpdate(prevProps) {
    
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center text-slate-500">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
            3D tesis modeli yüklenemedi
          </span>
          <button
            type="button"
            onClick={this.props.onRetry}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#2D9937] underline underline-offset-4 hover:text-[#1f6f28] transition-colors duration-200"
          >
            Tekrar dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function GltfTwinScene() {
  const [selected, setSelected] = useState(null);
  
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState(null);
  const plantRootRef = useRef(null);
  const keyLightRef = useRef(null);
  const [groundY, setGroundY] = useState(0);
  const [groundScale, setGroundScale] = useState(120);
  const [shadowFar, setShadowFar] = useState(40);
  
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const [flowActive, setFlowActive] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (isMobileViewport) setFlowActive(false);
  }, [isMobileViewport]);

  const handleReady = useCallback((plantRoot) => {
    const box = new THREE.Box3().setFromObject(plantRoot);
    const size = box.getSize(new THREE.Vector3());
    setGroundY(box.min.y - 0.02);
    
    setGroundScale(Math.max(size.x, size.z) * 1.3);
    setShadowFar(Math.max(size.y * 4, 20));
  }, []);

  const handleSelect = useCallback((node) => {
    setSelected(node);
    setSelectedSubIndex(null);
    setCurrentLevel(1);
    setHasInteracted(true);
  }, []);
  const handleReset = useCallback(() => {
    setSelected(null);
    setSelectedSubIndex(null);
    setCurrentLevel(0);
  }, []);
  const handleSelectSub = useCallback((index) => {
    setSelectedSubIndex(index);
    setCurrentLevel(2);
  }, []);
  
  const handleReturnToParent = useCallback(
    (parentName) => {
      const parent = plantRootRef.current?.getObjectByName(parentName);
      if (parent) handleSelect(parent);
    },
    [handleSelect]
  );
  const handleBackToStructure = useCallback(() => {
    setSelectedSubIndex(null);
    setCurrentLevel(1);
  }, []);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent('twinlevelchange', { detail: { level: currentLevel } }));
  }, [currentLevel]);

  const [reloadKey, setReloadKey] = useState(0);
  const handleRetry = useCallback(() => {
    
    try {
      useGLTF.clear(MODEL_SRC);
    } catch (e) {
      
    }
    setSelected(null);
    setSelectedSubIndex(null);
    setCurrentLevel(0);
    setReloadKey((k) => k + 1);
  }, []);

  const handleCanvasCreated = useCallback(({ gl }) => {
    gl.setClearColor(0x000000, 0);
    const canvas = gl.domElement;
    const onLost = (event) => {
      event.preventDefault();
      console.warn('[IONA] WebGL bağlamı kayboldu — 3D sahne yeniden başlatılıyor.');
      setReloadKey((k) => k + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
  }, []);

  const stageRef = useRef(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const target = stageRef.current;
    let intersecting = true;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); }, { rootMargin: '120px' });
    if (target) observer.observe(target);
    document.addEventListener('visibilitychange', update);
    const escape = e => { if (e.key === 'Escape') handleReset(); };
    document.addEventListener('keydown', escape);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); document.removeEventListener('keydown', escape); };
  }, [handleReset]);

  return <div ref={stageRef} className={selected ? 'twin-surface is-inspecting' : 'twin-surface'}>
    <div className="min-w-0">
      <div className="twin-viewport">
        <TwinErrorBoundary resetKey={reloadKey} onRetry={handleRetry}>
          <Suspense fallback={<TwinLoading onRetry={handleRetry} />}>
            <Canvas key={reloadKey} shadows frameloop={visible ? (reduceMotion ? 'demand' : 'always') : 'never'}
              camera={{ fov: CAMERA_FOV, near: .1, far: 800, position: [100, 80, 100] }}
              dpr={isMobileViewport ? 1 : [1, 1.5]}
              gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
              onCreated={handleCanvasCreated} onPointerMissed={handleReset}>
              <hemisphereLight args={['#e8f0ff', '#c6bcb1', .65]} />
              <Environment resolution={128} frames={1} environmentIntensity={.65}>
                <Lightformer intensity={3} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
                <Lightformer intensity={2.5} position={[-8, 3, 0]} rotation={[0, Math.PI / 2, 0]} scale={[4, 8, 1]} />
                <Lightformer intensity={1.5} color="#dce7ff" position={[7, 2, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 6, 1]} />
              </Environment>
              <directionalLight ref={keyLightRef} position={[-60, 90, 50]} color="#fff4e4" intensity={2.6} castShadow
                shadow-mapSize={isMobileViewport ? [1024, 1024] : [2048, 2048]}
                shadow-bias={-.00012} shadow-normalBias={.08} />
              <directionalLight position={[40, 25, -40]} color="#dce8ff" intensity={.7} />
              <Model plantRootRef={plantRootRef} onReady={handleReady} onSelect={handleSelect} onReset={handleReset}
                selected={selected} flowActive={flowActive && !isMobileViewport} />
              <FeedPipeGapFill />
              <Rig plantRootRef={plantRootRef} selected={selected} groundY={groundY} groundScale={groundScale} shadowFar={shadowFar} keyLightRef={keyLightRef} />
            </Canvas>
          </Suspense>
        </TwinErrorBoundary>
        {!hasInteracted && <p className="twin-hint">Bir yapıyı seçerek tesisin içini keşfedin.</p>}
      </div>
      <nav className="twin-structure-nav" aria-label="Tesis bileşenleri">
        {Object.entries(plantData).filter(([key]) => key !== 'biogas_mixer').map(([key, data]) =>
          <button type="button" key={key} aria-pressed={selected?.name === key} onClick={() => {
            const node = plantRootRef.current?.getObjectByName(key); if (node) handleSelect(node);
          }}>{data.title}</button>)}
        {selected && <button type="button" onClick={handleReset}>↖ Genel görünüm</button>}
      </nav>
    </div>
    {selected && <DetailPanel structureKey={selected.name} subIndex={selectedSubIndex} onSelectSub={handleSelectSub}
      onBack={handleBackToStructure} onClose={handleReset} onReturnToParent={handleReturnToParent} />}
  </div>;
}



