import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Session } from '@/types/api';
import { getSession, selectVariant } from '@/services/api';
import { SessionStepper } from '@/components/SessionStepper';
import { TryOnVariants, TryOnVariantsSkeleton } from '@/components/TryOnVariants';
import { BeforeAfterToggle } from '@/components/BeforeAfterToggle';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Loader2, Video, ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const POLLING_INTERVAL = 5000;

const SessionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!id) return;

    try {
      const data = await getSession(id);
      setSession(data);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError('Network error. Retry.');
      setIsLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Polling for status updates
  useEffect(() => {
    if (!session) return;
    
    const shouldPoll = ['created', 'processing', 'video_in_queue'].includes(session.status);
    if (!shouldPoll) return;

    const interval = setInterval(fetchSession, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [session?.status, fetchSession]);

  const handleSelectVariant = async (variantId: string) => {
    if (!id) return;
    
    setIsSelecting(true);
    try {
      await selectVariant(id, { variant_id: variantId, generate_video: false });
      await fetchSession();
    } catch (err) {
      toast.error('Network error. Retry.');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!id || !session?.selected_variant_id) return;

    setIsGeneratingVideo(true);
    try {
      await selectVariant(id, { 
        variant_id: session.selected_variant_id, 
        generate_video: true 
      });
      await fetchSession();
    } catch (err) {
      toast.error('Network error. Retry.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={fetchSession}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button asChild>
              <Link to="/">Start New Session</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (session?.status === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Generation Failed</h2>
          <p className="text-muted-foreground mb-6">
            {session.error?.message || 'An error occurred during processing.'}
          </p>
          <Button asChild>
            <Link to="/">Start New Session</Link>
          </Button>
        </div>
      </div>
    );
  }

  const selectedVariant = session?.tryon_variants.find(
    v => v.id === session?.selected_variant_id
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Session {id}</h1>
        </div>

        {/* Stepper */}
        <div className="mb-10">
          <SessionStepper 
            status={session?.status || 'created'} 
            hasSelectedVariant={!!session?.selected_variant_id}
          />
        </div>

        {/* Processing state */}
        {session?.status === 'processing' && (
          <div className="space-y-6">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Generating try-on variants…</p>
            </div>
            <TryOnVariantsSkeleton />
          </div>
        )}

        {/* Try-on variants ready */}
        {session?.status === 'tryon_done' && !session.selected_variant_id && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-center">Select your favorite variant</h2>
            <TryOnVariants
              variants={session.tryon_variants}
              selectedId={session.selected_variant_id}
              onSelect={handleSelectVariant}
              isSelecting={isSelecting}
            />
          </div>
        )}

        {/* Variant selected - show before/after and video option */}
        {selectedVariant && session?.status !== 'video_done' && (
          <div className="space-y-10">
            <BeforeAfterToggle
              beforeImage={session.garment_url}
              afterImage={selectedVariant.url}
            />

            {session.status !== 'video_in_queue' && (
              <div className="text-center space-y-4">
                <h3 className="text-lg font-medium">Generate Video (optional)</h3>
                <p className="text-muted-foreground text-sm">
                  Create a turntable video of your try-on result
                </p>
                <Button
                  size="lg"
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo}
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Generate Turntable Video
                    </>
                  )}
                </Button>
              </div>
            )}

            {session.status === 'video_in_queue' && (
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Video processing… check back soon</p>
              </div>
            )}
          </div>
        )}

        {/* Video ready */}
        {session?.status === 'video_done' && session.video_url && (
          <div className="space-y-10">
            <BeforeAfterToggle
              beforeImage={session.garment_url}
              afterImage={selectedVariant?.url || ''}
            />
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-center">Your Try-On Video</h3>
              <VideoPlayer videoUrl={session.video_url} />
            </div>

            <div className="text-center">
              <Button asChild>
                <Link to="/">Start New Session</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionPage;
