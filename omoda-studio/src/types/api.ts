// Types for Omoda Virtual Try-On API

export type SessionStatus =
  | 'created'
  | 'processing'
  | 'tryon_done'
  | 'video_in_queue'
  | 'video_done'
  | 'failed';

export interface TryOnVariant {
  id: string;
  url: string;
}

export interface SessionError {
  code: string;
  message: string;
}

export interface Session {
  status: SessionStatus;
  garment_url: string;
  model_preset: string;
  tryon_variants: TryOnVariant[];
  selected_variant_id: string | null;
  video_url: string | null;
  error: SessionError | null;
}

export interface GenerateRequest {
  garment_url: string;
  model_preset: string;
  model_prompt?: string;
}

export interface GenerateResponse {
  session_id: string;
}

export interface SelectVariantRequest {
  variant_id: string;
  generate_video: boolean;
}

export interface SelectVariantResponse {
  ok: boolean;
}

export interface ModelPreset {
  id: string;
  name: string;
  gender: 'female' | 'male';
  style: 'casual' | 'elegant' | 'street';
  thumbnail: string;
}

export type GenderFilter = 'all' | 'female' | 'male';
export type StyleFilter = 'all' | 'casual' | 'elegant' | 'street';
