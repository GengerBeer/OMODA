# Changelog

All notable changes to Omoda Style Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [6.4.0] - 2026-04-13

### 🐛 Fixed

#### Catalog Crop — Match Editorial Reference

- **`src/lib/studioPack.ts`** — Rebuilt catalog crop to match reference etalon:
  - Canvas changed from 900×1200 (3:4) → 900×1125 (4:5) — standard catalog editorial ratio
  - Source crop now 4:5 ratio (was 3:4), 78% of image width, top offset 1.5%
  - Result: head → mid-thigh framing, person fills frame without leg cutoff

---

## [6.3.0] - 2026-04-13

### ✨ Improved

#### On Yourself — Reframe as Photo Editing + Catalog Crop Fix

- **`api/process.ts`** — Rewrote `buildSelfiePrompt` as a photo-editing task instead of generation:
  - Prompt now says "Take Image 2 and produce an edited version — only the clothing changes"
  - Face rules marked as non-negotiable with Image 1 as high-res verification reference
  - Eliminates generic model generation by anchoring to the actual base photo
- **`src/lib/studioPack.ts`** — Fixed catalog crop formula:
  - Widened crop from 62% → 78% of image width for better framing
  - Changed aspect ratio calculation to explicit `width * (4/3)` (was `width / 0.75`, same math but clearer)
  - Reduced top offset from 4% → 2% to avoid clipping the head

---

## [6.2.0] - 2026-04-13

### ✨ Improved

#### On Yourself — Face Identity Fix

- **`api/process.ts`** — Restructured selfie try-on to lock face identity first:
  - **Image order changed**: face → body → clothing (was: clothing → face → body). Face is now Image 1 so Gemini anchors identity before processing anything else.
  - Rewrote prompt as two explicit steps: Step 1 = lock person identity, Step 2 = apply clothing
  - Added "her face IS the output face" — eliminates generic model substitution
  - Clothing is now Image 3 with clear "do not copy identity from Image 3" guard

---

## [6.1.0] - 2026-04-13

### ✨ Improved

#### On Yourself — Selfie Try-On Prompt Overhaul

- **`api/process.ts`** — Rewrote `buildSelfiePrompt` for maximum photorealism:
  - Added explicit `CORE TASK` directive: change only the garment area, preserve everything else
  - Added `PERSON — DO NOT ALTER` block locking face, hair, and body to Images 2 & 3
  - Added `CLOTHING — APPLY FAITHFULLY` block with detailed fabric/fit/drape instructions
  - Set top-level realism bar: output must be indistinguishable from a real photograph
  - Added criterion: person must be instantly recognisable as the same individual
  - Removed ambiguity in image role descriptions — Images 2 & 3 now explicitly called "source of truth"

---

## [6.0.0] - 2026-02-20

### 🚀 Major Changes

#### New Branch: v6

- **Branch v6** — New development branch created from v5
  - Continues the Vercel Serverless architecture introduced in v5
  - Inherits all serverless function improvements and Supabase integrations
  - Version bump to 6.0.0 in `package.json`

### 📦 Updated Files

- **`package.json`** — Version updated to `6.0.0`
- **`CHANGELOG.md`** — Added v6.0.0 release notes

---

## [5.0.0] - 2026-02-19

### 🚀 Major Changes

#### Migration to Vercel Serverless Functions

- **Vercel Serverless Backend** — Replaced standalone Express.js server with Vercel serverless functions
  - Deployed as `/api/process` endpoint via Vercel infrastructure
  - No need for a separate server process or ngrok tunnel
  - Scales automatically with demand
  
- **Secure API Key Handling** — API keys managed via Vercel environment variables
  - `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
  - Keys never exposed to the client

- **Webhook Fallback** — Retained n8n webhook fallback for compatibility with existing workflows

### 🛠️ Technical Improvements

- Removed `@vercel/node` types dependency (not required for runtime)
- Resolved merge conflict between server integration and Vercel migration
- Updated integration settings and server configuration files
- Improved stability of the image processing pipeline

### 📦 Updated Files

- **`api/process.js`** — New Vercel serverless function entry point
- **`vercel.json`** — Vercel deployment configuration
- **`src/pages/Index.tsx`** — Updated backend URL to point to Vercel function

---

## [4.0.0] - 2026-02-13

### 🎉 Major Features

#### Dedicated Backend Server with Gemini AI Integration

Added a complete Node.js backend server (`omoda-server/server.cjs`) to handle AI image generation:

- **Gemini 2.0 Flash Integration** - Direct integration with Google Gemini AI
  - Image-to-image generation with clothing try-on capabilities
  - Support for both preset-based and custom model generation
  - Professional fashion photography quality output
  - Automatic image processing pipeline
  
- **Express.js Server** - Standalone backend service
  - Webhook endpoint for processing requests (`/webhook/omoda-process`)
  - Health check endpoint (`/health`)
  - CORS support for frontend integration
  - Asynchronous processing with immediate response
  
- **Supabase Integration** - Complete database and storage workflow
  - Direct REST API integration (no SDK overhead)
  - Helper functions: `sbGet`, `sbPatch`, `sbInsert`
  - Automatic image upload to `clothing-output` bucket
  - Result tracking in `generated_models` table
  
- **Dual Processing Modes**
  - **Preset Mode**: Uses model reference images for consistent results
  - **Custom Mode**: Generates unique models based on text descriptions
  - Smart prompt engineering for both modes
  
### 🛠️ Technical Improvements

#### Frontend Enhancements

- **Preset Image URL Storage** (`Index.tsx`)
  - New `preset_image_url` field saved to database
  - Enables backend to access preset reference images directly
  - Improved data flow between frontend and backend
  
- **Backend URL Configuration**
  - Support for `VITE_BACKEND_URL` environment variable
  - Fallback to `VITE_N8N_WEBHOOK_URL` for compatibility
  - Webhook trigger on image upload
  
#### Backend Architecture

- **Image Processing Pipeline**
  ```
  1. Receive webhook with image_id
  2. Fetch clothing image and preset data from Supabase
  3. Download images as Base64
  4. Send to Gemini API with optimized prompts
  5. Upload generated result to Storage
  6. Update database with result URL
  7. Mark image as processed
  ```
  
- **Helper Functions**
  - `downloadAsBase64(url)` - HTTP to Base64 converter
  - `uploadToStorage(buffer, path)` - Direct Storage API upload
  - `callGemini(prompt, images)` - Gemini API wrapper
  - `processImage(imageId)` - Main pipeline orchestrator
  
### 📦 New Files

- **`omoda-server/server.cjs`** (247 lines)
  - Standalone Express.js server
  - Gemini API integration
  - Supabase REST API helpers
  - Image processing utilities
  
### 🎨 Configuration

- **Required Environment Variables**
  - `GEMINI_API_KEY` - Google AI API key
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_ANON_KEY` - Public API key
  - `SUPABASE_SERVICE_KEY` - Service role key (server-only)
  
### ⚡ Performance & Quality

- **Asynchronous Processing** - Non-blocking webhook responses (202 Accepted)
- **Detailed Logging** - Timestamp-based progress tracking
- **Error Handling** - Comprehensive try-catch with meaningful messages
- **Professional Prompts** - Optimized for fashion photography quality

### 🔧 Developer Experience

- Server logs with emoji indicators for easy debugging
- Health check endpoint for monitoring
- Configurable port (default: 3001)
- Ready for ngrok/deployment

---

## [3.0.0] - 2026-02-12

### 🎉 Major Features

#### Preset Management System
Added a comprehensive preset management system to streamline model selection and organization:

- **Supabase Integration** - Model presets are now stored and managed via Supabase
  - Centralized storage in `clothing_presets` table
  - Cloud-based preset delivery with CDN support
  - Real-time preset updates without application rebuild
  
- **Smart Filtering System** - Advanced filtering capabilities for better preset discovery
  - **Gender Filter**: Filter by `female`, `male`, or view `all`
  - **Style Filter**: Filter by `casual`, `elegant`, `street`, or view `all`
  - Instant filter updates with optimized performance
  - Visual filter state with button highlighting
  
- **Preset Categories** - Organized collection of 12 professionally curated presets
  - 👗 **Female**: 
    - Casual (2 models: Nina, Eva)
    - Elegant (2 models: Sophie, Grace)
    - Street (2 models: Zara, Luna)
  - 👔 **Male**:
    - Casual (3 models: Max, Alex, Jake)
    - Elegant (2 models: Daniel, Oliver)
    - Street (1 model: Ryan)

#### Model Configuration Features

- **Dual Mode System** - Choose between preset models or custom descriptions
  - **Presets Mode**: Select from curated, high-quality model presets
  - **Custom Mode**: Describe your ideal model with natural language
  
- **Custom Model Descriptions** - Text-based model generation
  - Natural language input for model characteristics
  - Multi-line textarea for detailed descriptions
  - Quick-fill example templates for common use cases
  - Helpful placeholder text with best practices
  
- **Preset Upload Utility** - Automated preset management tool (`upload-presets.cjs`)
  - Batch upload of preset images to Supabase Storage
  - Automatic metadata extraction and categorization
  - Database synchronization with smart cleanup
  - Progress tracking and detailed logging

### 🛠️ Technical Improvements

#### New Components & Hooks

- **`usePresets` Hook** (`src/hooks/usePresets.ts`)
  - Fetches presets from Supabase `clothing_presets` table
  - Automatic data transformation and mapping
  - Loading and error state management
  - Category parsing (gender_style format)
  - Manual reload capability

- **Enhanced `ModelPresetGrid` Component** (`src/components/ModelPresetGrid.tsx`)
  - Mode switching tabs (Presets/Custom)
  - Interactive filter controls
  - Responsive grid layout (3-6 columns based on viewport)
  - Loading and error states
  - Custom prompt interface with examples
  - Hover animations and visual feedback

#### Data Structure

- **ModelPreset Interface**
  ```typescript
  {
    id: string;
    name: string;
    gender: 'male' | 'female';
    style: 'casual' | 'elegant' | 'street';
    thumbnail: string;
  }
  ```

- **Supabase Schema** (`clothing_presets` table)
  - `id`: UUID primary key
  - `file_name`: Original filename
  - `file_url`: Public CDN URL
  - `title`: Display name
  - `description`: Preset description
  - `category`: Combined gender_style tag
  - `order_index`: Sort order

### 📦 Assets

- Added 13 high-quality preset images (3000x3000px)
  - Professional model photography
  - Diverse style representation
  - Optimized for virtual try-on

### 🎨 UI/UX Enhancements

- Mode toggle with icon indicators (Users/Sparkles)
- Pill-style filter buttons with active states
- Responsive grid adapting to screen size
- Hover effects on preset cards with scale animation
- Empty state messaging for filtered results
- Loading spinner during data fetch
- Error state with clear messaging
- Quick example chips for custom mode

### 📝 Developer Experience

- Comprehensive upload script with detailed logging
- Database cleanup automation
- Upsert support for idempotent uploads
- Error handling and validation
- Progress indicators during batch operations

---

## [2.0.0] - Previous Version

_Details to be added_

---

## [1.0.0] - Initial Release

_Details to be added_

---

[3.0.0]: https://github.com/your-repo/omoda-style-studio/compare/v2.0...v3.0
[2.0.0]: https://github.com/your-repo/omoda-style-studio/compare/v1.0...v2.0
[1.0.0]: https://github.com/your-repo/omoda-style-studio/releases/tag/v1.0
