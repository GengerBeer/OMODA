import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GarmentUpload } from '@/components/GarmentUpload';
import { ModelPresetGrid } from '@/components/ModelPresetGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  Check,
  Download,
  Loader2,
  LogOut,
  RotateCcw,
  Sparkles,
  Upload,
  User,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

const ANGLE_MODE_MARKER = '[ANGLE_MODE]';
const POLLING_INTERVAL = 2000;

const ANGLE_VARIANTS = [
  {
    key: 'front',
    label: 'Front View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show the FRONT VIEW.
Preserve the same face, proportions, clothing details, white background and studio lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
  {
    key: 'side',
    label: 'Side View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show a clean SIDE VIEW profile.
Preserve the same face, proportions, clothing details, white background and studio lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
  {
    key: 'back',
    label: 'Back View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show the BACK VIEW.
Preserve the body proportions, garment details, white background and studio lighting.
Show the full body from head to toe. Output: 864x1232 pixels.`,
  },
  {
    key: 'three_quarter',
    label: '3/4 View',
    prompt: `${ANGLE_MODE_MARKER}
You are a fashion AI. The image provided shows a model already wearing clothing.
Your task: recreate this exact same person wearing the exact same clothing, but show a 3/4 angle.
Preserve the same face, proportions, clothing details, white background and studio lighting.
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

export default function Index() {
  const {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    canUseSelfieMode,
    personalGenerationsLeft,
    refetchProfile,
  } = useAuth();

  const [mode, setMode] = useState<GenerationMode>('preset');
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customModelPrompt, setCustomModelPrompt] = useState('');
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [bodyFile, setBodyFile] = useState<File | null>(null);
  const [bodyPreview, setBodyPreview] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [currentGenerationMode, setCurrentGenerationMode] = useState<GenerationMode>('preset');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const [angleResults, setAngleResults] = useState<AngleResult[]>([]);
  const [isGeneratingAngles, setIsGeneratingAngles] = useState(false);
  const [anglePollingIds, setAnglePollingIds] = useState<Record<string, string>>({});

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const anglesRef = useRef<HTMLDivElement>(null);

  const canGeneratePreset = !!garmentFile && (!!selectedPreset || !!customModelPrompt.trim());
  const canGenerateSelfie = !!garmentFile && !!faceFile && !!bodyFile && !!user && canUseSelfieMode;
  const canGenerate = mode === 'preset' ? canGeneratePreset : canGenerateSelfie;

  const generationSummary = useMemo(() => {
    if (mode === 'preset') {
      return {
        title: 'Preset and custom model mode',
        description: 'Use Supabase model presets or describe a custom studio model for fast catalog shots.',
      };
    }

    return {
      title: 'On-yourself mode',
      description: 'Upload your face and full-body photos to generate a personalized OMODA STUDIO try-on.',
    };
  }, [mode]);

  const handleGarmentUpload = useCallback((file: File, previewUrl: string) => {
    revokePreview(garmentPreview);
    setGarmentFile(file);
    setGarmentPreview(previewUrl);
  }, [garmentPreview]);

  const handleGarmentClear = useCallback(() => {
    revokePreview(garmentPreview);
    setGarmentFile(null);
    setGarmentPreview(null);
  }, [garmentPreview]);

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
        toast.success('Your OMODA STUDIO look is ready.');

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

  useEffect(() => () => {
    revokePreview(garmentPreview);
    revokePreview(facePreview);
    revokePreview(bodyPreview);
  }, [bodyPreview, facePreview, garmentPreview]);

  const handleGenerate = async () => {
    if (!garmentFile) {
      toast.error('Upload a garment photo first.');
      return;
    }

    if (mode === 'preset' && !selectedPreset && !customModelPrompt.trim()) {
      toast.error('Pick a preset or describe a custom model.');
      return;
    }

    if (mode === 'selfie') {
      if (!user) {
        toast.error('Sign in with Google to use On Yourself mode.');
        return;
      }

      if (!canUseSelfieMode) {
        toast.error('You have used all personal try-ons for this profile.');
        return;
      }

      if (!faceFile || !bodyFile) {
        toast.error('Upload both a face photo and a full body photo.');
        return;
      }
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
      const garmentUpload = await uploadIncomingFile(garmentFile, 'garment');
      let presetImageUrl: string | null = null;
      let selfieFaceUrl: string | null = null;
      let selfieBodyUrl: string | null = null;
      let modelPreset: string | null = selectedPreset || null;
      let userPrompt: string | null = customModelPrompt.trim() || null;

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
        userPrompt = null;
        presetImageUrl = bodyUpload.publicUrl;
        selfieFaceUrl = faceUpload.publicUrl;
        selfieBodyUrl = bodyUpload.publicUrl;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('clothing_images')
        .insert({
          user_id: user?.id ?? null,
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

  const handleGenerateAngles = async () => {
    if (!resultUrl) {
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
            user_id: user?.id ?? null,
            file_name: `angle_${variant.key}_${Date.now()}.png`,
            file_url: resultUrl,
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
    toast.success('Angle generation queued. Results will appear as they finish.');
  };

  const handleReset = () => {
    handleGarmentClear();
    revokePreview(facePreview);
    revokePreview(bodyPreview);
    setFaceFile(null);
    setFacePreview(null);
    setBodyFile(null);
    setBodyPreview(null);
    setCustomModelPrompt('');
    setSelectedPreset('');
    setResultUrl(null);
    setGenerationError(null);
    setCurrentImageId(null);
    setIsGenerating(false);
    setIsPolling(false);
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
      <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,_rgba(24,24,24,0.08),_transparent_55%)]" />

      <header className="border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold tracking-[0.28em] uppercase">OMODA STUDIO</span>
              <Badge variant="secondary">Merged Try-On Platform</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Preset studio looks and personal selfie try-on in one flow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden rounded-full border border-border/80 bg-card px-4 py-2 text-sm sm:flex sm:items-center sm:gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-medium">{personalGenerationsLeft}</span>
                  <span className="text-muted-foreground">personal credits left</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || user.email || 'Profile'}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium leading-none">
                      {profile?.full_name || user.email || 'Signed in'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Google account connected</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={signInWithGoogle} className="rounded-full px-5">
                <GoogleIcon />
                Sign in for personal try-on
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-10 sm:py-14">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              One repo. One Supabase. One OMODA STUDIO.
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
                Merge preset styling and personal try-on into one premium studio workflow.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Upload a garment once, choose a preset model or your own photos, then generate clean catalog shots
                and extra angle views from the same result.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FeatureCard
                title="Preset Studio"
                description="Supabase-powered model presets for fast catalog imagery."
              />
              <FeatureCard
                title="On Yourself"
                description="Google sign-in plus face and body references for personalized try-on."
              />
              <FeatureCard
                title="Angle Views"
                description="Generate front, side, back and 3/4 variants from the final result."
              />
            </div>
          </div>

          <Card className="border-border/70 bg-card/90 shadow-elevated">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Workflow Snapshot</CardTitle>
              <CardDescription>
                {generationSummary.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  1
                </span>
                <p>Upload a clean garment image once. The same source feeds all generation modes.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  2
                </span>
                <p>Switch between preset catalog mode and the personalized selfie workflow without leaving the page.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  3
                </span>
                <p>Send everything to one backend and one Supabase project prepared for the new repo and deployment.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="mt-10 space-y-10">
          <section className="space-y-4">
            <SectionHeading number="1" title="Upload Garment" subtitle="Use a clean garment shot on a light background for the best transfer." />
            <GarmentUpload
              onUpload={handleGarmentUpload}
              previewUrl={garmentPreview}
              onClear={handleGarmentClear}
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
                      <Badge>Uses 1 personal credit</Badge>
                    </div>
                    <CardDescription>
                      This mode combines the garment with your face and full-body references. Google sign-in keeps the
                      credits and history tied to your profile.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!user && (
                      <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center">
                        <p className="text-base font-medium">Sign in to unlock personal try-on.</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          The unified OMODA STUDIO flow keeps preset mode open to guests and selfie mode behind Google auth.
                        </p>
                        <Button onClick={signInWithGoogle} className="mt-4 rounded-full px-5">
                          <GoogleIcon />
                          Sign in with Google
                        </Button>
                      </div>
                    )}

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

                    {user && (
                      <div className="rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                        {canUseSelfieMode ? (
                          <span>
                            {personalGenerationsLeft} personal credits remaining on this account.
                          </span>
                        ) : (
                          <span>You have no personal credits left on this account yet.</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
                    Generate OMODA Look
                  </>
                )}
              </Button>

              <p className="text-sm text-muted-foreground">
                {mode === 'preset'
                  ? 'Preset mode works for guests and signed-in users.'
                  : 'Selfie mode needs Google sign-in plus both reference photos.'}
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
                  <div className="mx-auto aspect-[3/4] w-full max-w-sm animate-pulse rounded-3xl bg-muted" />
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
                        className="aspect-[3/4] w-full object-cover"
                      />
                      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-success px-3 py-1 text-xs font-medium text-success-foreground">
                        <Check className="h-3.5 w-3.5" />
                        Ready
                      </div>
                    </div>
                  </div>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-xl">What you can do next</CardTitle>
                      <CardDescription>
                        Download the final render or create additional angle views from the same generated image.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          className="h-12 rounded-full"
                          onClick={() => {
                            void downloadImage(resultUrl, `omoda-studio-${Date.now()}.png`)
                              .then(() => toast.success('Image downloaded.'))
                              .catch(() => toast.error('Download failed.'));
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12 rounded-full"
                          disabled={isGeneratingAngles || angleResults.length > 0}
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
                              {angleResults.length > 0 ? 'Angles Requested' : 'Generate Angle Views'}
                            </>
                          )}
                        </Button>
                      </div>

                      <Button className="h-12 rounded-full" onClick={handleReset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Start Another Look
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>
          )}

          {angleResults.length > 0 && (
            <section ref={anglesRef} className="space-y-6 border-t border-border/80 pt-8">
              <SectionHeading number="5" title="Angle Views" subtitle="Each card updates independently as the backend finishes new variants." />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {angleResults.map((item) => (
                  <Card key={item.key} className="overflow-hidden border-border/70">
                    <div className="relative aspect-[3/4] bg-muted">
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
              <SectionHeading number="6" title="Your History" subtitle="Recent signed-in generations from the merged OMODA STUDIO flow." />

              {historyLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="aspect-[3/4] animate-pulse rounded-3xl bg-muted" />
                  ))}
                </div>
              ) : history.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {history.map((item) => (
                    <Card key={item.id} className="overflow-hidden border-border/70">
                      <img src={item.resultUrl} alt={item.modeLabel} className="aspect-[3/4] w-full object-cover" />
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
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
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
    <Card className="border-border/70 bg-card/80">
      <CardContent className="space-y-2 pt-6">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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
              className="aspect-[3/4] w-full rounded-2xl border border-border object-cover"
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

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.02 5.02 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="currentColor" d="M5.84 14.09A6.7 6.7 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11.02 11.02 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l4.66-2.84Z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}
