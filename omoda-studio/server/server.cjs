const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));

const ANGLE_MODE_MARKER = '[ANGLE_MODE]';
const GENERATION_OPTIONS_MARKER = '[OMODA_OPTIONS]';
const DEFAULT_BACKGROUND_PROMPT = 'Clean minimalist professional photo studio backdrop, soft light gray seamless cyclorama with a smooth wall-to-floor transition, uniform tone with no texture or gradients, high-key diffused lighting, a very subtle soft shadow beneath the subject, neutral contemporary aesthetic, distraction-free, premium catalog photography.';

const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PORT: Number(process.env.PORT || 3001),
};

const REQUIRED_ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'GEMINI_API_KEY'];
const missingEnv = REQUIRED_ENV_KEYS.filter((key) => !CONFIG[key]);

function assertConfig() {
  if (missingEnv.length) {
    throw new Error(`Missing environment variables: ${missingEnv.join(', ')}`);
  }
}

function serviceHeaders(extra = {}) {
  const serviceKey = CONFIG.SUPABASE_SERVICE_KEY.trim();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function parseJson(response, context) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${context} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function sbGet(table, query) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  return parseJson(response, `Supabase GET ${table}`);
}

async function sbInsert(table, payload) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, `Supabase INSERT ${table}`);
}

async function sbPatchById(table, id, payload) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, `Supabase PATCH ${table}`);
}

async function downloadAsBase64(url) {
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

async function uploadToStorage(buffer, filePath) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/${filePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.SUPABASE_SERVICE_KEY.trim()}`,
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

async function callGemini(prompt, images) {
  const parts = [{ text: prompt }];
  for (const image of images) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64,
      },
    });
  }

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

  const json = await parseJson(response, 'Gemini image generation');
  const imagePart = json?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);

  if (!imagePart) {
    throw new Error('Gemini did not return an image payload.');
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

function parseGenerationOptions(userPrompt) {
  if (!userPrompt || !userPrompt.trim()) {
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
    const parsed = JSON.parse(trimmed.slice(GENERATION_OPTIONS_MARKER.length));
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

function resolveBackgroundPrompt(options) {
  return options.backgroundPrompt?.trim() || DEFAULT_BACKGROUND_PROMPT;
}

function buildPresetPrompt(options) {
  const backgroundPrompt = resolveBackgroundPrompt(options);
  let prompt = `You are an advanced fashion virtual try-on AI.

Task:
Create a photorealistic full-body fashion image following these instructions.

Requirements:
- Image 1: Clothing item to be worn
- Image 2: Reference model${options.backgroundImageUrl ? '\n- Image 3: Background reference image' : ''}
- Dress the model from Image 2 in the clothing from Image 1
- Accurately replicate the clothing's design, fit, length, folds, seams, texture, and material
- Ensure the clothing looks naturally worn and well-fitted, not pasted or floating
- Maintain the exact pose, facial features, expression, skin tone, and hair from Image 2
- Show the model in full height (head to toe), with no cropping
- Use a professional fashion model pose that clearly presents the clothing
- Background scene: ${backgroundPrompt}
${options.backgroundImageUrl ? '- Match the environment, perspective, depth, and lighting direction from Image 3 while keeping the model and garment clearly visible' : '- Build the requested environment naturally around the model while keeping the garment easy to evaluate'}
- Maintain realistic skin texture, natural colors, and sharp focus
- Image resolution must be exactly 864 x 1232 pixels (portrait orientation)
- Keep the result suitable for a professional fashion catalog or campaign image`;

  if (options.modelPrompt) {
    prompt += `\n\nADDITIONAL USER REQUIREMENTS:\n${options.modelPrompt}`;
  }

  prompt += '\n\nOutput: One single ultra-realistic full-body fashion image with the requested background.';
  return prompt;
}

function buildCustomPrompt(options) {
  const backgroundPrompt = resolveBackgroundPrompt(options);
  let prompt = `You are an advanced fashion image-generation AI.

Task:
Using the clothing from Image 1 as the only garment reference, generate a photorealistic full-body fashion image.${options.backgroundImageUrl ? '\nImage 2 is a background reference image.' : ''}

Requirements:
- Generate a realistic human model with natural body proportions
- Dress the model exactly in the clothing from Image 1
- Accurately replicate the clothing's design, fit, length, folds, seams, texture, and material
- Ensure the clothing looks naturally worn and well-fitted, not pasted or floating
- Show the model in full height (head to toe), with no cropping
- Use a professional fashion model pose that clearly presents and advertises the clothing
- Background scene: ${backgroundPrompt}
${options.backgroundImageUrl ? '- Match the environment, perspective, depth, and lighting direction from Image 2 while keeping the model and clothing in clear focus' : '- Build the requested environment naturally around the model'}
- Maintain realistic skin texture, natural colors, and sharp focus
- Image resolution must be exactly 864 x 1232 pixels (portrait orientation)
- Keep the result suitable for a professional fashion catalog or e-commerce listing
- Avoid CGI, plastic skin, stylization, or artistic effects`;

  if (options.modelPrompt) {
    prompt += `\n\nADDITIONAL USER REQUIREMENTS:\n${options.modelPrompt}`;
  }

  prompt += '\n\nOutput: One single ultra-realistic full-body fashion image with the requested background.';
  return prompt;
}

function buildSelfiePrompt(options) {
  const backgroundPrompt = resolveBackgroundPrompt(options);
  const totalImages = options.backgroundImageUrl ? 'FOUR' : 'THREE';
  const backgroundImageLine = options.backgroundImageUrl ? '\n- Image 4: Background reference image' : '';
  const backgroundInstruction = options.backgroundImageUrl
    ? '- Match the environment, perspective, depth, and lighting direction from Image 4 while keeping the person fully visible and realistic'
    : '- Build the requested environment naturally around the person while keeping the clothing clearly visible';

  return `You are an advanced AI fashion virtual try-on system.

You receive ${totalImages} images:
- Image 1: A clothing item (the garment to be worn)
- Image 2: A close-up face photo of a real person
- Image 3: A full-body photo of the same real person${backgroundImageLine}

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
- Background scene: ${backgroundPrompt}
${backgroundInstruction}
- Photorealistic sharp focus with natural colors
- Portrait orientation 864 x 1232 pixels
- No CGI look, no stylization

Output: One single ultra-realistic image of the real person wearing the garment in the requested background.`;
}

async function getClothingRecord(imageId) {
  const delays = [0, 500, 1000, 2000, 3000, 3000];
  for (const delay of delays) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const records = await sbGet('clothing_images', `id=eq.${imageId}&select=*`);
    if (Array.isArray(records) && records.length > 0) {
      return records[0];
    }
  }

  throw new Error(`Image record ${imageId} was not found.`);
}

async function markImageError(imageId, errorMessage) {
  try {
    await sbPatchById('clothing_images', imageId, {
      status: 'error',
      error_message: errorMessage,
      processed: false,
    });
  } catch (patchError) {
    console.error(`Failed to mark ${imageId} as error:`, patchError.message);
  }
}

async function processImage(imageId) {
  assertConfig();

  const clothing = await getClothingRecord(imageId);
  const generationOptions = parseGenerationOptions(clothing.user_prompt);

  await sbPatchById('clothing_images', imageId, {
    processing_started_at: new Date().toISOString(),
    status: 'processing',
    error_message: null,
  });

  const isAngleMode = clothing.user_prompt?.startsWith(ANGLE_MODE_MARKER);
  let resultBuffer;

  if (isAngleMode) {
    const clothingImage = await downloadAsBase64(clothing.file_url);
    const prompt = clothing.user_prompt.replace(ANGLE_MODE_MARKER, '').trim();
    resultBuffer = await callGemini(prompt, [clothingImage]);
  } else if (clothing.model_preset === 'user_selfie') {
    if (!clothing.selfie_face_url || !clothing.selfie_body_url) {
      throw new Error('Selfie mode requires both selfie_face_url and selfie_body_url.');
    }

    const imageInputs = await Promise.all([
      downloadAsBase64(clothing.file_url),
      downloadAsBase64(clothing.selfie_face_url),
      downloadAsBase64(clothing.selfie_body_url),
      ...(generationOptions.backgroundImageUrl ? [downloadAsBase64(generationOptions.backgroundImageUrl)] : []),
    ]);

    resultBuffer = await callGemini(buildSelfiePrompt(generationOptions), imageInputs);
  } else if (clothing.model_preset) {
    let presetUrl = clothing.preset_image_url;
    if (!presetUrl) {
      const presets = await sbGet('clothing_presets', `id=eq.${clothing.model_preset}&select=file_url`);
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
  const filePath = isAngleMode
    ? `clothing-angles/${newFilename}`
    : `clothing-output/${newFilename}`;
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

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

async function queueImageProcessing(req, res) {
  const { image_id: imageId } = req.body ?? {};
  if (!imageId) {
    return res.status(400).json({ error: 'Missing image_id' });
  }

  if (missingEnv.length) {
    return res.status(500).json({ error: `Server is missing environment variables: ${missingEnv.join(', ')}` });
  }

  res.status(202).json({ status: 'processing', image_id: imageId });

  processImage(imageId).catch(async (error) => {
    console.error(`Processing failed for ${imageId}:`, error.message);
    await markImageError(imageId, error.message);
  });
}

app.post(['/webhook/process', '/webhook/omoda-process'], queueImageProcessing);

app.get('/health', (_req, res) => {
  res.json({
    status: missingEnv.length ? 'degraded' : 'ok',
    time: new Date().toISOString(),
    missingEnv,
  });
});

app.get('/ping', (_req, res) => {
  res.send('pong');
});

app.listen(CONFIG.PORT, () => {
  if (missingEnv.length) {
    console.warn(`OMODA STUDIO backend started with missing env: ${missingEnv.join(', ')}`);
  }
  console.log(`OMODA STUDIO backend listening on http://localhost:${CONFIG.PORT}`);
});
