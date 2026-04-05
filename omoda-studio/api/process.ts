const ANGLE_MODE_MARKER = '[ANGLE_MODE]';

type NullableString = string | null | undefined;

interface ClothingRecord {
  id: string;
  file_name: string;
  file_url: string;
  processed?: boolean;
  status?: string | null;
  error_message?: string | null;
  user_prompt?: NullableString;
  model_preset?: NullableString;
  preset_image_url?: NullableString;
  selfie_face_url?: NullableString;
  selfie_body_url?: NullableString;
}

interface ApiRequestLike {
  method?: string;
  body?: unknown;
}

interface ApiResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponseLike;
  json(payload: unknown): ApiResponseLike;
  sendStatus(code: number): ApiResponseLike;
  end(): void;
}

const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

function missingEnvKeys() {
  return ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'GEMINI_API_KEY'].filter(
    (key) => !CONFIG[key as keyof typeof CONFIG],
  );
}

function serviceHeaders(extra: Record<string, string> = {}) {
  const serviceKey = (CONFIG.SUPABASE_SERVICE_KEY || '').trim();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function parseJson<T>(response: Response, context: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${context} failed (${response.status}): ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function sbGet<T>(table: string, query: string): Promise<T> {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  return parseJson<T>(response, `Supabase GET ${table}`);
}

async function sbInsert<T>(table: string, payload: unknown): Promise<T> {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(payload),
  });
  return parseJson<T>(response, `Supabase INSERT ${table}`);
}

async function sbPatchById<T>(table: string, id: string, payload: unknown): Promise<T> {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(payload),
  });
  return parseJson<T>(response, `Supabase PATCH ${table}`);
}

async function downloadAsBase64(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    base64: buffer.toString('base64'),
    mimeType: response.headers.get('content-type') || 'image/jpeg',
  };
}

async function uploadToStorage(buffer: Buffer, filePath: string) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/${filePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${(CONFIG.SUPABASE_SERVICE_KEY || '').trim()}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status}): ${await response.text()}`);
  }

  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${filePath}`;
}

async function callGemini(prompt: string, images: Array<{ base64: string; mimeType: string }>): Promise<Buffer> {
  const parts = [{ text: prompt }, ...images.map((image) => ({
    inlineData: {
      mimeType: image.mimeType,
      data: image.base64,
    },
  }))];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.4,
        },
      }),
    },
  );

  if (response.status === 429 || response.status === 503) {
    const retryDelayMs = response.status === 503 ? 10000 : 15000;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return callGemini(prompt, images);
  }

  const json = await parseJson<{ candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> }>(
    response,
    'Gemini image generation',
  );
  const imageData = json?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;

  if (!imageData) {
    throw new Error('Gemini did not return an image payload.');
  }

  return Buffer.from(imageData, 'base64');
}

function buildPresetPrompt(clothing: ClothingRecord) {
  let prompt = `You are an advanced fashion virtual try-on AI.

Task:
Create a photorealistic full-body fashion image following these instructions.

Requirements:
- Image 1: Clothing item to be worn
- Image 2: Reference model
- Dress the model from Image 2 in the clothing from Image 1
- Accurately replicate the clothing's design, fit, length, folds, seams, texture, and material
- Ensure the clothing looks naturally worn and well-fitted, not pasted or floating
- Maintain the exact pose, facial features, expression, skin tone, and hair from Image 2
- Show the model in full height (head to toe), with no cropping
- Use a professional fashion model pose that clearly presents the clothing
- Place the model on a completely pure white background (#FFFFFF)
- Use soft, even studio lighting with clean, minimal shadows
- Maintain realistic skin texture, natural colors, and sharp focus
- Image resolution must be exactly 864 x 1232 pixels (portrait orientation)
- Keep the result suitable for a professional fashion catalog`;

  if (clothing.user_prompt?.trim()) {
    prompt += `\n\nADDITIONAL USER REQUIREMENTS:\n${clothing.user_prompt.trim()}`;
  }

  prompt += '\n\nOutput: One single ultra-realistic full-body fashion image on a pure white background.';
  return prompt;
}

function buildCustomPrompt(clothing: ClothingRecord) {
  let prompt = `You are an advanced fashion image-generation AI.

Task:
Using the clothing from Image 1 as the only reference, generate a photorealistic full-body fashion image.

Requirements:
- Generate a realistic human model with natural body proportions
- Dress the model exactly in the clothing from Image 1
- Accurately replicate the clothing's design, fit, length, folds, seams, texture, and material
- Ensure the clothing looks naturally worn and well-fitted, not pasted or floating
- Show the model in full height (head to toe), with no cropping
- Use a professional fashion model pose that clearly presents and advertises the clothing
- Place the model on a completely pure white background (#FFFFFF)
- Use soft, even studio lighting with clean, minimal shadows
- Maintain realistic skin texture, natural colors, and sharp focus
- Image resolution must be exactly 864 x 1232 pixels (portrait orientation)
- Keep the result suitable for a professional fashion catalog or e-commerce listing
- Avoid CGI, plastic skin, stylization, or artistic effects`;

  if (clothing.user_prompt?.trim()) {
    prompt += `\n\nADDITIONAL USER REQUIREMENTS:\n${clothing.user_prompt.trim()}`;
  }

  prompt += '\n\nOutput: One single ultra-realistic full-body fashion image on a pure white background.';
  return prompt;
}

function buildSelfiePrompt() {
  return `You are an advanced AI fashion virtual try-on system.

You receive THREE images:
- Image 1: A clothing item (the garment to be worn)
- Image 2: A close-up face photo of a real person
- Image 3: A full-body photo of the same real person

Your task:
Generate a single photorealistic full-body image of this exact real person wearing the clothing from Image 1.

Person requirements:
- Preserve the exact face from Image 2: facial features, skin tone, ethnicity, hair color, hair style, facial structure, eyes, nose, lips
- Use the body from Image 3 as reference for body shape, proportions, height, and build
- The result must look like the same real individual, not a generic model
- Do not beautify or idealize the person

Clothing requirements:
- Dress the person in the exact garment from Image 1
- Replicate every detail: design, color, pattern, texture, material, fit, cut, length, seams, buttons, zippers, prints
- The clothing must look naturally worn and fitted to this person's actual body

Image requirements:
- Full body visible from head to toe with no cropping
- Natural standing pose
- Pure white background (#FFFFFF)
- Soft even studio lighting
- Photorealistic sharp focus with natural colors
- Portrait orientation 864 x 1232 pixels
- No CGI look, no stylization

Output: One single ultra-realistic image of the real person wearing the garment on a pure white background.`;
}

async function getClothingRecord(imageId: string): Promise<ClothingRecord> {
  const delays = [0, 500, 1000, 2000, 3000, 3000];
  for (const delay of delays) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const records = await sbGet<ClothingRecord[]>('clothing_images', `id=eq.${imageId}&select=*`);
    if (Array.isArray(records) && records.length > 0) {
      return records[0];
    }
  }

  throw new Error(`Image record ${imageId} was not found.`);
}

async function markImageError(imageId: string, errorMessage: string) {
  try {
    await sbPatchById('clothing_images', imageId, {
      status: 'error',
      error_message: errorMessage,
      processed: false,
    });
  } catch (patchError) {
    console.error(`Failed to mark ${imageId} as error:`, patchError);
  }
}

async function processImage(imageId: string) {
  const clothing = await getClothingRecord(imageId);
  await sbPatchById('clothing_images', imageId, {
    processing_started_at: new Date().toISOString(),
    status: 'processing',
    error_message: null,
  });

  const isAngleMode = clothing.user_prompt?.startsWith(ANGLE_MODE_MARKER);
  let resultBuffer: Buffer;

  if (isAngleMode) {
    const clothingImage = await downloadAsBase64(clothing.file_url);
    const prompt = clothing.user_prompt?.replace(ANGLE_MODE_MARKER, '').trim() || '';
    resultBuffer = await callGemini(prompt, [clothingImage]);
  } else if (clothing.model_preset === 'user_selfie') {
    if (!clothing.selfie_face_url || !clothing.selfie_body_url) {
      throw new Error('Selfie mode requires both selfie_face_url and selfie_body_url.');
    }

    const [clothingImage, faceImage, bodyImage] = await Promise.all([
      downloadAsBase64(clothing.file_url),
      downloadAsBase64(clothing.selfie_face_url),
      downloadAsBase64(clothing.selfie_body_url),
    ]);

    resultBuffer = await callGemini(buildSelfiePrompt(), [clothingImage, faceImage, bodyImage]);
  } else if (clothing.model_preset) {
    let presetUrl = clothing.preset_image_url;
    if (!presetUrl) {
      const presets = await sbGet<Array<{ file_url: string }>>(
        'clothing_presets',
        `id=eq.${clothing.model_preset}&select=file_url`,
      );
      presetUrl = Array.isArray(presets) && presets.length > 0 ? presets[0].file_url : null;
    }

    if (!presetUrl) {
      throw new Error(`No preset image found for preset ${clothing.model_preset}.`);
    }

    const [clothingImage, presetImage] = await Promise.all([
      downloadAsBase64(clothing.file_url),
      downloadAsBase64(presetUrl),
    ]);

    resultBuffer = await callGemini(buildPresetPrompt(clothing), [clothingImage, presetImage]);
  } else {
    const clothingImage = await downloadAsBase64(clothing.file_url);
    resultBuffer = await callGemini(buildCustomPrompt(clothing), [clothingImage]);
  }

  const timestamp = Date.now();
  const baseName = (clothing.file_name || 'look').replace(/\.[^.]+$/, '');
  const newFilename = `model_${timestamp}_${baseName}.png`;
  const filePath = isAngleMode ? `clothing-angles/${newFilename}` : `clothing-output/${newFilename}`;
  const publicUrl = await uploadToStorage(resultBuffer, filePath);

  await sbInsert('generated_models', {
    original_image_id: imageId,
    file_name: newFilename,
    file_path: filePath,
    file_url: publicUrl,
    is_angle: isAngleMode,
  });

  await sbPatchById('clothing_images', imageId, {
    processed: true,
    status: 'completed',
    error_message: null,
  });

  return publicUrl;
}

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing = missingEnvKeys();
  if (missing.length) {
    return res.status(500).json({ error: `Missing environment variables: ${missing.join(', ')}` });
  }

  const imageId = typeof (req.body as { image_id?: unknown } | undefined)?.image_id === 'string'
    ? (req.body as { image_id: string }).image_id
    : null;

  if (!imageId) {
    return res.status(400).json({ error: 'Missing image_id' });
  }

  res.status(202).json({ status: 'processing', image_id: imageId });

  processImage(imageId).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    console.error(`Processing failed for ${imageId}:`, message);
    await markImageError(imageId, message);
  });
}
