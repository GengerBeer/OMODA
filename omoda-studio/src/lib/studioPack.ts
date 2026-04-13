function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchAssetBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export the generated asset.'));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function drawBitmapCover(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  alpha = 1,
) {
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const renderWidth = bitmap.width * scale;
  const renderHeight = bitmap.height * scale;
  const offsetX = (width - renderWidth) / 2;
  const offsetY = (height - renderHeight) / 2;

  context.save();
  context.globalAlpha = alpha;
  context.drawImage(bitmap, offsetX, offsetY, renderWidth, renderHeight);
  context.restore();
}

function drawBitmapContain(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const renderWidth = bitmap.width * scale;
  const renderHeight = bitmap.height * scale;
  const offsetX = x + (width - renderWidth) / 2;
  const offsetY = y + (height - renderHeight) / 2;

  context.fillStyle = '#ffffff';
  context.fillRect(x, y, width, height);
  context.drawImage(bitmap, offsetX, offsetY, renderWidth, renderHeight);
}

export async function createGarmentReferenceSheetFile(files: File[]) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, 3);
  if (imageFiles.length === 0) {
    throw new Error('No garment references were provided.');
  }

  if (imageFiles.length === 1) {
    return imageFiles[0];
  }

  const bitmaps = await Promise.all(imageFiles.map((file) => createImageBitmap(file)));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = 1800;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable in this browser.');
    }

    context.fillStyle = '#f4f4f2';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 56;
    const gap = 40;
    const topCellWidth = Math.round((canvas.width - padding * 2 - gap) / 2);
    const topCellHeight = 760;

    const slots = bitmaps.length === 2
      ? [
        { x: padding, y: padding, width: topCellWidth, height: canvas.height - padding * 2 },
        { x: padding + topCellWidth + gap, y: padding, width: topCellWidth, height: canvas.height - padding * 2 },
      ]
      : [
        { x: padding, y: padding, width: topCellWidth, height: topCellHeight },
        { x: padding + topCellWidth + gap, y: padding, width: topCellWidth, height: topCellHeight },
        {
          x: padding,
          y: padding + topCellHeight + gap,
          width: canvas.width - padding * 2,
          height: canvas.height - padding * 2 - topCellHeight - gap,
        },
      ];

    bitmaps.forEach((bitmap, index) => {
      const slot = slots[index];
      if (!slot) {
        return;
      }

      drawBitmapContain(context, bitmap, slot.x, slot.y, slot.width, slot.height);
    });

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.94);
    return new File([blob], `garment-reference-sheet-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

export async function createStudioPortraitBlob(imageUrl: string) {
  const sourceBlob = await fetchAssetBlob(imageUrl);
  const bitmap = await createImageBitmap(sourceBlob);

  try {
    // Output canvas: 4:5 portrait — matches standard catalog editorial ratio.
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1125;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable in this browser.');
    }

    // Source crop: 4:5 ratio, 78% of image width, top-aligned at 1.5% to keep
    // the head fully in frame. This captures head → mid-thigh (~67% of body height).
    const cropWidth = Math.round(bitmap.width * 0.78);
    const cropHeight = Math.round(cropWidth * (5 / 4));
    const cropX = Math.max(0, Math.round((bitmap.width - cropWidth) / 2));
    const cropY = Math.max(0, Math.min(Math.round(bitmap.height * 0.015), bitmap.height - cropHeight));

    context.fillStyle = '#f5f1ea';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

    return canvasToBlob(canvas, 'image/jpeg', 0.94);
  } finally {
    bitmap.close();
  }
}

function getPreferredVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

export async function createTurntableVideoBlob(imageUrls: string[]) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Turntable video export is not supported in this browser.');
  }

  const sourceBlobs = await Promise.all(imageUrls.map((url) => fetchAssetBlob(url)));
  const bitmaps = await Promise.all(sourceBlobs.map((blob) => createImageBitmap(blob)));

  try {
    const [firstBitmap] = bitmaps;
    if (!firstBitmap) {
      throw new Error('No frames were provided for the turntable video.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = firstBitmap.width;
    canvas.height = firstBitmap.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable in this browser.');
    }

    const fps = 12;
    const holdFrames = 5;
    const transitionFrames = 7;
    const frameDelayMs = 1000 / fps;
    const sequence = [...bitmaps, bitmaps[bitmaps.length - 2], bitmaps[bitmaps.length - 3], bitmaps[0]].filter(Boolean);

    const stream = canvas.captureStream(fps);
    const mimeType = getPreferredVideoMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => reject(new Error('Turntable video generation failed.'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    });

    const drawFrame = (bitmap: ImageBitmap, alpha = 1) => {
      context.fillStyle = '#f5f1ea';
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawBitmapCover(context, bitmap, canvas.width, canvas.height, alpha);
    };

    recorder.start();

    for (let index = 0; index < sequence.length - 1; index += 1) {
      const current = sequence[index];
      const next = sequence[index + 1];

      for (let frame = 0; frame < holdFrames; frame += 1) {
        drawFrame(current);
        await wait(frameDelayMs);
      }

      for (let frame = 0; frame < transitionFrames; frame += 1) {
        const progress = (frame + 1) / transitionFrames;
        drawFrame(current);
        drawBitmapCover(context, next, canvas.width, canvas.height, progress);
        await wait(frameDelayMs);
      }
    }

    for (let frame = 0; frame < holdFrames + 2; frame += 1) {
      drawFrame(sequence[sequence.length - 1]);
      await wait(frameDelayMs);
    }

    recorder.stop();
    const videoBlob = await finished;
    stream.getTracks().forEach((track) => track.stop());
    return videoBlob;
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}
