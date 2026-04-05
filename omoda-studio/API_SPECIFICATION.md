# OMODA STUDIO Backend API

The merged frontend expects a lightweight processing backend with these endpoints.

## POST `/webhook/process`

Queues one image generation job.

Request:

```json
{
  "image_id": "uuid"
}
```

Response:

```json
{
  "status": "processing",
  "image_id": "uuid"
}
```

Notes:

- The backend reads the matching row from `public.clothing_images`
- It supports preset, custom, selfie, and angle modes
- It writes the final file to Supabase Storage and inserts into `public.generated_models`
- It marks `clothing_images.status` as `processing`, `completed`, or `error`

## POST `/webhook/omoda-process`

Backward-compatible alias for the same handler.

## GET `/health`

Returns current server status plus any missing required environment variables.

## GET `/ping`

Simple liveness probe.
