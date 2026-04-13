import { waitUntil } from '@vercel/functions';

const ANGLE_MODE_MARKER = '[ANGLE_MODE]';
const GENERATION_OPTIONS_MARKER = '[OMODA_OPTIONS]';
const DEFAULT_BACKGROUND_PROMPT = 'Clean minimalist professional photo studio backdrop, soft light gray seamless cyclorama with a smooth wall-to-floor transition, uniform tone with no texture or gradients, high-key diffused lighting, a very subtle soft shadow beneath the subject, neutral contemporary aesthetic, distraction-free, premium catalog photography.';

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

interface GenerationOptions {
  modelPrompt: string | null;
  backgroundPrompt: string | null;
  backgroundImageUrl: string | null;
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
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

function parseGenerationOptions(userPrompt: NullableString): GenerationOptions {
  if (!userPrompt?.trim()) {
    return {
      modelPrompt: null,
      backgroundPrompt: DEFAULT_BACKGROUND_PROMPT,
      backgroundImageUrl: null,
    };
  }

  const trimmed = userPrompt.trim();
  if (!trimmed.startsWith(GENERATION_OPTIONS_MARKER)) {
    return {
      modelPrompt: trimmed,
      backgroundPrompt: DEFAULT_BACKGROUND_PROMPT,
      backgroundImageUrl: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed.slice(GENERATION_OPTIONS_MARKER.length)) as Partial<GenerationOptions>;
    return {
      modelPrompt: typeof parsed.modelPrompt === 'string' && parsed.modelPrompt.trim() ? parsed.modelPrompt.trim() : null,
      backgroundPrompt: typeof parsed.backgroundPrompt === 'string' && parsed.backgroundPrompt.trim()
        ? parsed.backgroundPrompt.trim()
        : DEFAULT_BACKGROUND_PROMPT,
      backgroundImageUrl: typeof parsed.backgroundImageUrl === 'string' && parsed.backgroundImageUrl.trim()
        ? parsed.backgroundImageUrl.trim()
        : null,
    };
  } catch {
    return {
      modelPrompt: trimmed.replace(GENERATION_OPTIONS_MARKER, '').trim() || null,
      backgroundPrompt: DEFAULT_BACKGROUND_PROMPT,
      backgroundImageUrl: null,
    };
  }
}

function resolveBackgroundPrompt(options: GenerationOptions) {
  return options.backgroundPrompt?.trim() || DEFAULT_BACKGROUND_PROMPT;
}

function buildPresetPrompt(options: GenerationOptions) {
  const backgroundPrompt = resolveBackgroundPrompt(options);
  let prompt = `You are an advanced fashion virtual try-on AI.

Task:
Create a photorealistic full-body fashion image following these instructions.

Requirements:
- Image 1: Outfit reference image. It may be a single garment photo, a multi-image reference sheet with up to three outfit references, or a photo of a person already wearing the desired clothing.
- Image 2: Reference model${options.backgroundImageUrl ? '\n- Image 3: Background reference image' : ''}
- Use Image 1 only as the clothing reference. If it contains a person, do not copy that person's identity, pose, body, or background.
- If Image 1 contains multiple garments or layered outfit references, combine them into one coherent final styled look.
- Dress the model from Image 2 in the clothing from Image 1.
- Accurately replicate the clothing's design, fit, length, folds, seams, texture, and material.
- Extract the desired clothing faithfully even when it is photographed on a hanger, flat lay, mannequin, or another person.
- Ensure the clothing looks naturally worn and well-fitted, not pasted or floating.
- Maintain the exact pose, facial features, expression, skin tone, and hair from Image 2.
- Show the model in full height (head to toe), with no cropping.
- Use a professional fashion model pose that clearly presents the clothing.
- Background scene: ${backgroundPrompt}
${options.backgroundImageUrl ? '- Match the environment, perspective, depth, and lighting direction from Image 3 while keeping the model and garment clearly visible.' : '- Build the requested environment naturally around the model while keeping the garment easy to evaluate.'}
- Maintain realistic skin texture, natural colors, and sharp focus.
- Image resolution must be exactly 864 x 1232 pixels (portrait orientation).
- Keep the result suitable for a professional fashion catalog or campaign image.`;

  if (options.modelPrompt) {
    prompt += `\n\nADDITIONAL USER REQUIREMENTS:\n${options.modelPrompt}`;
  }

  prompt += '\n\nOutput: One single ultra-realistic full-body fashion image with the requested background.';
  return prompt;
}

function buildCustomPrompt(options: GenerationOptions) {
  const backgroundPrompt = resolveBackgroundPrompt(options);
  let prompt = `You are an advanced fashion image-generation AI.

Task:
Using Image 1 as the outfit reference, generate a photorealistic full-body fashion image.${options.backgroundImageUrl ? '\nImage 2 is a background reference image.' : ''}

Requirements:
- Image 1 may be a single garment photo, a multi-image reference sheet with up to three outfit references, or a photo of a person already wearing the target outfit.
- Use Image 1 only as the clothing reference. If it contains a person, do not copy that person's face, body, pose, or environment.
- If Image 1 contains multiple garments or outfit references, combine them into one coherent layered final look.
- Generate a realistic human model with natural body proportions.
- Dress the model exactly in the clothing from Image 1.
- Accurately replicate the clothing's design, fit, length, folds, seams, texture, and material.
- Extract the desired outfit details faithfully even when the clothes are shown on a mannequin, hanger, flat lay, or another person.
- Ensure the clothing looks naturally worn and well-fitted, not pasted or floating.
- Show the model in full height (head to toe), with no cropping.
- Use a professional fashion model pose that clearly presents and advertises the clothing.
- Background scene: ${backgroundPrompt}
${options.backgroundImageUrl ? '- Match the environment, perspective, depth, and lighting direction from Image 2 while keeping the model and clothing in clear focus.' : '- Build the requested environment naturally around the model.'}
- Maintain realistic skin texture, natural colors, and sharp focus.
- Image resolution must be exactly 864 x 1232 pixels (portrait orientation).
- Keep the result suitable for a professional fashion catalog or e-commerce listing.
- Avoid CGI, plastic skin, stylization, or artistic effects.`;

  if (options.modelPrompt) {
    prompt += `\n\nADDITIONAL USER REQUIREMENTS:\n${options.modelPrompt}`;
  }

  prompt += '\n\nOutput: One single ultra-realistic full-body fashion image with the requested background.';
  return prompt;
}

function buildSelfiePrompt(options: GenerationOptions) {
  const backgroundPrompt = resolveBackgroundPrompt(options);
  const totalImages = options.backgroundImageUrl ? 'FOUR' : 'THREE';
  const backgroundImageLine = options.backgroundImageUrl ? '\n- Image 4: Background reference image' : '';
  const backgroundInstruction = options.backgroundImageUrl
    ? '- Reproduce the environment, lighting direction, perspective, and depth from Image 4. Keep the person sharp and fully visible.'
    : '- Build the requested environment naturally around the person while keeping the outfit clearly visible.';

  return `You are a photo-editing AI. You will perform a clothing swap on a real person's photo.

Inputs:
- Image 1: Close-up face photo of a real person. Memorise every detail of this face.
- Image 2: Full-body photo of the exact same person. This is the BASE photo you will edit.
- Image 3: New clothing to apply. Ignore anyone wearing it — extract only the garment.${backgroundImageLine}

Your job:
Take Image 2 and produce an edited version where the clothing has been swapped to the garment from Image 3. That is the only change. Everything else — the face, the hair, the skin, the body shape, the proportions — must be identical to Image 2.

Face rules (non-negotiable):
- The face in the output must be the same face as in Images 1 and 2. Same eyes (shape, color), same nose, same lips, same bone structure, same skin tone, same hair color and style.
- Use Image 1 as a high-resolution face reference to verify accuracy.
- Do not generate a new or generic face. Do not beautify or alter the face in any way.

Clothing rules:
- Extract the garment from Image 3 and fit it naturally onto the body from Image 2.
- Replicate all details: color, pattern, texture, fabric, cut, length, seams, fastenings.
- The garment must drape and crease as if actually worn — not pasted on.
- If Image 3 shows multiple garments, combine them into one look.

Background: ${backgroundPrompt}
${backgroundInstruction}

Output specs:
- Full body, head to toe, no cropping.
- 864 × 1232 pixels portrait.
- Photorealistic, no CGI, no smoothing, no stylisation.

Output: The edited photo — same person, same pose, new clothing only.`;
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
  const generationOptions = parseGenerationOptions(clothing.user_prompt);

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

    const imageInputs = await Promise.all([
      downloadAsBase64(clothing.selfie_face_url),
      downloadAsBase64(clothing.selfie_body_url),
      downloadAsBase64(clothing.file_url),
      ...(generationOptions.backgroundImageUrl ? [downloadAsBase64(generationOptions.backgroundImageUrl)] : []),
    ]);

    resultBuffer = await callGemini(buildSelfiePrompt(generationOptions), imageInputs);
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

    const imageInputs = await Promise.all([
      downloadAsBase64(clothing.file_url),
      downloadAsBase64(presetUrl),
      ...(generationOptions.backgroundImageUrl ? [downloadAsBase64(generationOptions.backgroundImageUrl)] : []),
    ]);

    resultBuffer = await callGemini(buildPresetPrompt(generationOptions), imageInputs);
  } else {
    const imageInputs = await Promise.all([
      downloadAsBase64(clothing.file_url),
      ...(generationOptions.backgroundImageUrl ? [downloadAsBase64(generationOptions.backgroundImageUrl)] : []),
    ]);
    resultBuffer = await callGemini(buildCustomPrompt(generationOptions), imageInputs);
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

  const processingTask = processImage(imageId).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    console.error(`Processing failed for ${imageId}:`, message);
    await markImageError(imageId, message);
  });

  waitUntil(processingTask);
  return res.status(202).json({ status: 'processing', image_id: imageId });
}
