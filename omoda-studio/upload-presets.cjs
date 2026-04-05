const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const presetsFolder = path.join(__dirname, 'new presets');

const presets = [
  { file: '54684_1_3000x3000.jpg', name: 'Max', gender: 'male', style: 'casual' },
  { file: '66195_1_3000x3000.jpg', name: 'Nina', gender: 'female', style: 'casual' },
  { file: '67264_1_3000x3000.jpg', name: 'Sophie', gender: 'female', style: 'elegant' },
  { file: '67505_1_3000x3000.jpg', name: 'Ryan', gender: 'male', style: 'street' },
  { file: '69940_1_3000x3000.jpg', name: 'Zara', gender: 'female', style: 'street' },
  { file: '69969_1_3000x3000.jpg', name: 'Luna', gender: 'female', style: 'street' },
  { file: '70237_1_3000x3000.jpg', name: 'Alex', gender: 'male', style: 'casual' },
  { file: '71197_1_3000x3000.jpg', name: 'Jake', gender: 'male', style: 'casual' },
  { file: '71214_1_3000x3000.jpg', name: 'Daniel', gender: 'male', style: 'elegant' },
  { file: '71418_1_3000x3000.jpg', name: 'Oliver', gender: 'male', style: 'elegant' },
  { file: '71753_1_3000x3000.jpg', name: 'Grace', gender: 'female', style: 'elegant' },
  { file: '81143_1_3000x3000.jpg', name: 'Eva', gender: 'female', style: 'casual' },
  { file: '81841_1_3000x3000.jpg', name: 'Tom', gender: 'male', style: 'street' },
];

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
  }
}

function serviceHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
    ...extra,
  };
}

async function uploadFile(fileName, fileBuffer) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/clothing-presets/${fileName}`,
    {
      method: 'POST',
      headers: serviceHeaders({
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      }),
      body: fileBuffer,
    },
  );

  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status}): ${await response.text()}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/clothing-presets/${fileName}`;
}

async function insertPreset(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/clothing_presets`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Preset insert failed (${response.status}): ${await response.text()}`);
  }
}

async function main() {
  assertEnv();

  for (const [index, preset] of presets.entries()) {
    const absolutePath = path.join(presetsFolder, preset.file);
    const fileBuffer = fs.readFileSync(absolutePath);
    const publicUrl = await uploadFile(preset.file, fileBuffer);

    await insertPreset({
      file_name: preset.file,
      file_url: publicUrl,
      title: preset.name,
      category: `${preset.gender}_${preset.style}`,
      order_index: index,
    });

    console.log(`Uploaded preset ${preset.name}: ${publicUrl}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
