import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GarmentUpload } from '@/components/GarmentUpload';
import { SiteFooter } from '@/components/SiteFooter';
import { ModelPresetGrid } from '@/components/ModelPresetGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { createGarmentReferenceSheetFile, createStudioPortraitBlob, downloadBlob } from '@/lib/studioPack';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  Check,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

const ANGLE_MODE_MARKER = '[ANGLE_MODE]';
const GENERATION_OPTIONS_MARKER = '[OMODA_OPTIONS]';
const POLLING_INTERVAL = 2000;
const DEFAULT_BACKGROUND_PROMPT = 'Clean minimalist professional photo studio backdrop, soft light gray seamless cyclorama with a smooth wall-to-floor transition, uniform tone with no texture or gradients, high-key diffused lighting, a very subtle soft shadow beneath the subject, neutral contemporary aesthetic, distraction-free, premium catalog photography.';

const ANGLE_VARIANTS = [
  {
    key: 'front',
    label: 'Front View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show the FRONT VIEW.
Preserve the same face, proportions, clothing details, background scene and lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
  {
    key: 'side',
    label: 'Side View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show a clean SIDE VIEW profile.
Preserve the same face, proportions, clothing details, background scene and lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
  {
    key: 'back',
    label: 'Back View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show the BACK VIEW.
Preserve the body proportions, garment details, background scene and lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
  {
    key: 'three_quarter',
    label: '3/4 View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show a 3/4 angle.
Preserve the same face, proportions, clothing details, background scene and lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
];

type GenerationMode = 'preset' | 'selfie';

interface AngleResult {
  key: string;
  label: string;
  url: string | null;
  loading: boolean;
  error: boolean;
}

interface HistoryItem {
  id: string;
  createdAt: string;
  modeLabel: string;
  resultUrl: string;
}

interface GarmentReferenceItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

function buildWebhookUrl() {
  const configuredBase = import.meta.env.VITE_BACKEND_URL || '/api/process';
  return configuredBase.endsWith('/webhook/process')
    || configuredBase.endsWith('/api/process')
    ? configuredBase
    : `${configuredBase.replace(/\/$/, '')}/webhook/process`;
}

function sanitizeFileName(file: File) {
  return file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
}

function revokePreview(url: string | null) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

async function downloadImage(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

async function uploadIncomingFile(file: File, prefix: string) {
  const fileName = `${prefix}_${Date.now()}_${sanitizeFileName(file)}`;
  const { error } = await supabase.storage.from('clothing-incoming').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('clothing-incoming').getPublicUrl(fileName);
  return { fileName, publicUrl: data.publicUrl };
}

interface GenerationOptionsPayload {
  modelPrompt: string | null;
  backgroundPrompt: string | null;
  backgroundImageUrl: string | null;
}

function buildGenerationOptionsPayload(options: GenerationOptionsPayload) {
  return `${GENERATION_OPTIONS_MARKER}${JSON.stringify(options)}`;
}

export default function Index() {
  const user: { id: string; email?: string | null } | null = null;
  const profile: {
    avatar_url?: string | null;
    full_name?: string | null;
    generations_used?: number;
    generations_limit?: number;
  } | null = null;
  const loading = false;
  const refetchProfile = () => {};

  const [mode, setMode] = useState<GenerationMode>('preset');
  const [garmentReferences, setGarmentReferences] = useState<GarmentReferenceItem[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customModelPrompt, setCustomModelPrompt] = useState('');
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [bodyFile, setBodyFile] = useState<File | null>(null);
  const [bodyPreview, setBodyPreview] = useState<string | null>(null);
  const [backgroundDescription, setBackgroundDescription] = useState(DEFAULT_BACKGROUND_PROMPT);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [currentGenerationMode, setCurrentGenerationMode] = useState<GenerationMode>('preset');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const [angleResults, setAngleResults] = useState<AngleResult[]>([]);
  const [isGeneratingAngles, setIsGeneratingAngles] = useState(false);
  const [anglePollingIds, setAnglePollingIds] = useState<Record<string, string>>({});
  const [portraitCropBlob, setPortraitCropBlob] = useState<Blob | null>(null);
  const [portraitCropUrl, setPortraitCropUrl] = useState<string | null>(null);
  const [isPreparingPortraitCrop, setIsPreparingPortraitCrop] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const anglesRef = useRef<HTMLDivElement>(null);
  const generatedPortraitRef = useRef<string | null>(null);
  const garmentReferencesRef = useRef<GarmentReferenceItem[]>([]);

  const canGeneratePreset = garmentReferences.length > 0 && (!!selectedPreset || !!customModelPrompt.trim());
  const canGenerateSelfie = garmentReferences.length > 0 && !!faceFile && !!bodyFile;
  const canGenerate = mode === 'preset' ? canGeneratePreset : canGenerateSelfie;
  const completedAngleCount = angleResults.filter((item) => !!item.url).length;
  const hasPendingAngles = Object.keys(anglePollingIds).length > 0;

  const generationSummary = useMemo(() => {
    if (mode === 'preset') {
      return {
        title: 'Preset and custom model mode',
        description: 'Upload up to three outfit references, describe your own model, and control the background with text or a reference image.',
      };
    }

    return {
      title: 'On-yourself mode',
      description: 'Upload up to three outfit references plus your face and full-body photos, then describe the background or attach a background reference image.',
    };
  }, [mode]);

  const handleGarmentUpload = useCallback((files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Please paste or choose image files.');
      return;
    }

    const availableSlots = Math.max(0, 3 - garmentReferences.length);
    if (availableSlots === 0) {
      toast.error('You can upload up to 3 outfit references.');
      return;
    }

    const acceptedFiles = imageFiles.slice(0, availableSlots);
    if (imageFiles.length > acceptedFiles.length) {
      toast.error('Only the first 3 outfit references are kept.');
    }

    setGarmentReferences((previous) => [
      ...previous,
      ...acceptedFiles.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      })),
    ]);
  }, [garmentReferences.length]);

  const handleGarmentClear = useCallback((id?: string) => {
    setGarmentReferences((previous) => {
      if (!id) {
        previous.forEach((item) => revokePreview(item.previewUrl));
        return [];
      }

      const target = previous.find((item) => item.id === id);
      if (target) {
        revokePreview(target.previewUrl);
      }

      return previous.filter((item) => item.id !== id);
    });
  }, []);

  const handlePreviewFile = useCallback((
    file: File | null | undefined,
    previousPreview: string | null,
    setFile: (value: File | null) => void,
    setPreview: (value: string | null) => void,
  ) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    revokePreview(previousPreview);
    setFile(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  const replacePortraitAsset = useCallback((nextBlob: Blob | null) => {
    setPortraitCropBlob(nextBlob);
    const nextUrl = nextBlob ? URL.createObjectURL(nextBlob) : null;
    revokePreview(generatedPortraitRef.current);
    generatedPortraitRef.current = nextUrl;
    setPortraitCropUrl(nextUrl);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);

    try {
      const { data: images, error } = await supabase
        .from('clothing_images')
        .select('id, uploaded_at, user_prompt, model_preset')
        .eq('user_id', user.id)
        .eq('processed', true)
        .order('uploaded_at', { ascending: false })
        .limit(30);

      if (error) {
        throw error;
      }

      const filteredImages = (images ?? []).filter(
        (item) => !item.user_prompt?.startsWith(ANGLE_MODE_MARKER),
      );

      const historyItems = await Promise.all(
        filteredImages.map(async (item) => {
          const { data: result, error: resultError } = await supabase
            .from('generated_models')
            .select('file_url')
            .eq('original_image_id', item.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (resultError || !result?.file_url) {
            return null;
          }

          const modeLabel = item.model_preset === 'user_selfie'
            ? 'On Yourself'
            : item.model_preset
              ? 'Preset'
              : 'Custom';

          return {
            id: item.id,
            createdAt: item.uploaded_at,
            modeLabel,
            resultUrl: result.file_url,
          };
        }),
      );

      setHistory(historyItems.filter(Boolean) as HistoryItem[]);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    garmentReferencesRef.current = garmentReferences;
  }, [garmentReferences]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!currentImageId || !isPolling) {
      return;
    }

    const pollResult = async () => {
      try {
        const { data, error } = await supabase
          .from('clothing_images')
          .select('processed, status, error_message')
          .eq('id', currentImageId)
          .single();

        if (error) {
          throw error;
        }

        if (data?.status === 'error') {
          setIsPolling(false);
          setIsGenerating(false);
          setGenerationError(data.error_message || 'The generation failed.');
          toast.error('Generation failed. Please retry.');
          return;
        }

        if (!data?.processed) {
          return;
        }

        const { data: result, error: resultError } = await supabase
          .from('generated_models')
          .select('file_url')
          .eq('original_image_id', currentImageId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (resultError || !result?.file_url) {
          return;
        }

        setResultUrl(result.file_url);
        setIsPolling(false);
        setIsGenerating(false);
        setGenerationError(null);

        if (currentGenerationMode === 'selfie' && user && profile) {
          await supabase
            .from('user_profiles')
            .update({ generations_used: (profile.generations_used ?? 0) + 1 })
            .eq('id', user.id);
          refetchProfile();
        }

        void loadHistory();
        toast.success('Base render ready. OMODA STUDIO is preparing the catalog crop.');

        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      } catch (error) {
        console.error('Polling failed:', error);
      }
    };

    void pollResult();
    const interval = window.setInterval(() => {
      void pollResult();
    }, POLLING_INTERVAL);

    return () => window.clearInterval(interval);
  }, [currentGenerationMode, currentImageId, isPolling, loadHistory, profile, refetchProfile, user]);

  useEffect(() => {
    const pendingAngles = Object.entries(anglePollingIds);
    if (pendingAngles.length === 0) {
      return;
    }

    const pollAngles = async () => {
      for (const [angleKey, imageId] of pendingAngles) {
        try {
          const { data, error } = await supabase
            .from('clothing_images')
            .select('processed, status')
            .eq('id', imageId)
            .single();

          if (error) {
            throw error;
          }

          if (data?.status === 'error') {
            setAngleResults((previous) => previous.map((item) => (
              item.key === angleKey ? { ...item, loading: false, error: true } : item
            )));
            setAnglePollingIds((previous) => {
              const next = { ...previous };
              delete next[angleKey];
              return next;
            });
            continue;
          }

          if (!data?.processed) {
            continue;
          }

          const { data: result, error: resultError } = await supabase
            .from('generated_models')
            .select('file_url')
            .eq('original_image_id', imageId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (resultError || !result?.file_url) {
            continue;
          }

          setAngleResults((previous) => previous.map((item) => (
            item.key === angleKey
              ? { ...item, loading: false, error: false, url: result.file_url }
              : item
          )));
          setAnglePollingIds((previous) => {
            const next = { ...previous };
            delete next[angleKey];
            return next;
          });
        } catch (error) {
          console.error(`Angle polling failed for ${angleKey}:`, error);
        }
      }
    };

    void pollAngles();
    const interval = window.setInterval(() => {
      void pollAngles();
    }, POLLING_INTERVAL);

    return () => window.clearInterval(interval);
  }, [anglePollingIds]);

  useEffect(() => {
    let isActive = true;

    if (!resultUrl) {
      replacePortraitAsset(null);
      setIsPreparingPortraitCrop(false);
      return undefined;
    }

    setIsPreparingPortraitCrop(true);

    void createStudioPortraitBlob(resultUrl)
      .then((blob) => {
        if (!isActive) {
          return;
        }

        replacePortraitAsset(blob);
      })
      .catch((error) => {
        console.error('Failed to prepare portrait crop:', error);
        toast.error('Portrait crop generation failed.');
      })
      .finally(() => {
        if (isActive) {
          setIsPreparingPortraitCrop(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [replacePortraitAsset, resultUrl]);


  useEffect(() => () => {
    garmentReferencesRef.current.forEach((item) => revokePreview(item.previewUrl));
  }, []);

  useEffect(() => () => {
    revokePreview(facePreview);
    revokePreview(bodyPreview);
    revokePreview(backgroundPreview);
    revokePreview(generatedPortraitRef.current);
  }, [backgroundPreview, bodyPreview, facePreview]);

  const handleGenerate = async () => {
    if (garmentReferences.length === 0) {
      toast.error('Upload at least one outfit reference first.');
      return;
    }

    if (mode === 'preset' && !selectedPreset && !customModelPrompt.trim()) {
      toast.error('Pick a preset or describe a custom model.');
      return;
    }

    if (mode === 'selfie' && (!faceFile || !bodyFile)) {
      toast.error('Upload both a face photo and a full body photo.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setResultUrl(null);
    setCurrentImageId(null);
    setIsPolling(false);
    setAngleResults([]);
    setAnglePollingIds({});
    setCurrentGenerationMode(mode);

    try {
      const garmentReferenceFile = await createGarmentReferenceSheetFile(garmentReferences.map((item) => item.file));
      const garmentUpload = await uploadIncomingFile(garmentReferenceFile, 'garment');
      const backgroundUpload = backgroundFile ? await uploadIncomingFile(backgroundFile, 'background') : null;
      let presetImageUrl: string | null = null;
      let selfieFaceUrl: string | null = null;
      let selfieBodyUrl: string | null = null;
      let modelPreset: string | null = selectedPreset || null;
      let modelPrompt: string | null = customModelPrompt.trim() || null;
      let userPrompt: string | null = null;

      if (mode === 'preset' && selectedPreset) {
        const { data: preset, error: presetError } = await supabase
          .from('clothing_presets')
          .select('file_url')
          .eq('id', selectedPreset)
          .single();

        if (presetError) {
          throw presetError;
        }

        presetImageUrl = preset?.file_url ?? null;
      }

      if (mode === 'selfie' && faceFile && bodyFile) {
        const [faceUpload, bodyUpload] = await Promise.all([
          uploadIncomingFile(faceFile, 'face'),
          uploadIncomingFile(bodyFile, 'body'),
        ]);

        modelPreset = 'user_selfie';
        modelPrompt = null;
        presetImageUrl = bodyUpload.publicUrl;
        selfieFaceUrl = faceUpload.publicUrl;
        selfieBodyUrl = bodyUpload.publicUrl;
      }

      userPrompt = buildGenerationOptionsPayload({
        modelPrompt,
        backgroundPrompt: backgroundDescription.trim() || DEFAULT_BACKGROUND_PROMPT,
        backgroundImageUrl: backgroundUpload?.publicUrl ?? null,
      });

      const { data: insertData, error: insertError } = await supabase
        .from('clothing_images')
        .insert({
          user_id: null,
          file_name: garmentUpload.fileName,
          file_url: garmentUpload.publicUrl,
          processed: false,
          status: 'pending',
          error_message: null,
          uploaded_at: new Date().toISOString(),
          model_preset: modelPreset,
          preset_image_url: presetImageUrl,
          user_prompt: userPrompt,
          selfie_face_url: selfieFaceUrl,
          selfie_body_url: selfieBodyUrl,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const webhookResponse = await fetch(buildWebhookUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: insertData.id }),
      });

      if (!webhookResponse.ok) {
        throw new Error('The backend did not accept the generation request.');
      }

      setCurrentImageId(insertData.id);
      setIsPolling(true);
      toast.success(mode === 'selfie'
        ? 'Personal try-on started. Give it about a minute.'
        : 'Generation started. OMODA STUDIO is processing your look.');

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
    } catch (error: unknown) {
      console.error('Failed to start generation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start generation.';
      setIsGenerating(false);
      setGenerationError(errorMessage);
      toast.error(errorMessage);
    }
  };

  async function queueAngleGeneration(sourceUrl: string, silent = false) {
    if (!sourceUrl || isGeneratingAngles || angleResults.length > 0 || Object.keys(anglePollingIds).length > 0) {
      return;
    }

    setIsGeneratingAngles(true);
    setAngleResults(ANGLE_VARIANTS.map((item) => ({
      key: item.key,
      label: item.label,
      url: null,
      loading: true,
      error: false,
    })));

    const pendingIds: Record<string, string> = {};
    const webhookUrl = buildWebhookUrl();

    setTimeout(() => {
      anglesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    for (const variant of ANGLE_VARIANTS) {
      try {
        const { data, error } = await supabase
          .from('clothing_images')
          .insert({
            user_id: null,
            file_name: `angle_${variant.key}_${Date.now()}.png`,
            file_url: sourceUrl,
            processed: false,
            status: 'pending',
            error_message: null,
            uploaded_at: new Date().toISOString(),
            model_preset: null,
            user_prompt: variant.prompt,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: data.id }),
        });

        if (!response.ok) {
          throw new Error(`Angle generation failed to start for ${variant.label}.`);
        }

        pendingIds[variant.key] = data.id;
      } catch (error) {
        console.error(`Failed to queue ${variant.key}:`, error);
        setAngleResults((previous) => previous.map((item) => (
          item.key === variant.key ? { ...item, loading: false, error: true } : item
        )));
      }
    }

    setAnglePollingIds(pendingIds);
    setIsGeneratingAngles(false);

    if (!silent) {
      toast.success('Studio pack angles queued. Results will appear as they finish.');
    }
  }

  const handleGenerateAngles = async () => {
    if (!resultUrl) {
      return;
    }

    await queueAngleGeneration(resultUrl);
  };

  const handleReset = () => {
    handleGarmentClear();
    revokePreview(facePreview);
    revokePreview(bodyPreview);
    revokePreview(backgroundPreview);
    replacePortraitAsset(null);
    setFaceFile(null);
    setFacePreview(null);
    setBodyFile(null);
    setBodyPreview(null);
    setBackgroundFile(null);
    setBackgroundPreview(null);
    setBackgroundDescription(DEFAULT_BACKGROUND_PROMPT);
    setCustomModelPrompt('');
    setSelectedPreset('');
    setResultUrl(null);
    setGenerationError(null);
    setCurrentImageId(null);
    setIsGenerating(false);
    setIsPolling(false);
    setIsPreparingPortraitCrop(false);
    setAngleResults([]);
    setAnglePollingIds({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_top,_rgba(32,32,32,0.12),_transparent_54%)]" />
      <div className="absolute inset-x-0 top-20 -z-10 h-[42rem] bg-[linear-gradient(180deg,rgba(246,243,237,0.92),rgba(255,255,255,0))]" />

      <header className="border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="container flex min-h-20 items-center justify-between py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold tracking-[0.32em] uppercase">OMODA STUDIO</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Editorial-grade virtual try-on for clean catalog imagery.
            </p>
          </div>
          <Badge variant="outline" className="hidden rounded-full px-4 py-1 text-[11px] tracking-[0.18em] uppercase text-muted-foreground sm:inline-flex">
            Live Studio Workflow
          </Badge>
        </div>
      </header>

      <main className="container py-10 sm:py-14">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 rounded-[2rem] border border-border/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(245,241,234,0.88))] p-7 shadow-elevated sm:p-9">
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] tracking-[0.18em] uppercase">
                Premium Catalog Pipeline
              </Badge>
              <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
                Build refined fashion try-on imagery from a cleaner, faster studio workflow.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Upload up to three outfit references, switch between preset casting and personal try-on, and generate
                the hero-ready render first, with angle views available only when you want them.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FeatureCard
                title="Curated Casting"
                description="Preset models and custom prompts in one polished selection flow."
              />
              <FeatureCard
                title="Layered Look Input"
                description="Mix tops, bottoms, outerwear, or a real photo of the outfit already worn."
              />
              <FeatureCard
                title="Controlled Output"
                description="Base image first, catalog crop next, optional angle generation after approval."
              />
            </div>
          </div>

          <Card className="overflow-hidden rounded-[2rem] border-border/70 bg-card/90 shadow-elevated">
            <CardHeader className="border-b border-border/70 bg-secondary/35 pb-5">
              <CardTitle className="text-xl">Workflow Snapshot</CardTitle>
              <CardDescription className="max-w-md text-sm leading-6">
                {generationSummary.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 sm:p-6">
              <WorkflowStepItem
                number="1"
                title="Compose The Look"
                description="Upload or paste references for a single garment, a layered outfit, or a person already wearing the desired look."
              />
              <WorkflowStepItem
                number="2"
                title="Choose The Subject"
                description="Stay in preset mode for fast catalog casting or switch to selfie mode when the output should resemble a real person."
              />
              <WorkflowStepItem
                number="3"
                title="Generate In Stages"
                description="Start with the main render and catalog crop, then trigger front, side, back, and 3/4 views only when needed."
              />
            </CardContent>
          </Card>
        </section>

        <div className="mt-10 space-y-10">
          <section className="space-y-4">
            <SectionHeading number="1" title="Upload Garment" subtitle="Add up to three outfit references. You can also paste images directly with Ctrl+V." />
            <GarmentUpload
              onUpload={handleGarmentUpload}
              items={garmentReferences.map((item) => ({
                id: item.id,
                previewUrl: item.previewUrl,
                name: item.name,
              }))}
              onClear={handleGarmentClear}
              maxFiles={3}
            />
          </section>

          <section className="space-y-4">
            <SectionHeading number="2" title="Choose Mode" subtitle="Run preset catalog generations or switch to the personal selfie workflow." />

            <Tabs value={mode} onValueChange={(value) => setMode(value as GenerationMode)}>
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl p-1 sm:w-[420px]">
                <TabsTrigger value="preset" className="rounded-lg py-3">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Preset Studio
                </TabsTrigger>
                <TabsTrigger value="selfie" className="rounded-lg py-3">
                  <Camera className="mr-2 h-4 w-4" />
                  On Yourself
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preset" className="space-y-4 pt-4">
                <Card className="border-border/70">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-xl">Preset and custom model generation</CardTitle>
                      <Badge variant="secondary">Guest-friendly</Badge>
                    </div>
                    <CardDescription>
                      Pick a preset from Supabase or switch to Custom inside the panel to describe the model you want.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ModelPresetGrid
                      selectedPreset={selectedPreset}
                      onSelect={setSelectedPreset}
                      customPrompt={customModelPrompt}
                      onCustomPromptChange={setCustomModelPrompt}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="selfie" className="space-y-4 pt-4">
                <Card className="border-border/70">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-xl">Personal try-on with your own photos</CardTitle>
                      <Badge variant="secondary">Guest-friendly</Badge>
                    </div>
                    <CardDescription>
                      This mode combines the garment with your face and full-body references without requiring Google sign-in or account setup.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center">
                      <p className="text-base font-medium">Guest selfie mode is active.</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Upload a clear face photo and a full-body photo. The try-on now works without Google registration.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <PhotoUploadCard
                        title="Face Photo"
                        description="Portrait or close-up. Clear lighting, face visible, no heavy occlusion."
                        previewUrl={facePreview}
                        onClear={() => {
                          revokePreview(facePreview);
                          setFaceFile(null);
                          setFacePreview(null);
                        }}
                        onSelect={(file) => handlePreviewFile(file, facePreview, setFaceFile, setFacePreview)}
                      />
                      <PhotoUploadCard
                        title="Full Body Photo"
                        description="Head-to-toe shot in a neutral pose so the model proportions stay realistic."
                        previewUrl={bodyPreview}
                        onClear={() => {
                          revokePreview(bodyPreview);
                          setBodyFile(null);
                          setBodyPreview(null);
                        }}
                        onSelect={(file) => handlePreviewFile(file, bodyPreview, setBodyFile, setBodyPreview)}
                      />
                    </div>

                    <div className="rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                      Guest mode stores only the files needed for this generation. No Google account is required.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="border-border/70">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-xl">Background</CardTitle>
                  <Badge variant="outline">Text or image</Badge>
                </div>
                <CardDescription>
                  Keep the restored OMODA background prompt, rewrite it yourself, or upload a background reference image.
                  If you use both, the image sets the scene and the text fine-tunes it.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Background description</label>
                  <Textarea
                    value={backgroundDescription}
                    onChange={(event) => setBackgroundDescription(event.target.value)}
                    className="min-h-[140px] resize-none"
                    placeholder="Describe the scene, atmosphere, architecture, props, and lighting you want behind the model."
                  />
                  <p className="text-sm text-muted-foreground">
                    Default: premium OMODA showroom mood. Rewrite this field if you want a different location or style.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Background reference image</p>
                  {backgroundPreview ? (
                    <div className="space-y-3">
                      <img
                        src={backgroundPreview}
                        alt="Background reference"
                        className="h-48 w-full rounded-2xl border border-border object-cover"
                      />
                      <Button
                        variant="outline"
                        className="w-full rounded-full"
                        onClick={() => {
                          revokePreview(backgroundPreview);
                          setBackgroundFile(null);
                          setBackgroundPreview(null);
                        }}
                      >
                        Remove Background Image
                      </Button>
                    </div>
                  ) : (
                    <label className="upload-zone flex cursor-pointer flex-col items-center gap-3 rounded-2xl py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Upload background image</p>
                        <p className="text-sm text-muted-foreground">Optional JPG, PNG or WEBP reference</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handlePreviewFile(event.target.files?.[0], backgroundPreview, setBackgroundFile, setBackgroundPreview)}
                      />
                    </label>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Use this when you want the output placed into a specific environment, interior, or campaign scene.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
          <section className="space-y-4">
            <SectionHeading number="3" title="Generate" subtitle={generationSummary.title} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="h-14 min-w-[240px] rounded-full px-8 text-base"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Studio Pack
                  </>
                )}
              </Button>

              <p className="text-sm text-muted-foreground">
                {mode === 'preset'
                  ? 'One click produces the base look and catalog crop. Angle views can be generated separately afterwards.'
                  : 'Selfie mode still needs both personal photos, then the base look and crop are assembled automatically.'}
              </p>
            </div>
          </section>

          {(isGenerating || resultUrl || generationError) && (
            <section ref={resultRef} className="space-y-6 border-t border-border/80 pt-8">
              <SectionHeading number="4" title="Result" subtitle="Polling Supabase for the generated image until the backend marks it complete." />

              {generationError && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                      <span className="text-lg text-destructive">!</span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-destructive">Generation failed</p>
                      <p className="text-sm text-muted-foreground">{generationError}</p>
                    </div>
                    <Button variant="outline" onClick={handleReset}>Reset And Try Again</Button>
                  </CardContent>
                </Card>
              )}

              {isGenerating && !resultUrl && !generationError && (
                <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="mx-auto aspect-[900/1286] w-full max-w-sm animate-pulse rounded-3xl bg-muted" />
                  <Card className="border-border/70">
                    <CardContent className="flex h-full flex-col justify-center gap-3 pt-6">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-lg font-medium">OMODA STUDIO is composing the look.</p>
                      <p className="text-sm text-muted-foreground">
                        The backend has the request and the page is polling Supabase for the finished image.
                        Most generations land in roughly 30 to 90 seconds.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {resultUrl && (
                <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="mx-auto w-full max-w-sm">
                    <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-elevated">
                      <img
                        src={resultUrl}
                        alt="Generated OMODA STUDIO look"
                        className="aspect-[900/1286] w-full object-cover"
                      />
                      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-success px-3 py-1 text-xs font-medium text-success-foreground">
                        <Check className="h-3.5 w-3.5" />
                        Ready
                      </div>
                    </div>
                  </div>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-xl">Studio Pack Status</CardTitle>
                      <CardDescription>
                        The base look and catalog crop are prepared automatically. Angle views are generated only when you request them.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3 rounded-2xl bg-secondary/50 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span>Base render</span>
                          <Badge variant="secondary">Ready</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Portrait crop</span>
                          <Badge variant={portraitCropUrl ? 'secondary' : 'outline'}>{portraitCropUrl ? 'Ready' : isPreparingPortraitCrop ? 'Preparing' : 'Waiting'}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Angle views</span>
                          <Badge variant={completedAngleCount === ANGLE_VARIANTS.length ? 'secondary' : 'outline'}>
                            {angleResults.length === 0 && !hasPendingAngles ? 'Not started' : `${completedAngleCount}/${ANGLE_VARIANTS.length}`}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          className="h-12 rounded-full"
                          onClick={() => {
                            void downloadImage(resultUrl, `omoda-studio-main-look-${Date.now()}.png`)
                              .then(() => toast.success('Main render downloaded.'))
                              .catch(() => toast.error('Download failed.'));
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Main Look
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12 rounded-full"
                          disabled={isGeneratingAngles || hasPendingAngles || angleResults.length > 0}
                          onClick={handleGenerateAngles}
                        >
                          {isGeneratingAngles ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Queueing angles...
                            </>
                          ) : (
                            <>
                              <Camera className="mr-2 h-4 w-4" />
                              {hasPendingAngles ? 'Angles In Progress' : angleResults.length > 0 ? 'Angles Ready' : 'Generate Angles Now'}
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          className="h-12 rounded-full"
                          disabled={!portraitCropUrl}
                          onClick={async () => {
                            if (!portraitCropUrl || !portraitCropBlob) {
                              return;
                            }

                            try {
                              downloadBlob(portraitCropBlob, `omoda-studio-catalog-crop-${Date.now()}.jpg`);
                              toast.success('Catalog crop downloaded.');
                            } catch {
                              toast.error('Download failed.');
                            }
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Hero Crop
                        </Button>
                        <Button className="h-12 rounded-full" variant="outline" onClick={handleReset}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Start Another Look
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>
          )}

          {resultUrl && (
            <section className="space-y-6 border-t border-border/80 pt-8">
              <SectionHeading number="5" title="Studio Pack" subtitle="The app now builds the core final image family automatically: full body render and catalog crop, with optional angle views afterwards." />

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden border-border/70">
                  <div className="relative aspect-[900/1286] bg-muted">
                    <img src={resultUrl} alt="Main studio render" className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="space-y-2 pt-4">
                    <p className="font-medium">Main Full-Body Render</p>
                    <p className="text-sm text-muted-foreground">Primary studio image for catalog and campaign use.</p>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-border/70">
                  <div className="relative aspect-[900/1286] bg-muted">
                    {portraitCropUrl ? (
                      <img src={portraitCropUrl} alt="Portrait crop" className="h-full w-full object-contain" />
                    ) : (
                      <div className="skeleton-shimmer absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Preparing hero crop...</p>
                      </div>
                    )}
                  </div>
                  <CardContent className="space-y-2 pt-4">
                    <p className="font-medium">Catalog Crop</p>
                    <p className="text-sm text-muted-foreground">Upper-body crop aligned to the reference style in your sample folder.</p>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}

          {angleResults.length > 0 && (
            <section ref={anglesRef} className="space-y-6 border-t border-border/80 pt-8">
              <SectionHeading number="6" title="Angle Views" subtitle="These variants are generated only after you press the angle button, then each card updates independently." />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {angleResults.map((item) => (
                  <Card key={item.key} className="overflow-hidden border-border/70">
                    <div className="relative aspect-[900/1286] bg-muted">
                      {item.loading && (
                        <div className="skeleton-shimmer absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      )}

                      {item.error && (
                        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-destructive">
                          Failed to generate this angle.
                        </div>
                      )}

                      {item.url && (
                        <>
                          <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-success px-2 py-1 text-[11px] font-medium text-success-foreground">
                            <Check className="h-3 w-3" />
                            Ready
                          </div>
                        </>
                      )}
                    </div>
                    <CardContent className="space-y-3 pt-4">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.url ? 'Finished and ready to export.' : 'Waiting for the backend worker.'}
                        </p>
                      </div>
                      {item.url && (
                        <Button
                          variant="outline"
                          className="w-full rounded-full"
                          onClick={() => {
                            void downloadImage(item.url!, `omoda-studio-${item.key}-${Date.now()}.png`)
                              .then(() => toast.success(`${item.label} downloaded.`))
                              .catch(() => toast.error('Download failed.'));
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Angle
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {user && (
            <section className="space-y-6 border-t border-border/80 pt-8">
              <SectionHeading number="7" title="Your History" subtitle="Recent signed-in generations from the merged OMODA STUDIO flow." />

              {historyLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="aspect-[900/1286] animate-pulse rounded-3xl bg-muted" />
                  ))}
                </div>
              ) : history.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {history.map((item) => (
                    <Card key={item.id} className="overflow-hidden border-border/70">
                      <img src={item.resultUrl} alt={item.modeLabel} className="aspect-[900/1286] w-full object-cover" />
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">{item.modeLabel}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full rounded-full"
                          onClick={() => {
                            void downloadImage(item.resultUrl, `omoda-history-${item.id}.png`)
                              .then(() => toast.success('History image downloaded.'))
                              .catch(() => toast.error('Download failed.'));
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-border/80">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Signed-in generations will appear here after the first successful run.
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

interface SectionHeadingProps {
  number: string;
  title: string;
  subtitle: string;
}

function SectionHeading({ number, title, subtitle }: SectionHeadingProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-secondary text-sm font-semibold text-foreground shadow-sm">
          {number}
        </div>
        <h2 className="text-xl sm:text-2xl">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <Card className="rounded-[1.5rem] border-border/70 bg-background/75 shadow-soft backdrop-blur">
      <CardContent className="space-y-2 pt-6">
        <p className="text-sm font-medium tracking-[0.08em] uppercase text-foreground/80">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface WorkflowStepItemProps {
  number: string;
  title: string;
  description: string;
}

function WorkflowStepItem({ number, title, description }: WorkflowStepItemProps) {
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-primary text-sm font-semibold text-primary-foreground shadow-soft">
        {number}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-[0.08em] uppercase text-foreground/80">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface PhotoUploadCardProps {
  title: string;
  description: string;
  previewUrl: string | null;
  onClear: () => void;
  onSelect: (file: File | null | undefined) => void;
}

function PhotoUploadCard({ title, description, previewUrl, onClear, onSelect }: PhotoUploadCardProps) {
  return (
    <Card className="border-dashed border-border/80">
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {previewUrl ? (
          <div className="space-y-3">
            <img
              src={previewUrl}
              alt={title}
              className="aspect-[900/1286] w-full rounded-2xl border border-border object-cover"
            />
            <Button variant="outline" className="w-full rounded-full" onClick={onClear}>
              Replace Photo
            </Button>
          </div>
        ) : (
          <label className="upload-zone flex cursor-pointer flex-col items-center gap-3 rounded-2xl py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Select image</p>
              <p className="text-sm text-muted-foreground">JPG, PNG or WEBP</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onSelect(event.target.files?.[0])}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}
