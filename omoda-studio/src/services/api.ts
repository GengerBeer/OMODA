import {
  Session,
  GenerateRequest,
  GenerateResponse,
  SelectVariantRequest,
  SelectVariantResponse,
  ModelPreset
} from '@/types/api';

/**
 * API Configuration
 * 
 * Set VITE_API_URL environment variable to connect to real backend.
 * When not set, the app uses mock data for development/demo purposes.
 * 
 * Example .env:
 *   VITE_API_URL=https://api.omoda.nl/virtual-tryon
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const USE_MOCK = !API_BASE_URL;

// Log API mode on startup (dev only)
if (import.meta.env.DEV) {
  console.log(`[API] Mode: ${USE_MOCK ? 'MOCK (no backend)' : `LIVE (${API_BASE_URL})`}`);
}

// ============================================================================
// MOCK DATA (for development/demo when no backend is available)
// ============================================================================

const DEMO_GARMENT_URL = 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&auto=format&fit=crop&q=60';

const DEMO_TRYON_VARIANTS = [
  { id: 'result', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=60' },
];

const DEMO_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4';

// Mock session storage (in-memory)
const mockSessions = new Map<string, Session>();
let mockSessionCounter = 0;

// Simulate network delay
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// MODEL PRESETS (static data - available in both mock and live modes)
// ============================================================================

export const MODEL_PRESETS: ModelPreset[] = [
  // Female models
  { id: 'female_casual_01', name: 'Sophie', gender: 'female', style: 'casual', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/78064_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'female_casual_02', name: 'Nina', gender: 'female', style: 'casual', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/78548_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'female_elegant_01', name: 'Gemina', gender: 'female', style: 'elegant', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/72420_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'female_elegant_02', name: 'Graceleen', gender: 'female', style: 'elegant', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/74405_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'female_street_01', name: 'Zala', gender: 'female', style: 'street', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/78240_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'female_street_02', name: 'Gisella', gender: 'female', style: 'street', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/76881_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  // Male models
  { id: 'male_casual_01', name: 'Vodan', gender: 'male', style: 'casual', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/79909_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'male_casual_02', name: 'Superbolt', gender: 'male', style: 'casual', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/78360_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'male_elegant_01', name: 'Jasper', gender: 'male', style: 'elegant', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/79472_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'male_elegant_02', name: 'Henrik', gender: 'male', style: 'elegant', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/78416_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'male_street_01', name: 'Gunter', gender: 'male', style: 'street', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/43217_3000x3000.jpg?sw=300&sh=400&sm=fit' },
  { id: 'male_street_02', name: 'Dapper', gender: 'male', style: 'street', thumbnail: 'https://www.omoda.nl/dw/image/v2/BCCT_PRD/on/demandware.static/-/Sites-outfit-master/nl_NL/v1770363541177/product-sets/outfits/78608_1_3000x3000.jpg?sw=300&sh=400&sm=fit' },
];

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * POST /generate
 * Create a new try-on session
 */
export async function generateSession(request: GenerateRequest): Promise<GenerateResponse> {
  if (USE_MOCK) {
    await simulateDelay(500);
    const sessionId = `demo_${++mockSessionCounter}`;

    mockSessions.set(sessionId, {
      status: 'processing',
      garment_url: request.garment_url || DEMO_GARMENT_URL,
      model_preset: request.model_preset,
      tryon_variants: [],
      selected_variant_id: null,
      video_url: null,
      error: null,
    });

    // Simulate processing completion after 3 seconds
    setTimeout(() => {
      const session = mockSessions.get(sessionId);
      if (session && session.status === 'processing') {
        session.status = 'tryon_done';
        session.tryon_variants = DEMO_TRYON_VARIANTS;
      }
    }, 3000);

    return { session_id: sessionId };
  }

  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Network error. Retry.');
  }

  return response.json();
}

/**
 * GET /session/:id
 * Get session status and data
 */
export async function getSession(sessionId: string): Promise<Session> {
  if (USE_MOCK) {
    await simulateDelay(200);
    const session = mockSessions.get(sessionId);

    if (!session) {
      // Return a default demo session if not found
      return {
        status: 'tryon_done',
        garment_url: DEMO_GARMENT_URL,
        model_preset: 'female_casual_02',
        tryon_variants: DEMO_TRYON_VARIANTS,
        selected_variant_id: null,
        video_url: null,
        error: null,
      };
    }

    return session;
  }

  const response = await fetch(`${API_BASE_URL}/session/${sessionId}`);

  if (!response.ok) {
    throw new Error('Network error. Retry.');
  }

  return response.json();
}

/**
 * POST /session/:id/select
 * Select a variant and optionally generate video
 */
export async function selectVariant(
  sessionId: string,
  request: SelectVariantRequest
): Promise<SelectVariantResponse> {
  if (USE_MOCK) {
    await simulateDelay(300);
    const session = mockSessions.get(sessionId);

    if (session) {
      session.selected_variant_id = request.variant_id;

      if (request.generate_video) {
        session.status = 'video_in_queue';

        // Simulate video completion after 4 seconds
        setTimeout(() => {
          if (session.status === 'video_in_queue') {
            session.status = 'video_done';
            session.video_url = DEMO_VIDEO_URL;
          }
        }, 4000);
      }
    }

    return { ok: true };
  }

  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Network error. Retry.');
  }

  return response.json();
}


// Recent sessions storage
const RECENT_SESSIONS_KEY = 'omoda_recent_sessions';
const MAX_RECENT_SESSIONS = 5;

export function getRecentSessions(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentSession(sessionId: string): void {
  try {
    const recent = getRecentSessions().filter(id => id !== sessionId);
    recent.unshift(sessionId);
    localStorage.setItem(
      RECENT_SESSIONS_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_SESSIONS))
    );
  } catch {
    // Ignore storage errors
  }
}
