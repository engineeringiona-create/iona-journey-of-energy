import { ReactorCutaway } from './ReactorCutaway.jsx';
import { processSteps } from './processSteps.js';
import { Component, Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, useGLTF, useTexture } from '@react-three/drei'; // eslint-disable-line no-unused-vars -- useTexture: see the texture hooks note below
import * as THREE from 'three';
import gsap from 'gsap';
import { reduceMotion } from '../../three/scene-utils.js';
import { applyStructureOverrides } from './plantStructureOverrides.js';
import { fitPerspectiveObject } from './cameraFit.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { localModelUrl, modelUrl } from '../../lib/modelAssets.js';

/* Phase 104: the plant ships as ONE Draco-compressed GLB with every runtime
   override already baked in (scripts/model-lab/bake-plant.mjs → gltf-transform
   draco; `npm run model:build`). 3.45 MB → 0.7 MB. The un-baked source the
   bake starts from is model-lab/src/iona-tesis-3d.glb — build-time only, and
   deliberately outside public/ so it isn't copied into the deploy.
   The decoder is served locally from public/draco/ (copied from three's
   examples/jsm/libs/draco/gltf): 0.7 MB of wasm+js that the browser caches
   once, and unlike the GLB it is code — kendi origin'imizde kalıyor.

   2026-09-19: GLB'nin adresi artık sabit değil, modelAssets.js çözüyor —
   VITE_MODEL_BUCKET tanımlıysa Supabase Storage'ın CDN'inden, değilse
   eskisi gibi public/models/ altından. Yerel kopya silinmiyor: uzak istek
   hata verirse (CDN kapalı, bucket private, ağ engeli) fallBackToLocalModel
   bir kez yerel yola düşüp sahneyi yeniden kuruyor, böylece hero hiçbir
   koşulda modelsiz kalmıyor. */
const MODEL_FILE = 'iona-tesis-3d.draco.glb';
const LOCAL_MODEL_SRC = localModelUrl(MODEL_FILE);
const DRACO_DECODER_PATH = '/draco/';

/* Modül seviyesinde mutable: fallback olduğunda değeri değişir ve sahne
   reloadKey ile yeniden kurulduğunda yeni yol okunur. useGLTF'in kendi
   cache'i yola göre anahtarlandığı için eski girdiyi de temizliyoruz. */
let modelSrc = modelUrl(MODEL_FILE);
useGLTF.preload(modelSrc, DRACO_DECODER_PATH);

/* Uzak kopya açılmadıysa yerel kopyaya geç. Zaten yereldeysek false döner —
   o durumda gerçekten yüklenemiyor demektir, hata ekranı gösterilir. */
function fallBackToLocalModel() {
  if (modelSrc === LOCAL_MODEL_SRC) return false;
  console.warn('[IONA] Uzak 3D model açılamadı, yerel kopyaya dönülüyor:', modelSrc);
  try {
    useGLTF.clear(modelSrc);
  } catch (e) {
    /* cache'te yoksa sorun değil */
  }
  modelSrc = LOCAL_MODEL_SRC;
  useGLTF.preload(modelSrc, DRACO_DECODER_PATH);
  return true;
}

const CAMERA_DURATION = reduceMotion ? 0.01 : 0.8;
const CAMERA_EASE = 'power2.inOut';

/* Phase 105 (performance): the plant is a still model, so nothing is
   rendered unless something changed — the Canvas runs frameloop="demand" and
   every tween/interaction calls invalidate(). The shadow map is baked once and
   re-baked only when geometry moves (hover lift, x-ray castShadow flips),
   never on a timer. */
const MAX_COPY_OCCLUSION = 0.6;

const CAMERA_FOV = 35;

const OVERVIEW_DIR = new THREE.Vector3(1, 0.8, 1).normalize();

const FOCUS_DIR = new THREE.Vector3(0.65, 0.42, 0.75).normalize();
/* Phase 100: the digester is framed from higher up than the other structures —
   its lid sinks into the tank on selection (see DOME_LID_MESH_NAMES) and the
   interior is what the click is for, so the camera looks down into it at
   ~45 deg instead of the 23 deg side-on angle the buildings get. */
const DIGESTER_FOCUS_DIR = new THREE.Vector3(0.6, 0.85, 0.7).normalize();
/* Phase 101: on selection the dome stays put and is cut in half VERTICALLY —
   the half facing the camera is clipped away (a world-space clipping plane on
   the dome glass, swept in from outside the dome so it reads as the lid
   opening), the far half stays as the silhouette. The plane's normal is the
   horizontal component of DIGESTER_FOCUS_DIR, so the cut always faces the
   camera the digester is framed from. Crown fittings sit on the removed half
   and are simply hidden while the cut is open. */
const DOME_CUT_NORMAL = new THREE.Vector3(-DIGESTER_FOCUS_DIR.x, 0, -DIGESTER_FOCUS_DIR.z).normalize();
const DOME_CUT_OPEN = 0;      // plane through the tank axis: exactly half
const DOME_CUT_CLOSED = 10.5; // past the dome's r 9.2: nothing clipped
const DOME_CROWN_MESH_NAMES = ['dome_hatch', 'pressure_relief_valve', 'relief_cap'];
const DOME_CUT_DURATION = reduceMotion ? 0.01 : 0.9;

// Must stay in step with the @media(min-width:880px) block in brand-system.css
// that switches the card from stacked-below to overlaid-on-the-right.
const CARD_OVERLAY_QUERY = '(min-width: 880px)';
/* How much of the viewport the card is allowed to claim before we stop giving
   ground — past this the model would be squeezed into a sliver on narrow
   desktop widths, which looks worse than a little overlap. */
const MAX_CARD_OCCLUSION = 0.5;

const HOVER_LIFT = 0.18;
const HOVER_DURATION = reduceMotion ? 0.01 : 0.35;
const HOVER_EASE = 'power2.out';
const HOVER_WORM_COLOR_A = '#78dc77';
const HOVER_WORM_COLOR_B = '#c0d8c4';

/* ── Porselen maket + saha renkleri ──────────────────────────────────────────
   One ceramic-like language, several value/colour tiers: porcelain shells,
   IONA-green digester body with visible vertical ribs, light steel pipework,
   and small saturated equipment accents (navy valve bodies, red pumps and
   handwheels, safety yellow) borrowed from the ANKA reference model. Every
   recipe is instantiated PER STRUCTURE — never shared across two structures —
   so the x-ray ghosting keeps working (see the materialOwners pass below). */
/* ── Glossy architectural ceramic ─────────────────────────────────────────
   Phase 100 (Murat's brief): the whole plant is a glazed-ceramic display piece
   — the look of a high-end industrial design render. Every recipe is a
   MeshPhysicalMaterial (a `clearcoat` key is what selects it in
   materialFromRecipe): a near-mirror body (roughness .05-.12) under a full
   clearcoat is what makes porcelain, glazed tile and lacquered metal read as
   one fired, polished family. Main bodies are the brief's #fdfdfd; the colour
   accents (IONA green, equipment red, safety yellow, navy) keep their hue but
   take the same glaze so nothing in the scene reads as a different material
   system. Concrete parts are the one deliberate contrast — matte, textured
   (RECIPE_MAPS below) — so the glazed bodies have something to sit on. */
const WHITE = '#fdfdfd';
const CERAMIC = { roughness: 0.05, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.1, envMapIntensity: 1.2 };
const CONCRETE = { roughness: 0.82, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.6, envMapIntensity: 0.9 };
const CLEAR_GLASS = { color: '#ffffff', roughness: 0.04, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 };
/* Phase 102 (Murat): the mixers are the one thing that is NOT white — brushed
   stainless, so they read against the maquette. Anisotropy gives the brushed
   streak without a texture; a real metal PBR set plugs in through RECIPE_MAPS
   (`mixerMetal` entry below) the moment one lands in public/textures/. The
   side/top digester mixers use the same numbers in plantStructureOverrides
   (mixerSteelMaterial & co — they sit outside the recipe system on purpose). */
const BRUSHED_STEEL = { color: '#cfd3d6', roughness: 0.38, metalness: 0.8, clearcoat: 0.3, clearcoatRoughness: 0.25, envMapIntensity: 1.7, anisotropy: 0.6 };

/* Phase 101 (Murat): the model is an all-white maquette. Every recipe key is
   kept — the mesh-name tables below still route through them — but every
   coloured one now resolves to the same white glazed ceramic; the only
   texture in the scene is the Concrete034 set on the concrete parts
   (RECIPE_MAPS), and the two glass recipes are clear white glass. To bring a
   colour back, change one line here. */
const SURFACE_RECIPES = {
  porcelain: { color: WHITE, ...CERAMIC },
  /* shell* recipes look identical to their solid counterparts but own
     dedicated material instances per structure: selecting a structure fades
     ITS shell to reveal the interior (mixers in the tank, CHP in the
     container, desk behind the SCADA glass) while everything else in the
     scene stays solid. */
  shell: { color: WHITE, ...CERAMIC },
  shellRoof: { color: WHITE, ...CERAMIC },
  shellGlass: { ...CLEAR_GLASS },
  shellBrand: { color: WHITE, ...CERAMIC },
  shellBrandRib: { color: WHITE, ...CERAMIC },
  shellStone: { color: '#e6e8e3', ...CONCRETE },
  stone: { color: '#e6e8e3', ...CONCRETE },
  ochre: { color: WHITE, ...CERAMIC },
  graphite: { color: WHITE, ...CERAMIC },
  steel: { color: WHITE, ...CERAMIC },
  steelPipe: { color: WHITE, ...CERAMIC },
  galv: { color: WHITE, ...CERAMIC },
  brand: { color: WHITE, ...CERAMIC },
  brandRib: { color: WHITE, ...CERAMIC },
  heatRed: { color: WHITE, ...CERAMIC },
  sun: { color: WHITE, ...CERAMIC },
  equipRed: { color: WHITE, ...CERAMIC },
  navy: { color: WHITE, ...CERAMIC },
  slurry: { color: WHITE, ...CERAMIC },
  winGlass: { ...CLEAR_GLASS },
  screenGlow: { color: WHITE, ...CERAMIC },
  mixerMetal: { ...BRUSHED_STEEL },
  propellerRed: { color: '#d0261c', roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2 },
};

/* ── Texture hooks (texture readiness) ────────────────────────────────────
   These materials are built imperatively (materialFromRecipe) because they
   are assigned during a GLTF traverse, so maps are loaded once through a
   TextureLoader and attached by recipe key from the table below. Drop a PBR
   set into public/textures/<name>/ and list its slots here; every slot is
   optional, and a file that fails to load just leaves the recipe's flat
   colour (no black flash: a map is attached only once it has loaded).

   For materials declared in JSX the drei form is the same idea:
   // To add custom textures later, uncomment and update the paths:
   // const textureProps = useTexture({ normalMap: '/textures/ceramic_normal.jpg', roughnessMap: '/textures/ceramic_roughness.jpg' })
   // Then spread {...textureProps} inside the meshPhysicalMaterial.

   `repeat` is in texture tiles per world unit, so a 2 m concrete tile is
   0.5; `normalScale` tames or boosts the relief. Concrete034 is the
   ambientCG set Murat supplied (downsampled to 1K for the web). */
const RECIPE_MAPS = {
  stone: {
    map: '/textures/concrete034/color.jpg',
    normalMap: '/textures/concrete034/normal_gl.jpg',
    roughnessMap: '/textures/concrete034/roughness.jpg',
    repeat: 0.35, normalScale: 0.55,
  },
  shellStone: {
    map: '/textures/concrete034/color.jpg',
    normalMap: '/textures/concrete034/normal_gl.jpg',
    roughnessMap: '/textures/concrete034/roughness.jpg',
    repeat: 0.35, normalScale: 0.55,
  },
  // porcelain: { normalMap: '/textures/ceramic/normal.jpg', roughnessMap: '/textures/ceramic/roughness.jpg', repeat: 0.5, normalScale: 0.3 },
  // Brushed-metal set for the mixers (ambientCG "MetalXXX" style names):
  // mixerMetal: { map: '/textures/metal/color.jpg', normalMap: '/textures/metal/normal_gl.jpg', roughnessMap: '/textures/metal/roughness.jpg', metalnessMap: '/textures/metal/metalness.jpg', repeat: 2, normalScale: 0.5 },
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
function loadSharedTexture(url, slot, repeat) {
  const cacheKey = `${url}|${repeat}`;
  if (!textureCache.has(cacheKey)) {
    textureCache.set(cacheKey, new Promise((resolve, reject) => {
      textureLoader.load(url, (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat, repeat);
        texture.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = 8;
        resolve(texture);
      }, undefined, reject);
    }));
  }
  return textureCache.get(cacheKey);
}
function attachRecipeMaps(material, key) {
  const maps = RECIPE_MAPS[key];
  if (!maps) return;
  const { repeat = 1, normalScale = 1, ...slots } = maps;
  Object.entries(slots).forEach(([slot, url]) => {
    loadSharedTexture(url, slot, repeat).then((texture) => {
      material[slot] = texture;
      if (slot === 'normalMap') material.normalScale.set(normalScale, normalScale);
      material.needsUpdate = true;
    }).catch(() => { /* missing file: keep the flat recipe colour */ });
  });
}

function materialFromRecipe(key) {
  const recipe = SURFACE_RECIPES[key];
  const material = 'clearcoat' in recipe
    ? new THREE.MeshPhysicalMaterial(recipe)
    : new THREE.MeshStandardMaterial(recipe);
  attachRecipeMaps(material, key);
  return material;
}

const SHELL_RECIPE_KEYS = new Set(['shell', 'shellRoof', 'shellGlass', 'shellBrand', 'shellBrandRib', 'shellStone']);

/* baseName → recipe key. The structure-specific map wins, then this global
   map, then the structure's default. Names come from the GLB inventory plus
   the meshes plantStructureOverrides adds at runtime. */
const GLOBAL_MESH_RECIPES = {
  foundation_pad: 'stone', wall_plinth: 'stone', pool_pad: 'stone', pool_wall: 'stone',
  slab: 'stone', heat_pipe_sleeper: 'stone',
  roof: 'graphite', roof_fascia: 'graphite', roof_vent: 'steel', roof_ac_unit: 'steel',
  window: 'winGlass', door: 'brand', door_handle: 'steel', radio_mast: 'steel',
  canopy_post: 'steel',
  inline_valve_body: 'navy', inline_valve_flange: 'steelPipe',
  inline_valve_stem: 'steel', inline_valve_wheel: 'equipRed',
};

const STRUCTURE_MESH_RECIPES = {
  digester: {
    tank_wall: 'shellBrand', wall_rib: 'shellBrandRib', wall_band: 'shellBrand',
    dome_hatch: 'shell', top_ring: 'shell',
    dome_walkway: 'galv', top_platform: 'galv', stair_tread: 'galv', walkway_inner_kerb: 'galv',
    stair_stringer: 'steel', stair_handrail_1: 'steel', stair_handrail_2: 'steel',
    walkway_rail: 'steel', walkway_midrail: 'steel', walkway_post: 'steel',
    platform_rail: 'steel', platform_post: 'steel', rail_post: 'steel',
    feed_nozzle: 'steelPipe', feed_nozzle_flange: 'steelPipe',
    heat_inlet_nozzle: 'heatRed', heat_inlet_nozzle_flange: 'heatRed',
    heat_return_nozzle: 'heatRed', heat_return_nozzle_flange: 'heatRed',
    heating_coil_row: 'heatRed', coil_jumper: 'heatRed',
    pressure_relief_valve: 'sun', relief_cap: 'sun',
  },
  engine_room: {
    container_wall: 'shell', door: 'shellBrand', container_frame: 'graphite', container_stack: 'steel',
    container_fan: 'graphite', container_hazard_stripe: 'sun',
    engine_block: 'equipRed', cylinder_head: 'porcelain', valve_cover: 'graphite',
    generator: 'steel', generator_endcap: 'graphite', generator_fin: 'steel',
    exhaust_manifold: 'heatRed', exhaust_riser: 'heatRed', exhaust_runner: 'heatRed',
    exhaust_stack: 'steel', exhaust_cap: 'steel',
    heat_exchanger: 'steelPipe', oil_sump: 'graphite', engine_skid: 'graphite',
    coupling_guard: 'sun', flywheel: 'graphite', control_panel: 'graphite', panel_face: 'screenGlow',
    radiator_fan: 'graphite',
  },
  pump_room: {
    slab: 'ochre', roof: 'shellRoof', roof_fascia: 'shellRoof',
    pump_volute: 'equipRed', pump_motor: 'navy', motor_fin: 'steel', motor_terminal_box: 'graphite',
    pump_baseplate: 'graphite', pump_mcc_cabinet: 'graphite',
    pump_suction: 'steelPipe', pump_discharge: 'steelPipe',
    discharge_header: 'steelPipe', header_riser: 'steelPipe',
  },
  scada_room: {
    wall_front: 'shell', wall_back: 'shell', wall_left: 'shell', wall_right: 'shell',
    roof: 'shellRoof', roof_fascia: 'shellRoof', window: 'shellGlass', door: 'shellBrand',
    operator_desk: 'graphite', desk_panel: 'porcelain', keyboard: 'graphite',
    monitor: 'graphite', monitor_screen: 'screenGlow', monitor_stand: 'steel',
    mimic_board: 'graphite', mimic_screen: 'screenGlow',
    scada_cabinet: 'graphite', cabinet_led: 'screenGlow',
    chair_back: 'graphite', chair_base: 'graphite', chair_post: 'steel', chair_seat: 'graphite',
  },
  feed_pool: {
    pool_wall: 'shellStone', pool_rim: 'shellStone', pool_cover: 'shellRoof',
    pool_liner: 'graphite', substrate_surface: 'slurry',
    pool_bridge: 'steel', pool_feed_chute: 'steel',
    pool_mixer_shaft: 'mixerMetal', pool_mixer_drive: 'mixerMetal', pool_mixer_blade: 'propellerRed',
  },
  site_piping: {
    gas_pipe_support: 'steel', cable_tray_post: 'galv',
    heat_main: 'heatRed', heat_inlet: 'heatRed', heat_return: 'heatRed',
    heat_inlet_tee: 'heatRed', heat_return_tee: 'heatRed', heat_wall_flange_chp: 'heatRed',
  },
};

const STRUCTURE_DEFAULT_RECIPE = {
  digester: 'porcelain', engine_room: 'porcelain', pump_room: 'porcelain',
  scada_room: 'porcelain', feed_pool: 'porcelain', site_piping: 'steelPipe',
};

/* Phase 105: plain alpha glass. `transmission` made three render the entire
   scene a second time into a transmission target on every frame — the single
   most expensive thing in the scene, for a dome on a white maquette that reads
   just as well as a 35% glass. */
const FORCEFIELD_GLASS = {
  color: '#ffffff',
  transmission: 0,
  opacity: 0.36,
  transparent: true,
  // Near-clear rather than frosted: at roughness .3 the interior turned to
  // fog, and seeing in is the whole point of the dome.
  roughness: 0.08,
  ior: 1.35,
  thickness: 0.6,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  envMapIntensity: 1.4,
  // Phase 101: no self-lit tint — the maquette is white, the dome is clear.
  emissive: '#000000',
  emissiveIntensity: 0,
  // Single-sided glass reads as a cut-open crescent from the hero angle.
  side: THREE.DoubleSide,
};

/* ── Engineering edges ───────────────────────────────────────────────────────
   drei's <Edges> is JSX-only and these meshes arrive from a GLTF traverse, so
   this is the same thing imperatively: an EdgesGeometry outline parented to
   each mesh, which inherits its transform and stays welded to it. */
/* Coloured surfaces carry the read now, so the constant outline drops from a
   green marker pen to a faint ink pencil — hover/selection keep the green. */
const EDGE_COLOR = '#2a3d31';
const EDGE_OPACITY = 0.16;
// Degrees. Low values outline every tessellation seam on a curved tank; this
// keeps only edges a draughtsman would actually draw.
const EDGE_THRESHOLD_ANGLE = 22;
// Bolts, handles and flange rings cost a draw call each and read as fuzz at
// hero framing, so anything smaller than this is left un-outlined.
const EDGE_MIN_RADIUS = 0.14;

function edgeGeometryFor(geometry, cache) {
  if (!cache.has(geometry)) {
    const edges = new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_ANGLE);
    const usable = edges.attributes.position.count > 0;
    if (!usable) edges.dispose();
    cache.set(geometry, usable ? edges : null);
  }
  return cache.get(geometry);
}

/* One mesh's outline as a fresh, un-transformed copy the caller can carry into
   another frame and merge; null when the part is too small to outline. */
function edgeGeometryPiece(mesh, cache) {
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  if (mesh.geometry.boundingSphere.radius < EDGE_MIN_RADIUS) return null;
  const geometry = edgeGeometryFor(mesh.geometry, cache);
  return geometry ? geometry.clone() : null;
}

// Unselected structures ghost back to this fraction of their own opacity.
const XRAY_OPACITY = 0.12;
const XRAY_DURATION = reduceMotion ? 0.01 : 0.55;

const plantData = {
  digester: {
    title: 'Çürütücü',
    identity: 'Ø24 m · mezofilik 38–42 °C · çift membran kubbe',
    description: 'Organik atıkların oksijensiz ortamda biyogaza dönüştüğü mezofilik reaktör. Isıtma devresi kojenerasyonun atık ısısıyla beslenir.',
    photo: '/images/equipment/digester-exterior.webp',
    subComponents: [
      {
        name: 'Arma Mix Twin Karıştırıcılar',
        spec: '15–22 kW · yavaş devirli · tek şaft, çift pervane',
        description: 'Duvara eğimli monte edilen dalgıç karıştırıcılar; tek uzun şaft üzerindeki iki pervane, yüzey kabuklaşmasını ve taban çökeltisini önleyerek reaktör içeriğini homojen tutar.',
        specs: [
          'Referans ürün: Armatec Arma Mix Twin',
          'Tek şaft (5,5 m’ye kadar), üzerinde iki pervane Ø880–1000 mm',
          'Kırmızı motor + redüktör, 45° döndürülmüş elmas flanş',
          'Duvara 45°’ye kadar eğimli montaj — devir sayısı projeye göre belirlenir'
        ],
        photo: '/images/equipment/digester-mixer.webp'
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
        photo: '/images/equipment/digester-heat-exchanger.webp'
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
        ],
        photo: '/images/equipment/digester-sensors.webp'
      }
    ]
  },
  engine_room: {
    title: 'Kojenerasyon Odası',
    identity: '1,2 MW elektrik · >%42 elektriksel verim · 85 °C ısı geri kazanımı',
    description: 'Üretilen biyogazın elektrik ve ısı enerjisine dönüştürüldüğü kojenerasyon ünitesi.',
    photo: '/images/equipment/engine-room.webp',
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
        photo: '/images/equipment/engine-room.webp'
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
        photo: '/images/equipment/engine-room-heat-recovery.webp'
      }
    ]
  },
  pump_room: {
    title: 'Pompa Odası',
    identity: '80 m³/h transfer · loblu pompa + maseratör · açık sundurma',
    description: 'Tesis içi substrat ve atık transferinin yönetildiği hidrolik merkez.',
    photo: '/images/equipment/pump-room.webp',
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
        photo: '/images/equipment/pump-room-lobe-pump.webp'
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
        photo: '/images/equipment/pump-room-macerator.webp'
      }
    ]
  },
  scada_room: {
    title: 'SCADA Kontrol Odası',
    identity: '7/24 izleme · CH₄ / H₂S analizi · PLC otomasyon',
    description: 'Tesisin tüm otomasyon, ölçüm ve güvenlik verilerinin anlık olarak izlendiği beyin.',
    photo: '/images/equipment/scada-room.webp',
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
        photo: '/images/equipment/scada-gas-analyzer.webp'
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
        photo: '/images/equipment/scada-plc-panel.webp'
      }
    ]
  },
  feed_pool: {
    title: 'Besleme Havuzu',
    identity: 'Günlük besleme · homojenizasyon · dalgıç karıştırıcı',
    description: 'Tesise gelen günlük taze atıkların homojenize edilip sisteme hazırlandığı ön kabul ünitesi.',
    photo: '/images/equipment/feed-pool.webp',
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
        photo: '/images/equipment/feed-pool.webp',
        /* Dosya adındaki 1280w, yeniden kodlanmış sürümün genişliği. Video
           uzun `cache-control` ile yayınlandığı için aynı adla içerik
           değiştirmek Cloudflare kenarında elle purge gerektirir; ad değişince
           gerekmez. Yeni bir kodlama yaparsan dosya adını DA değiştir.

           DİKKAT: yeni adresi, dosya yayına çıkmadan ÖNCE düz hâliyle
           istemeyin — `serve` eksik dosyaya da aynı uzun cache-control'ü
           basıyor, yani Cloudflare 404'ü önbelleğe alıyor ve dosya sonradan
           gelse bile kenar 404 dönmeye devam ediyor. Kontrol edecekseniz
           sorgu dizesiyle isteyin (`?x=1`): farklı önbellek anahtarı olur,
           temiz adresi zehirlemez. */
        video: '/videos/digester-mixer-1280w.mp4'
      }
    ]
  },
  
  biogas_mixer: {
    title: 'Arma Mix Twin Dalgıç Karıştırıcı',
    identity: '15–22 kW · IE4 · AISI 304/316',
    description: 'Reaktör duvarına eğimli monte edilen, tek şaft üzerinde iki pervane taşıyan dalgıç karıştırıcı ve homojenizatör.',
    photo: '/images/equipment/digester-mixer.webp',
    specs: [
      'Motor gücü: 15–22 kW (IE4 verim sınıfı)',
      'Tek şaft üzerinde iki pervane, Ø880–1000 mm',
      'AISI 304/316 paslanmaz gövde; agresif pH ve H₂S koruması',
      'Fonksiyon: kabuklaşma önleme, taban çökeltisi giderme, homojen sıcaklık dağılımı'
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

  // Ceramic-white panel seams: the stripe stays as engineering detail, but at
  // this contrast it reads as a shutter line on porcelain, not a grey texture.
  ctx.fillStyle = 'rgb(249, 250, 251)';
  ctx.fillRect(0, 0, size / 2, size);
  ctx.fillStyle = 'rgb(238, 240, 241)';
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

/* The part-name taxonomy below, and the three canvas-texture factories around
   it, are no longer wired to any material: the clay pass gives every structure
   one white finish and only the dome and the three flow channels are named
   out. They are kept because they are the model's only map from mesh name to
   real-world part — the reference you need the moment a part needs its own
   treatment again. Unused code, deliberately. */
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
      {/* Matches the feed line's painted steel, or the joint shows up. */}
      <meshStandardMaterial color="#d3d9da" metalness={0.55} roughness={0.3} />
    </mesh>
  );
}

const Model = memo(function Model({ plantRootRef, onReady, onSelect, onReset, selected, flowActive, cutawayOpen }) {
  const { scene: cachedScene } = useGLTF(modelSrc, DRACO_DECODER_PATH);
  const scene = useMemo(() => new THREE.Group(), []);
  
  const materialsRef = useRef(new Map());
  
  const baseYRef = useRef(new Map());
  const hoveredNameRef = useRef(null);
  
  const hoverUniformsRef = useRef(new Map());
  
  const namedMeshMaterialsRef = useRef(new Map());
  
  const digesterMixersRef = useRef({ propellerHubs: [], beacons: [], fanHubs: [] });
  const domeMaterialRef = useRef(null);
  
  const tankWallMeshesRef = useRef([]);

  /* Per structure: the shell materials + meshes that go see-through when THAT
     structure is selected, and the structure's outline material so the green
     ink fades with the skin it traces. */
  const shellSetsRef = useRef(new Map());
  const edgeMaterialsRef = useRef(new Map());

  const flowUniformsRef = useRef([]);

  const canvasEl = useThree((state) => state.gl.domElement);
  const gl = useThree((state) => state.gl);
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
    // Dev-only handle for inspecting the live scene graph from the console.
    if (import.meta.env.DEV) window.__IONA_PLANT = plantRoot;

    const { propellerHubs, beacons, fanHubs } = applyStructureOverrides(plantRoot);
    digesterMixersRef.current = { propellerHubs, beacons, fanHubs };

    const materials = new Map();
    const baseYs = new Map();
    const hoverUniforms = new Map();
    const namedMeshMaterials = new Map();

    const tankWallMeshes = [];
    const shellSets = new Map();
    
    const flowUniforms = [];

    const edgeMaterials = new Map();
    const edgeGeometries = new Map();
    const edgeTargets = [];
    const structureRecipeGetters = new Map();
    plantRoot.children.forEach((structure) => {
      /* One recipe set, but material INSTANCES per structure. A single shared
         instance would silently break selection: the x-ray pass fades a
         structure through the materials it owns, and it drops any material
         owned by two structures (materialOwners.size > 1 below), so a global
         instance would ghost nothing at all. The hover and flow shaders are
         per-material too. */
      const recipeCache = new Map();
      const uniformsList = [];
      const getRecipeMaterial = (key) => {
        if (!recipeCache.has(key)) {
          const recipeMaterial = materialFromRecipe(key);
          uniformsList.push(attachHoverWormShader(recipeMaterial));
          recipeCache.set(key, recipeMaterial);
        }
        return recipeCache.get(key);
      };
      structureRecipeGetters.set(structure.name, getRecipeMaterial);
      const material = getRecipeMaterial(STRUCTURE_DEFAULT_RECIPE[structure.name] ?? 'porcelain');
      const structureNamedMaterials = new Map();

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: EDGE_COLOR,
        transparent: true,
        opacity: EDGE_OPACITY,
        // Outlines sit on the surface they trace; writing depth makes them
        // z-fight with it.
        depthWrite: false,
      });
      edgeMaterials.set(structure.name, edgeMaterial);

      if (structure.name === 'digester') {
        const domeMaterial = new THREE.MeshPhysicalMaterial({
          ...FORCEFIELD_GLASS,
          depthWrite: false,
          depthTest: true,
          /* One world-space plane, constant animated by the lid effect below;
             gl.localClippingEnabled is switched on in handleCanvasCreated. */
          clippingPlanes: [new THREE.Plane(DOME_CUT_NORMAL.clone(), DOME_CUT_CLOSED)],
        });
        domeMaterial.needsUpdate = true;
        domeMaterialRef.current = domeMaterial;
        uniformsList.push(attachHoverWormShader(domeMaterial));
        DIGESTER_DOME_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, domeMaterial));
      }

      if (structure.name === 'site_piping') {
        /* Three flow channels with their own painted identity — steel feed
           line, safety-yellow gas line, galvanized cable tray — each with the
           process-tour pulse shader patched onto its own material instance.
           (A material takes one onBeforeCompile, so channels get the flow
           shader instead of the hover worm.) */
        [
          [SITE_PIPING_FEED_MESH_NAMES, FLOW_FEED_COLOR, 'steelPipe'],
          [SITE_PIPING_GAS_MESH_NAMES, FLOW_GAS_COLOR, 'sun'],
          [SITE_PIPING_POWER_MESH_NAMES, FLOW_POWER_COLOR, 'galv'],
        ].forEach(([meshNames, flowColor, recipeKey]) => {
          const channelMaterial = materialFromRecipe(recipeKey);
          channelMaterial.needsUpdate = true;
          flowUniforms.push(attachFlowPulseShader(channelMaterial, flowColor));
          meshNames.forEach((name) => structureNamedMaterials.set(name, channelMaterial));
        });
      }

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

      if (structure.name === 'digester' && DIGESTER_MIXER_MESH_NAMES.has(baseName)) {
        return;
      }

      /* The ribs, bands and railings the clay pass used to hide are visible
         again: on the green tank body they are the ANKA-style vertical sheet
         ribs, and the walkway rails read as real galvanized hardware. */
      const override = namedMeshMaterials.get(structure.name)?.get(baseName);
      const recipeKey = STRUCTURE_MESH_RECIPES[structure.name]?.[baseName]
        ?? GLOBAL_MESH_RECIPES[baseName]
        ?? STRUCTURE_DEFAULT_RECIPE[structure.name]
        ?? 'porcelain';
      child.material = override ?? structureRecipeGetters.get(structure.name)(recipeKey);
      child.material.needsUpdate = true;
      if (!override && SHELL_RECIPE_KEYS.has(recipeKey)) {
        const entry = shellSets.get(structure.name) ?? { materials: new Set(), meshes: [] };
        entry.materials.add(child.material);
        entry.meshes.push(child);
        shellSets.set(structure.name, entry);
      }
      // Glass must not drop a solid shadow — that was what made the old dome
      // read as a dark metal cap from the hero angle.
      child.castShadow = !(structure.name === 'digester' && DIGESTER_DOME_MESH_NAMES.has(baseName));
      child.userData.ionaBaseCastShadow = child.castShadow;
      child.receiveShadow = true;
      edgeTargets.push([child, structure.name]);

      if (structure.name === 'digester' && baseName === DIGESTER_WALL_MESH_NAME) {
        tankWallMeshes.push(child);
      }
    });
    tankWallMeshesRef.current = tankWallMeshes;
    shellSetsRef.current = shellSets;
    edgeMaterialsRef.current = edgeMaterials;

    /* Outlines are built after the traverse, not inside it, and merged into ONE
       LineSegments per structure (Phase 105): ~400 per-mesh line objects were
       ~400 draw calls a frame for what is a static drawing. Each mesh's
       EdgesGeometry is carried into the structure's local frame so the merged
       object rides the structure's hover lift exactly as the per-mesh lines
       did. Meshes that move on their own (mixers) never had outlines. */
    plantRoot.updateMatrixWorld(true);
    const structureInverse = new Map();
    const edgePieces = new Map();
    edgeTargets.forEach(([mesh, structureName]) => {
      const piece = edgeGeometryPiece(mesh, edgeGeometries);
      if (!piece) return;
      const structure = plantRoot.getObjectByName(structureName);
      if (!structure) return;
      if (!structureInverse.has(structureName)) structureInverse.set(structureName, structure.matrixWorld.clone().invert());
      const relative = new THREE.Matrix4().multiplyMatrices(structureInverse.get(structureName), mesh.matrixWorld);
      piece.applyMatrix4(relative);
      if (!edgePieces.has(structureName)) edgePieces.set(structureName, []);
      edgePieces.get(structureName).push(piece);
    });
    edgePieces.forEach((pieces, structureName) => {
      const merged = mergeGeometries(pieces, false);
      pieces.forEach((piece) => piece.dispose());
      if (!merged) return;
      const lines = new THREE.LineSegments(merged, edgeMaterials.get(structureName));
      lines.name = 'engineering_edges';
      lines.raycast = () => {}; // an outline must never intercept the click meant for the part beneath it
      lines.frustumCulled = false;
      resources.add(merged);
      plantRoot.getObjectByName(structureName)?.add(lines);
    });

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
    edgeMaterials.forEach(collectMaterial);
    // The outline cache is shared across meshes, so some entries are not
    // reachable from a single node's geometry — collect it explicitly.
    edgeGeometries.forEach(geometry => { if (geometry) resources.add(geometry); });
    onReady(plantRoot);
    return () => {
      owned.traverse(node => gsap.killTweensOf(node.position));
      hoverUniforms.forEach(list => list.forEach(u => gsap.killTweensOf(u.uHoverActive)));
      flowUniforms.forEach(u => gsap.killTweensOf(u.uFlowActive));
      resources.forEach(resource => { gsap.killTweensOf(resource); resource.dispose?.(); });
      scene.remove(owned);
      shellSetsRef.current = new Map();
      edgeMaterialsRef.current = new Map();
      if (plantRootRef.current === plantRoot) plantRootRef.current = null;
    };
  }, [cachedScene, scene, plantRootRef, onReady]);

  const effectiveSelectedName = selected?.name === 'biogas_mixer' ? 'digester' : selected?.name;

  useEffect(() => {
    // Interior visibility belongs to cutaway mode, not to selection.
    tankWallMeshesRef.current.forEach((mesh) => {
      mesh.raycast = cutawayOpen ? () => {} : THREE.Mesh.prototype.raycast;
    });
  }, [cutawayOpen]);

  useEffect(() => {
    /* Selection is an x-ray INTO the chosen structure: its own shell fades so
       the interior reads (mixers in the tank, CHP in the container, pumps
       under the canopy), while the rest of the site stays solid. */
    const shellSets = shellSetsRef.current;
    if (!shellSets.size) return;
    shellSets.forEach((entry, name) => {
      const faded = name === effectiveSelectedName;
      // A see-through skin must not keep dropping an opaque shadow onto the
      // very equipment it just revealed.
      entry.meshes.forEach((mesh) => {
        mesh.castShadow = faded ? false : (mesh.userData.ionaBaseCastShadow ?? true);
      });
      gl.shadowMap.needsUpdate = true;
      entry.materials.forEach((material) => {
        gsap.killTweensOf(material, 'opacity');
        // `transparent` flips need a program rebuild; the hover shader reuses
        // its uniform objects across compiles, so this is safe.
        if (faded) {
          material.transparent = true;
          material.depthWrite = false;
          material.needsUpdate = true;
        }
        gsap.to(material, {
          opacity: faded ? 0.16 : 1,
          duration: XRAY_DURATION,
          ease: HOVER_EASE,
          onUpdate: invalidate,
          onComplete: () => {
            if (!faded) {
              material.transparent = false;
              material.depthWrite = true;
              material.needsUpdate = true;
            }
            invalidate();
          },
        });
      });
      // The green ink fades with the skin it traces, or a bright wireframe
      // ghost would float where the shell used to be.
      const edgeMaterial = edgeMaterialsRef.current.get(name);
      if (edgeMaterial) {
        gsap.killTweensOf(edgeMaterial, 'opacity');
        gsap.to(edgeMaterial, {
          opacity: faded ? EDGE_OPACITY * 0.3 : EDGE_OPACITY,
          duration: XRAY_DURATION,
          ease: HOVER_EASE,
          onUpdate: invalidate,
        });
      }
    });
  }, [effectiveSelectedName, invalidate, gl]);

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

  useFrame((state) => {
    const elapsed = reduceMotion ? 0 : state.clock.elapsedTime;
    hoverUniformsRef.current.forEach((uniformsList) => {
      uniformsList.forEach((uniforms) => {
        uniforms.uTime.value = elapsed;
      });
    });
    /* Phase 105: propellers, roof fans and beacons are still — a display model.
       digesterMixersRef is kept for the mixer hint and hover. The hover
       shimmer is the one thing that runs on its own clock, so while something
       is hovered the demand loop is kept alive frame by frame. */
    if (hoveredNameRef.current) invalidate();
    if (!reduceMotion) {
      flowUniformsRef.current.forEach((uniforms) => {
        uniforms.uFlowTime.value = elapsed;
      });
    }
  });

  /* Lid open/close: sweep the dome glass's clipping plane from outside the
     dome (nothing cut) to the tank axis (near half gone), and back. The crown
     fittings ride on the removed half, so they hide/show with it. */
  useEffect(() => {
    const material = domeMaterialRef.current;
    const plane = material?.clippingPlanes?.[0];
    if (!plane) return;
    const open = selected?.name === 'digester';
    gsap.to(plane, { constant: open ? DOME_CUT_OPEN : DOME_CUT_CLOSED, duration: DOME_CUT_DURATION, ease: 'power3.inOut', onUpdate: invalidate });
    const digester = plantRootRef.current?.getObjectByName('digester');
    digester?.children.forEach((child) => {
      if (DOME_CROWN_MESH_NAMES.includes(meshBaseName(child.name))) child.visible = !open;
    });
  }, [selected, plantRootRef, invalidate]);

  useEffect(() => {
    flowUniformsRef.current.forEach((uniforms, index) => {
      gsap.to(uniforms.uFlowActive, {
        value: ['feed', 'gas', 'power'][index] === flowActive ? 1 : 0,
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
            Arma Mix Twin Karıştırıcı
          </div>
        </Html>
      )}
    </>
  );
});

const Rig = memo(function Rig({ plantRootRef, selected, groundY, groundScale, siteBounds, keyLightRef, cutawayOpen, cardOverlays, cardOcclusion, copyOcclusion }) {
  const { camera, gl, size, invalidate } = useThree();
  const controlsRef = useRef(null);
  const cameraGoal = useRef(null);

  /* The camera is no longer locked: the user can orbit (horizontal free,
     polar clamped) and zoom. Any manual input drops the current framing goal
     so the lerp stops fighting the hand; a fresh selection sets a new goal
     and takes the camera back over. When nothing is selected and the user
     has been idle for a while, a slow showcase orbit runs — never under
     prefers-reduced-motion. */
  /* Phase 98: the plant never spins on its own any more — it is a still
     display piece (biblo); the user orbits it by hand if they want to. */
  const idleSpinRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const handleControlsStart = useCallback(() => {
    cameraGoal.current = null;
    idleSpinRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);
  const handleControlsEnd = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null; // idle spin retired (Phase 98) — nothing to resume
  }, []);
  useEffect(() => () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current); }, []);
  useLayoutEffect(() => {
    const root = plantRootRef.current;
    const controls = controlsRef.current;
    if (!root || !controls || !size.width || !size.height) return;
    root.updateMatrixWorld(true);

    /* While a panel is open it sits over the right of the viewport, so the
       model's stage is not the canvas — it is the strip the panel leaves free.
       `occlusion` is that panel's measured share of the canvas width, already 0
       whenever nothing overlays (narrow layouts stack it below instead). Keyed
       off the measurement rather than off `selected`, because the process tour
       overlays the same way but deliberately keeps `selected` null here so the
       framing stays on the whole site. */
    const occlusion = cardOverlays && !cutawayOpen
      ? Math.min(MAX_CARD_OCCLUSION, Math.max(0, cardOcclusion)) : 0;
    /* Phase 105: the canvas now spans the whole hero, so in the overview the
       introduction copy covers the LEFT of it the same way the card covers the
       right during inspection. The free strip is [stageLeft, stageRight] of
       the canvas width; the model is fitted to that width and panned to its
       centre. Overview → plant sits right of the copy; inspecting → the copy
       has slid out and the plant moves left, clear of the card. */
    const stageLeft = selected ? 0 : Math.min(MAX_COPY_OCCLUSION, Math.max(0, copyOcclusion || 0));
    const stageRight = 1 - occlusion;
    const free = Math.max(0.3, stageRight - stageLeft);
    const offsetFrac = (stageLeft + stageRight) / 2 - 0.5;
    if (import.meta.env.DEV) window.__IONA_STAGE = { stageLeft, stageRight, free, offsetFrac, copyOcclusion, cardOcclusion, selected: selected?.name ?? null };
    /* Fit against the free strip, not the whole canvas: a stand-in camera with
       the narrowed aspect makes fitPerspectiveObject pull back until the
       subject fits the width that is actually visible. Without this the model
       is framed for a viewport half of which the card is about to cover, which
       is what left it oversized and cropped. The real camera is never mutated,
       so no projection matrix churn. */
    const fitCamera = free < 1
      ? { up: camera.up, near: camera.near, aspect: camera.aspect * free,
          getEffectiveFOV: () => camera.getEffectiveFOV() }
      : camera;
    const focusDir = selected ? (selected.name === 'digester' ? DIGESTER_FOCUS_DIR : FOCUS_DIR) : OVERVIEW_DIR;
    const { position, center } = fitPerspectiveObject(selected ?? root, fitCamera, focusDir, cutawayOpen ? 1.6 : selected ? 1.12 : 1.06);
    /* Then slide that framing left so the subject is centred in the free strip
       rather than in the canvas. Moving eye and target by the same vector is a
       pure pan — it clears the card without re-aiming the camera, which would
       tilt the whole site. The free strip's centre sits `occlusion / 2` of the
       visible width left of the canvas centre, so the camera travels that far
       to the right. `right` must be crossVectors(up, backward), the same
       handedness cameraFit uses — the reverse points at screen-left and pushed
       the model *under* the card. Nothing is animated here: this only moves the
       goal, and the useFrame damping below carries the camera there. */
    if (Math.abs(offsetFrac) > 0.001) {
      const backward = new THREE.Vector3().subVectors(position, center);
      const tanY = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
      const visibleWidth = 2 * backward.length() * tanY * Math.max(camera.aspect, .01);
      const right = new THREE.Vector3().crossVectors(camera.up, backward).normalize();
      // Moving the camera to screen-right puts the subject to screen-left, so
      // a strip centred right of the canvas centre (offsetFrac > 0) needs a
      // camera move to the left: the sign is negative.
      const shift = -visibleWidth * offsetFrac;
      position.addScaledVector(right, shift);
      center.addScaledVector(right, shift);
    }
    camera.far = Math.max(500, position.distanceTo(center) + groundScale * 3);
    camera.updateProjectionMatrix();
    cameraGoal.current = {position, center};
    if (reduceMotion) {
      camera.position.copy(position); controls.target.copy(center); controls.update();
    }
    invalidate();
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
    return () => { cameraGoal.current = null; };
  }, [selected, cutawayOpen, cardOverlays, cardOcclusion, copyOcclusion, size.width, size.height, groundScale, groundY, camera, gl, plantRootRef, keyLightRef]);
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; }, [gl]);
  useFrame((_, delta) => {
    const goal = cameraGoal.current, controls = controlsRef.current;
    if (goal && controls && !reduceMotion) {
      const alpha = 1 - Math.exp(-7 * Math.min(delta, .05));
      camera.position.lerp(goal.position, alpha);
      controls.target.lerp(goal.center, alpha);
      controls.update();
      // Once the framing has landed, release the goal so the idle orbit and
      // the user's own orbiting aren't glued back every frame.
      if (camera.position.distanceTo(goal.position) < 0.08) cameraGoal.current = null;
    } else if (controls && !reduceMotion) {
      controls.autoRotate = !selected && !cutawayOpen && idleSpinRef.current;
      if (controls.autoRotate) controls.update();
    }
    // Demand loop: keep frames coming only while the camera is still travelling.
    if (cameraGoal.current) invalidate();
    if (import.meta.env.DEV) window.__IONA_CAM = { pos: camera.position.toArray().map((v) => +v.toFixed(1)), target: controls?.target.toArray().map((v) => +v.toFixed(1)), goal: cameraGoal.current ? cameraGoal.current.position.toArray().map((v) => +v.toFixed(1)) : null, aspect: +camera.aspect.toFixed(2), fov: camera.fov };
  });
  return <>
    <OrbitControls ref={controlsRef} enableDamping={false}
      enableRotate enableZoom enablePan={false}
      rotateSpeed={0.55} zoomSpeed={0.6} autoRotateSpeed={0.5}
      minDistance={25} maxDistance={260}
      minPolarAngle={0.3} maxPolarAngle={1.32}
      onStart={handleControlsStart} onEnd={handleControlsEnd} />
    {/* Two shadow layers, two jobs: this plane catches the key light's long
        cast (opacity pulled back from .17 so the pair doesn't read as mud)... */}
    <mesh position={[0, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[groundScale * 3, groundScale * 3]} />
      <shadowMaterial transparent opacity={.12} depthWrite={false} />
    </mesh>
    {/* ...and this one is the tight ambient contact darkening right where each
        foundation meets the ground — the thing that stops the plant floating.
        `far` stays low on purpose: only geometry near the slab contributes.
        Baked on one frame and re-keyed when the framing changes, so it costs
        nothing per frame in the same spirit as the 12fps shadow-map bake. */}
    {/* scale is the one value not taken literally from the brief: at 50 the
        shadow plane is smaller than the site (~90 units across) and cuts off
        mid-yard, so it tracks the measured bounds instead. */}
    <ContactShadows key={`${groundY}|${groundScale}|${selected?.name ?? ''}|${cutawayOpen}`}
      position={[0, groundY + .02, 0]} scale={groundScale} resolution={1024}
      far={10} blur={2.5} opacity={.5} color="#1c1f1e" frames={1} />
    {/* A real stage under the plant: a light concrete platform slab with a
        wider plinth below it. This—together with the coloured materials—is
        what ends the white-model-on-white-page problem: the site never floats
        on the bare page background again. Both slabs are raycast-inert so a
        click on them still counts as "missed" and clears the selection. */}
    {/* Phase 98: the concrete stage slabs and the drafting grid are gone —
        the plant sits on nothing but its own contact shadow, like a model on
        a plinth of light. siteBounds is still measured for the camera fit. */}
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
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{sub.name}</h2>
            <p className="text-sm font-bold tracking-wide text-emerald-600">{sub.spec}</p>
          </div>
          <EquipmentMedia photo={sub.photo} video={sub.video} />
          <p className="text-base leading-relaxed text-gray-600">{sub.description}</p>
          {sub.specs && sub.specs.length > 0 && (
            <TechSpecs items={sub.specs} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{structure.title}</h2>
          {structure.identity && (
            <p className="-mt-3 text-sm font-bold tracking-wide text-emerald-700">{structure.identity}</p>
          )}
          {structure.photo && (
            <img
              className="h-48 w-full shrink-0 rounded-2xl object-cover"
              src={structure.photo}
              alt=""
            />
          )}
          
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
              <span aria-hidden="true" className="text-lg leading-none">&lsaquo;</span> Reaktör Görünümüne Dön
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

  /* onError, "bu hatayı kurtarmayı denedim" derse (uzak kopya açılmadı,
     yerel kopyaya düşülüyor) hata ekranını hiç göstermiyoruz: state'i
     hemen geri alıyoruz, ebeveyn de reloadKey'i artırıp sahneyi yeni
     yolla kuruyor. Yerel kopya da açılmazsa onError false döner ve
     normal "yüklenemedi + tekrar dene" ekranı görünür. */
  componentDidCatch(error) {
    if (this.props.onError?.(error)) {
      this.setState({ failed: false });
      return;
    }
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
  const [tourStep, setTourStep] = useState(null);
  const [manualCutaway, setManualCutaway] = useState(false);
  const cutawayOpen = manualCutaway || tourStep === 1 || tourStep === 2;
  const tourHeadingRef = useRef(null);
  const tourStartRef = useRef(null);
  const hadTourRef = useRef(false);
  const tourOpen = tourStep !== null;
  useEffect(() => {
    if (tourOpen) tourHeadingRef.current?.focus({preventScroll: true});
    else if (hadTourRef.current) tourStartRef.current?.focus({preventScroll: true});
    hadTourRef.current = tourOpen;
  }, [tourOpen]);
  const [modelReady, setModelReady] = useState(false);
  const [selected, setSelected] = useState(null);
  
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState(null);
  const plantRootRef = useRef(null);
  const keyLightRef = useRef(null);
  const [groundY, setGroundY] = useState(0);
  const [groundScale, setGroundScale] = useState(120);
  const [siteBounds, setSiteBounds] = useState(null);
  const [shadowFar, setShadowFar] = useState(40);
  
  const [hasInteracted, setHasInteracted] = useState(false);
  

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

  /* Above 880px the info card is absolutely positioned over the right of the
     viewport, so the camera has to pan left to clear it; below that the card
     stacks under the model and a pan would just push the plant off-centre.
     880px is the same breakpoint the CSS uses — read through matchMedia rather
     than duplicated as a number here, so the two can never drift apart. */
  const [cardOverlays, setCardOverlays] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CARD_OVERLAY_QUERY).matches
  );
  useEffect(() => {
    const query = window.matchMedia(CARD_OVERLAY_QUERY);
    const update = () => setCardOverlays(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  /* How much of the canvas the card actually covers, measured rather than
     restated: its width is `min(410px, 38%)` plus a gutter in brand-system.css,
     so any number hard-coded here would drift silently the moment that CSS
     changes. offsetLeft/offsetWidth are deliberate — they ignore the card's
     translateX slide-in, so this measures where the card lands, not where its
     animation starts. The Rig frames the model inside what is left over. */
  const stageRef = useRef(null);
  const [cardOcclusion, setCardOcclusion] = useState(0);
  useLayoutEffect(() => {
    if (!selected || !cardOverlays) { setCardOcclusion(0); return; }
    const viewport = stageRef.current?.querySelector('.twin-viewport');
    const card = stageRef.current?.querySelector('.twin-detail, .twin-tour');
    if (!viewport || !card) return;
    const measure = () => {
      const width = viewport.offsetWidth;
      if (width) setCardOcclusion((viewport.offsetLeft + width - card.offsetLeft) / width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport); observer.observe(card);
    return () => observer.disconnect();
    // tourStep is a dependency because swapping the detail card for the tour
    // panel replaces the measured element without `selected` necessarily changing.
  }, [selected, cardOverlays, tourStep]);


  /* How much of the canvas the hero introduction covers on the left in the
     overview — measured, like the card, so the CSS columns can change without
     this drifting. Only counts when the copy really overlaps the viewport
     (the full-bleed desktop layout); stacked layouts measure 0. */
  const [copyOcclusion, setCopyOcclusion] = useState(0);
  useLayoutEffect(() => {
    const viewport = stageRef.current?.querySelector('.twin-viewport');
    const copy = document.getElementById('hero-copy');
    if (!viewport || !copy || !cardOverlays) { setCopyOcclusion(0); return; }
    const measure = () => {
      const v = viewport.getBoundingClientRect();
      const c = copy.getBoundingClientRect();
      if (!v.width) return;
      const overlapsVertically = c.bottom > v.top && c.top < v.bottom;
      const share = overlapsVertically ? (c.right - v.left) / v.width + 0.02 : 0;
      setCopyOcclusion(Math.min(MAX_COPY_OCCLUSION, Math.max(0, share)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport); observer.observe(copy);
    return () => observer.disconnect();
  }, [cardOverlays]);

  const handleReady = useCallback((plantRoot) => {
    setModelReady(true);
    const box = new THREE.Box3().setFromObject(plantRoot);
    const size = box.getSize(new THREE.Vector3());
    setGroundY(box.min.y - 0.02);

    setGroundScale(Math.max(size.x, size.z) * 1.3);
    setSiteBounds({ center: box.getCenter(new THREE.Vector3()), size });
    setShadowFar(Math.max(size.y * 4, 20));
  }, []);

  const handleSelect = useCallback((node) => {
    setManualCutaway(false);
    setTourStep(null);
    setSelected(node);
    setSelectedSubIndex(null);
    setCurrentLevel(1);
    setHasInteracted(true);
  }, []);
  const handleReset = useCallback(() => {
    setManualCutaway(false);
    setTourStep(null);
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
    setManualCutaway(false);
    setTourStep(null); setModelReady(false);
    
    try {
      useGLTF.clear(modelSrc);
    } catch (e) {
      
    }
    setSelected(null);
    setSelectedSubIndex(null);
    setCurrentLevel(0);
    setReloadKey((k) => k + 1);
  }, []);

  /* Uzak (CDN) kopya yüklenemediyse sessizce yerel kopyayla bir kez daha
     dene; kullanıcı sadece yüklemenin biraz uzadığını görür, hata ekranı
     görmez. Zaten yereldeysek false dönüp hatayı sınırın kendisine
     bırakıyoruz. */
  const handleLoadError = useCallback(() => {
    if (!fallBackToLocalModel()) return false;
    setModelReady(false);
    setReloadKey((k) => k + 1);
    return true;
  }, []);

  const handleCanvasCreated = useCallback(({ gl, invalidate }) => {
    gl.setClearColor(0x000000, 0);
    // Material clipping planes (the dome's vertical half-cut) need this on.
    gl.localClippingEnabled = true;
    // The frosted dome makes three re-render the scene into a transmission
    // target every frame. Half resolution is invisible behind roughness .3 and
    // keeps that second pass off the frame budget on this 230k-tri site.
    if ('transmissionResolutionScale' in gl) gl.transmissionResolutionScale = 0.5;
    /* Phase 105: a lost WebGL context is first given the chance to come back
       on its own — preventDefault() asks the browser to restore it, three
       re-initialises on `webglcontextrestored`, and a fresh shadow bake + one
       frame put the same scene back. Only if nothing comes back in a few
       seconds is the whole scene rebuilt (reloadKey), which re-parses the GLB
       and was what made every context hiccup look like a page reload. */
    const canvas = gl.domElement;
    const onLost = (event) => {
      event.preventDefault();
      console.warn('[IONA] WebGL bağlamı kayboldu — geri yüklenmesi bekleniyor.');
      const fallback = setTimeout(() => {
        console.warn('[IONA] WebGL bağlamı geri gelmedi — 3D sahne yeniden başlatılıyor.');
        setReloadKey((k) => k + 1);
      }, 3000);
      canvas.addEventListener('webglcontextrestored', () => {
        clearTimeout(fallback);
        gl.shadowMap.needsUpdate = true;
        invalidate();
      }, { once: true });
    };
    canvas.addEventListener('webglcontextlost', onLost);
  }, []);

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

  const goToStep = index => {
    const step = processSteps[index];
    const node = step && plantRootRef.current?.getObjectByName(step.node);
    if (!node) return;
    const opening = tourStep === null;
    setManualCutaway(false); setTourStep(index); setSelected(node); setSelectedSubIndex(null);
    setCurrentLevel(1); setHasInteracted(true);
    // On a phone the tour takes the whole screen, so bring the stage to it.
    if (opening && isMobileViewport) {
      requestAnimationFrame(() => stageRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth', block: 'center',
      }));
    }
  };
  return <div ref={stageRef} className={selected ? 'twin-surface is-inspecting' : 'twin-surface'}>
    <div className="min-w-0">
      <div className="twin-viewport">
        {/* Phase 101: the "Reaktörün içini aç" toggle and its legend are retired —
            clicking the digester itself opens it (x-ray shell + the dome's
            vertical half-cut). manualCutaway simply stays false. */}
        {/* Phase 99: the "Tesis nasıl çalışır?" process tour is retired — the
            button and its aside are gone; tourStep simply stays null. */}
        <TwinErrorBoundary resetKey={reloadKey} onRetry={handleRetry} onError={handleLoadError}>
          <Suspense fallback={<TwinLoading onRetry={handleRetry} />}>
            <Canvas key={reloadKey} shadows frameloop={visible ? 'demand' : 'never'}
              camera={{ fov: CAMERA_FOV, near: .1, far: 800, position: [100, 80, 100] }}
              dpr={isMobileViewport ? 1 : [1, 1.5]}
              gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
              onCreated={handleCanvasCreated} onPointerMissed={handleReset}>
              {/* A real studio HDRI does the lighting now — the hemisphere +
                  two-directional rig it replaces was what flattened the model,
                  because every surface got light from everywhere at once.
                  Served locally from public/hdri/ (same file drei's "studio"
                  preset would fetch from its CDN) so lighting never depends on
                  a third-party host being reachable. */}
              <Environment files="/hdri/studio_small_03_1k.hdr" environmentIntensity={1.05} />
              {/* One key light survives, and only to shape: a clay render with
                  no directional term has no form. Kept on keyLightRef because
                  Rig aims its shadow camera at the site bounds. */}
              <directionalLight ref={keyLightRef} position={[-60, 90, 50]} intensity={1.1} castShadow
                shadow-mapSize={isMobileViewport ? [1024, 1024] : [2048, 2048]}
                shadow-bias={-.00012} shadow-normalBias={.08} />
              <Model plantRootRef={plantRootRef} onReady={handleReady} onSelect={handleSelect} onReset={handleReset}
                selected={selected} cutawayOpen={cutawayOpen} flowActive={tourStep !== null && !reduceMotion ? processSteps[tourStep].flow : false} />
              <FeedPipeGapFill />
              <ReactorCutaway plantRootRef={plantRootRef} open={cutawayOpen} />
              <Rig cutawayOpen={cutawayOpen} plantRootRef={plantRootRef} selected={tourStep !== null ? null : selected} groundY={groundY} groundScale={groundScale} siteBounds={siteBounds} shadowFar={shadowFar} keyLightRef={keyLightRef} cardOverlays={cardOverlays} cardOcclusion={cardOcclusion} copyOcclusion={copyOcclusion} />
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
    {selected && tourStep === null && <DetailPanel structureKey={selected.name} subIndex={selectedSubIndex} onSelectSub={handleSelectSub}
      onBack={handleBackToStructure} onClose={handleReset} onReturnToParent={handleReturnToParent} />}
  </div>;
}



