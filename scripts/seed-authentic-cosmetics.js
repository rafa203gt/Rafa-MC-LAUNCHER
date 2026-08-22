import fs from 'node:fs';
import path from 'node:path';
import { generateCapePNG } from './generate-authentic-cosmetics.js';
import { createClient } from '@supabase/supabase-js';

// Load .env
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Guardar texturas en la carpeta pública del launcher y del admin panel
const publicCosmeticsDirLauncher = path.join(process.cwd(), 'dist', 'cosmetics');
const publicCosmeticsDirAdmin = path.join(process.cwd(), 'admin-panel', 'public', 'cosmetics');

[publicCosmeticsDirLauncher, publicCosmeticsDirAdmin].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function saveTexture(theme, filename) {
  const buf = generateCapePNG(theme);
  [publicCosmeticsDirLauncher, publicCosmeticsDirAdmin].forEach((dir) => {
    fs.writeFileSync(path.join(dir, filename), buf);
  });
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const authenticItems = [
  // 🌟 EXCLUSIVOS RAFA LAUNCHER
  {
    id: 'cape-rafa-champions',
    name: 'Capa Rafa Champions Esmeralda',
    description: 'Capa oficial de campeonato con emblema R dorado sobre fondo esmeralda y ribetes de oro.',
    category: 'cape',
    rarity: 'legendary',
    price: 1000,
    theme: 'rafa-champions',
    model_type: 'standard',
    is_featured: true,
    is_active: true
  },
  {
    id: 'cape-rafa-vip-gold',
    name: 'Capa Rafa VIP Gold Edition',
    description: 'Edición de lujo en obsidiana negra con alas doradas bordadas para miembros VIP.',
    category: 'cape',
    rarity: 'legendary',
    price: 850,
    theme: 'rafa-vip-gold',
    model_type: 'standard',
    is_featured: true,
    is_active: true
  },
  {
    id: 'cape-rafa-matrix-cyber',
    name: 'Capa Rafa Cyber Matrix',
    description: 'Cascada digital de código verde neón en movimiento perpetuo.',
    category: 'cape',
    rarity: 'epic',
    price: 500,
    theme: 'rafa-matrix',
    model_type: 'standard',
    is_featured: true,
    is_active: true
  },
  {
    id: 'cape-dragon-flame',
    name: 'Capa Furia del Dragón Ígneo',
    description: 'Textura de llamas vivas y escamas de dragón forjadas en lava del Nether.',
    category: 'cape',
    rarity: 'epic',
    price: 450,
    theme: 'dragon-flame',
    model_type: 'standard',
    is_featured: false,
    is_active: true
  },
  {
    id: 'cape-galaxy-nebula',
    name: 'Capa Nebulosa Cósmica',
    description: 'Polvo estelar púrpura y azul profundo con estrellas plateadas.',
    category: 'cape',
    rarity: 'rare',
    price: 300,
    theme: 'galaxy-nebula',
    model_type: 'standard',
    is_featured: true,
    is_active: true
  },
  {
    id: 'cape-ice-glacier',
    name: 'Capa Glaciar Eterno',
    description: 'Cristales de hielo tallados que reflejan destellos árticos.',
    category: 'cape',
    rarity: 'rare',
    price: 250,
    theme: 'ice-glacier',
    model_type: 'standard',
    is_featured: false,
    is_active: true
  },
  {
    id: 'cape-anime-akatsuki',
    name: 'Capa Akatsuki Nube Carmesí',
    description: 'Diseño icónico con la nube roja carmesí delineada sobre tela negra profunda.',
    category: 'cape',
    rarity: 'epic',
    price: 500,
    theme: 'anime-akatsuki',
    model_type: 'standard',
    is_featured: true,
    is_active: true
  },
  {
    id: 'cape-anime-demon-slayer',
    name: 'Capa Cazador Cuadros Verde',
    description: 'Patrón geométrico de cuadros verde esmeralda y negro de cazador.',
    category: 'cape',
    rarity: 'rare',
    price: 350,
    theme: 'anime-demon-slayer',
    model_type: 'standard',
    is_featured: false,
    is_active: true
  },

  // 🪽 ALAS 3D FUNCIONALES
  {
    id: 'wings-dragon-void',
    name: 'Alas de Dragón del Vacío 3D',
    description: 'Alas 3D articuladas del dragón del End con aleteo dinámico en tiempo real.',
    category: 'wings',
    rarity: 'legendary',
    price: 900,
    theme: 'galaxy-nebula',
    model_type: 'dragon',
    is_featured: true,
    is_active: true
  },
  {
    id: 'wings-angel-pure',
    name: 'Alas de Arcángel Divino 3D',
    description: 'Imponentes alas de plumas blancas puras con resplandor dorado.',
    category: 'wings',
    rarity: 'legendary',
    price: 850,
    theme: 'rafa-vip-gold',
    model_type: 'angel',
    is_featured: true,
    is_active: true
  },
  {
    id: 'wings-phoenix-fire',
    name: 'Alas de Fénix Ígneo 3D',
    description: 'Plumas ardientes que desprenden ascuas de fuego al volar.',
    category: 'wings',
    rarity: 'epic',
    price: 600,
    theme: 'dragon-flame',
    model_type: 'dragon',
    is_featured: false,
    is_active: true
  },
  {
    id: 'wings-mecha-neon',
    name: 'Alas Cyber Mecha Neón 3D',
    description: 'Propulsores holográficos de plasma con estructura de fibra de carbono.',
    category: 'wings',
    rarity: 'epic',
    price: 550,
    theme: 'rafa-matrix',
    model_type: 'mecha',
    is_featured: false,
    is_active: true
  },

  // 👑 SOMBREROS Y CORONAS 3D
  {
    id: 'hat-king-crown',
    name: 'Corona Imperial de Oro 3D',
    description: 'Corona de oro macizo engastada con rubíes y esmeraldas.',
    category: 'hat',
    rarity: 'legendary',
    price: 750,
    theme: 'rafa-vip-gold',
    model_type: 'crown',
    is_featured: true,
    is_active: true
  },
  {
    id: 'hat-celestial-halo',
    name: 'Halo Celestial Sagrado 3D',
    description: 'Aro de luz dorada flotante que gira suavemente sobre la cabeza.',
    category: 'hat',
    rarity: 'epic',
    price: 450,
    theme: 'rafa-vip-gold',
    model_type: 'halo',
    is_featured: true,
    is_active: true
  },
  {
    id: 'hat-cat-ears-black',
    name: 'Orejas de Gato Neko Negras 3D',
    description: 'Adorables orejas de gato negras con interior rosa suave.',
    category: 'hat',
    rarity: 'rare',
    price: 200,
    theme: 'anime-akatsuki',
    model_type: 'catears',
    is_featured: false,
    is_active: true
  },
  {
    id: 'hat-demon-horns',
    name: 'Cuernos de Demonio Carmesí 3D',
    description: 'Cuernos de obsidiana con puntas ardientes al rojo vivo.',
    category: 'hat',
    rarity: 'epic',
    price: 400,
    theme: 'dragon-flame',
    model_type: 'horns',
    is_featured: false,
    is_active: true
  },

  // 🕶️ BANDANAS Y MÁSCARAS 3D
  {
    id: 'bandana-ninja-shadow',
    name: 'Bandana Ninja de las Sombras 3D',
    description: 'Bandana de tela oscura tradicional japonesa con emblema táctico.',
    category: 'bandana',
    rarity: 'rare',
    price: 200,
    theme: 'anime-akatsuki',
    model_type: 'bandana',
    is_featured: false,
    is_active: true
  },
  {
    id: 'bandana-oni-demon',
    name: 'Máscara Oni Japonesa 3D',
    description: 'Máscara de demonio Oni con colmillos dorados y detalles carmesí.',
    category: 'bandana',
    rarity: 'epic',
    price: 380,
    theme: 'dragon-flame',
    model_type: 'mask',
    is_featured: true,
    is_active: true
  },
  {
    id: 'bandana-cyber-visor',
    name: 'Visor Holográfico Cyber HUD 3D',
    description: 'Lente táctica con interfaz de combate cyan neón.',
    category: 'bandana',
    rarity: 'epic',
    price: 400,
    theme: 'rafa-matrix',
    model_type: 'visor',
    is_featured: false,
    is_active: true
  },
  {
    id: 'bandana-thug-glasses',
    name: 'Gafas Thug Life Pixel 3D',
    description: 'Gafas de sol negras pixeladas estilo meme legendario.',
    category: 'bandana',
    rarity: 'rare',
    price: 220,
    theme: 'anime-demon-slayer',
    model_type: 'glasses',
    is_featured: false,
    is_active: true
  }
];

async function run() {
  console.log('🚀 Limpiando cosméticos obsoletos y sembrando items reales y funcionales...');

  // 1. Limpiar catálogo actual
  const { error: delErr } = await supabase.from('shop_cosmetics').delete().neq('id', '');
  if (delErr) {
    console.warn('Nota al limpiar:', delErr.message);
  }

  // 2. Generar texturas reales y subir a Supabase
  const payload = authenticItems.map((item) => {
    const filename = `${item.id}.png`;
    const textureBase64 = saveTexture(item.theme, filename);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      rarity: item.rarity,
      price: item.price,
      texture_url: textureBase64,
      model_type: item.model_type,
      is_animated: false,
      is_featured: item.is_featured,
      is_active: true
    };
  });

  const { error: insErr } = await supabase.from('shop_cosmetics').insert(payload);
  if (insErr) {
    console.error('Error insertando cosméticos:', insErr.message);
    process.exit(1);
  }

  console.log(`✅ ¡${payload.length} cosméticos reales y 100% funcionales sembrados con éxito!`);
}

run();
