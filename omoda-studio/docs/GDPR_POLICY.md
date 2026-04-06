# GDPR Policy And Data Processing Map

**Controller:** Alatyr Systems LLC  
**Service:** OMODA STUDIO  
**Document version date:** April 6, 2026

## 1. Purpose Of This Document

This document is intended to describe, in a practical and operational form, how personal data is processed within OMODA STUDIO. It is written as a GDPR-oriented internal and commercial reference and should be read together with the public Privacy Policy published on the website.

Unlike a short-form public notice, this document also records the current technical architecture of the service, including:

- which categories of data are stored;
- where those data are stored;
- what data are transmitted to external providers;
- which components process the data;
- what retention reality exists in the current implementation;
- what limitations and operational risks remain.

This document reflects the current application codebase and provider architecture as implemented in the repository at the date above.

## 2. System Overview

OMODA STUDIO is a web-based virtual try-on system. In its current architecture:

- the frontend is a Vite/React application;
- the production web application is hosted through Vercel;
- primary application data and file storage are handled through Supabase;
- image generation is triggered by a Vercel serverless function at `api/process.ts`;
- AI image generation is performed by Google Gemini through the Generative Language API;
- generated outputs are written back into Supabase storage and metadata tables.

## 3. Main Data Stores In The Current Implementation

The current schema defines the following principal data stores.

### 3.1 Supabase Postgres Tables

#### `public.user_profiles`

Purpose:

- stores user profile information associated with `auth.users`.

Fields currently defined:

- `id`
- `email`
- `full_name`
- `avatar_url`
- `generations_used`
- `generations_limit`
- `plan`
- `created_at`
- `updated_at`

Operational note:

- this table exists in the schema even if the current public flow is largely guest-oriented;
- if authentication is enabled again, user profile data will be stored here.

#### `public.clothing_images`

Purpose:

- stores metadata for each generation request and its input references.

Fields currently defined:

- `id`
- `user_id`
- `file_name`
- `file_path`
- `file_url`
- `uploaded_at`
- `processed`
- `processing_started_at`
- `status`
- `error_message`
- `model_preset`
- `preset_image_url`
- `user_prompt`
- `selfie_face_url`
- `selfie_body_url`

Operational meaning:

- this is the core request table;
- it records the incoming outfit reference image or compiled outfit sheet;
- it stores prompt data and links to optional selfie and background references;
- it records generation status and error information.

#### `public.clothing_presets`

Purpose:

- stores catalog preset metadata and the public URL of preset model images.

Fields currently defined:

- `id`
- `file_name`
- `file_url`
- `title`
- `description`
- `category`
- `order_index`

Operational meaning:

- these are product-side preset assets, not user-uploaded session content.

#### `public.generated_models`

Purpose:

- stores metadata for generated outputs.

Fields currently defined:

- `id`
- `original_image_id`
- `file_name`
- `file_path`
- `file_url`
- `is_angle`
- `created_at`

Operational meaning:

- records the output image URL for the main render or angle view;
- links every output to its originating request in `clothing_images`.

### 3.2 Supabase Storage Buckets

The current schema creates the following public buckets:

#### `clothing-incoming`

Purpose:

- stores uploaded input references.

Examples of content:

- garment reference images;
- compiled multi-reference outfit sheets;
- optional background references;
- face photos;
- full-body photos.

Current access model in schema:

- public read;
- public insert.

#### `clothing-presets`

Purpose:

- stores preset model assets used by the preset flow.

Current access model in schema:

- public read;
- no client-side write policy intentionally granted.

#### `clothing-output`

Purpose:

- stores generated primary outputs.

Current access model in schema:

- public read;
- upload performed through service-role operations.

#### `clothing-angles`

Purpose:

- stores generated front, side, back, and 3/4 angle outputs.

Current access model in schema:

- public read;
- upload performed through service-role operations.

## 4. Categories Of Personal Data Processed

In the current implementation, the system may process the following personal data categories:

- outfit and garment reference images;
- photographs of identifiable persons uploaded as selfie references;
- photographs of identifiable persons if a user uploads an outfit image already worn by a model or another person;
- face photographs;
- full-body photographs;
- optional background images if those images contain personal or location-related information;
- free-text prompts and model descriptions;
- generated images that may depict an identifiable individual;
- account/profile data if authentication is enabled or used;
- system metadata including request status, timestamps, internal identifiers, storage paths, and error messages;
- web request and runtime log information handled by hosting infrastructure.

Where an uploaded or generated image depicts an identifiable person, that image is treated as personal data.

## 5. What Data Are Stored By The Application

### 5.1 Data Stored In Supabase Database

The application stores:

- references to uploaded files through `file_url` and `file_path`;
- generation prompts and options through `user_prompt`;
- selected preset identifiers and preset image references;
- selfie reference URLs where applicable;
- job timestamps and job status;
- output file references and angle-output references;
- profile-level account data if user profiles are in use.

### 5.2 Data Stored In Supabase Object Storage

The application stores binary image files in Supabase storage, including:

- incoming reference files;
- preset images;
- generated final renders;
- generated angle renders.

### 5.3 Data Temporarily Processed In The Vercel Function

During processing, the Vercel function:

- receives a request containing `image_id`;
- fetches the relevant database record from Supabase;
- downloads required images from Supabase public URLs into runtime memory;
- converts those images into base64 for transmission to Gemini;
- receives generated image bytes back from Gemini;
- uploads generated output bytes back into Supabase storage.

In normal operation, the function uses transient memory during execution and does not implement a separate persistent local file store in the repository code.

## 6. What Data Are Sent To External Providers

### 6.1 Data Sent To Supabase

Supabase is the primary application data platform. The following data are sent to Supabase by the app:

- uploaded image files;
- file names and file paths;
- public file URLs;
- prompts and generation settings;
- model preset identifiers;
- optional face and body reference URLs;
- generation status and error messages;
- generated output metadata and generated output files;
- user profile information where authentication-related flows are active.

### 6.2 Data Sent To Google Gemini

The `api/process.ts` function currently sends image and prompt data to the Gemini API. The exact payload depends on the mode:

#### Preset mode

Typically transmitted:

- outfit reference image;
- preset model image;
- optional background reference image;
- assembled textual prompt describing generation requirements.

#### Custom model mode

Typically transmitted:

- outfit reference image;
- optional background reference image;
- textual prompt describing the requested model and scene.

#### Selfie mode

Typically transmitted:

- outfit reference image;
- face photo;
- full-body photo;
- optional background reference image;
- textual prompt describing the task.

#### Angle generation mode

Typically transmitted:

- the already-generated main result image;
- a text prompt instructing Gemini to produce the corresponding angle view.

Operational note:

- the implementation encodes images to base64 and sends them inline to the Gemini API endpoint;
- therefore, the transmitted data may include personal imagery whenever users upload identifiable persons.

Additional architectural note:

- the current codebase uses Google Gemini as the active generation integration;
- however, this document does not exclude the present or future use of additional generation or media-processing providers, including **ByteDance**, **Kling**, and **proprietary internal pipelines**;
- if any such provider is activated in production, staging, fallback, or experimental workflows in a way that materially changes recipients, transfer patterns, or processing logic, this document and the public privacy disclosures should be updated accordingly.

### 6.3 Data Potentially Processed By Vercel

Vercel hosts:

- the static website assets;
- the `api/process.ts` serverless function;
- runtime logs and error logs produced by that function.

This means request metadata, function diagnostics, and operational logs may be processed within Vercel infrastructure.

## 7. Where Data Are Stored

### 7.1 Supabase Storage Location

Application database records and object storage are hosted in the Supabase project associated with the service.

Important operational fact:

- the repository does **not** contain a hardcoded region declaration for the Supabase project;
- the exact Supabase project region must therefore be confirmed in the Supabase dashboard for the production project;
- according to Supabase official documentation, Supabase projects are created in a specific chosen region, and changing region generally requires creating a new project and migrating.

Accordingly, the statement that can be made accurately from the current codebase is:

- core application data are stored in the region configured for the active Supabase production project;
- the exact live region is an operational setting, not a value embedded in repository code.

### 7.2 Vercel Storage / Execution Location

The frontend is delivered over Vercel infrastructure and CDN. The serverless processing endpoint is also hosted on Vercel.

Important operational fact:

- the current `vercel.json` does **not** pin a function region;
- according to Vercel official documentation, new projects default to Washington, D.C. (`iad1`) unless configured otherwise in project settings or configuration;
- static assets are generally served via Vercel’s global CDN from locations close to the visitor.

Accordingly, the accurate current statement is:

- static assets are globally distributed through Vercel CDN;
- function execution region is controlled by Vercel project configuration and is not explicitly fixed in repository code.

### 7.3 Google Gemini Processing Location

The service currently uses the direct Gemini API endpoint exposed by Google AI for Developers.

Important operational fact:

- the repository does **not** set a regional Gemini processing zone;
- the code calls the public Gemini API directly, not a regional Vertex AI deployment;
- therefore, strict region-specific residency for Gemini processing is not established by the current implementation.

Accordingly, the accurate current statement is:

- generation requests are transmitted to Google’s Gemini API infrastructure;
- the exact processing location is controlled by Google’s service architecture and account/provider policies, not by a region pin in this codebase;
- if strict regional residency is required, the architecture would need to move to a region-controlled deployment model such as Vertex AI regional configuration.

## 8. Where Servers Are Located

From the current codebase and configuration, the following statements can be made accurately:

- **Supabase:** servers are located in the region selected for the active Supabase project; the exact region must be read from the Supabase project dashboard.
- **Vercel:** website delivery is handled through global CDN infrastructure; serverless execution runs in the default or configured function region for the Vercel project.
- **Gemini / Google:** API processing occurs in Google-managed infrastructure made available for the Gemini API; exact data residency is not fixed in this repository.

If a customer, regulator, or counterparty requires exact geographic naming such as “Frankfurt”, “Virginia”, or “London”, those values must be verified from the live provider dashboards rather than inferred from code.

## 9. Retention Reality In The Current Implementation

### 9.1 What The Current Code Actually Does

The current repository does **not** implement an automatic retention or deletion scheduler for:

- incoming uploaded files;
- generated output files;
- angle output files;
- request metadata in `clothing_images`;
- output metadata in `generated_models`.

This means the operational reality today is:

- uploaded and generated data remain stored until manually deleted, overwritten, removed through provider interfaces, or removed through direct database/storage operations.

### 9.2 Practical Retention Effect

In the current implementation:

- user-uploaded references may persist in `clothing-incoming`;
- outputs may persist in `clothing-output`;
- angle outputs may persist in `clothing-angles`;
- associated metadata may remain in database tables until explicitly removed.

### 9.3 Provider-Level Retention Notes

Provider-level logs and operational records may also persist independently of app logic.

Examples:

- Vercel runtime and deployment logs may be retained according to Vercel account settings and plan behavior;
- Google states in its Gemini API usage policy documentation that certain API usage data may be retained for abuse monitoring for a limited period;
- Supabase may retain data in backups or provider-level systems according to project settings and platform behavior.

If a strict retention schedule is required for compliance, it must be implemented operationally and, ideally, in code.

## 10. Public Access And Security Caveats In The Current Schema

The current schema has several important operational characteristics that should be recorded honestly in GDPR documentation and security reviews:

- `clothing-incoming` is publicly readable and publicly writable by policy;
- `clothing-output` is publicly readable;
- `clothing-angles` is publicly readable;
- `clothing-presets` is publicly readable;
- database row-level security exists for core tables, but storage visibility for several buckets is intentionally public.

This design may be acceptable for a public-content workflow, but it means:

- uploaded references may be accessible via public URL if the URL is known;
- generated outputs may also be public by direct URL;
- data minimization and confidentiality depend partly on operational discipline and link distribution, not solely on private storage controls.

If stricter GDPR or enterprise confidentiality requirements apply, storage design should be revised toward private buckets, signed URLs, and scheduled deletion.

## 11. Legal Bases

Where GDPR applies, the likely legal bases in the current service model are:

- **contract / pre-contract necessity** for processing required to deliver the requested generation output;
- **legitimate interests** for security, diagnostics, abuse prevention, service operation, and technical maintenance;
- **legal obligation** where disclosure, retention, or cooperation is required by law;
- **consent** where a user voluntarily uploads personal imagery, especially face and body images, for personalization purposes.

If sensitive or special category personal data appears in uploaded images, an additional assessment may be required depending on the specific use case, deployment market, and customer relationship.

## 12. Special Category Data Risk

The system may process images that reveal:

- biometric-like facial features;
- ethnicity or racial appearance;
- health-related indications visible in imagery;
- religious or cultural indicators visible in clothing or appearance;
- other sensitive contextual markers.

The service does not request such data as a separate category, but it may still receive them incidentally in uploaded images. This should be treated as a compliance-sensitive area.

## 13. Data Subject Rights

Subject to applicable law, a data subject may have the right to request:

- confirmation whether personal data is processed;
- access to personal data;
- correction of inaccurate data;
- deletion;
- restriction of processing;
- portability where applicable;
- objection where legitimate interests are relied upon;
- withdrawal of consent where consent is the relevant basis.

In practical terms, the ability to fulfill such requests depends on:

- the ability to identify the relevant records;
- whether the requester can be linked to the uploaded content;
- whether deletion must also be performed in storage buckets, logs, and backups;
- whether another lawful basis requires continued retention.

## 14. Deletion Handling In Practice

At present, no self-service deletion flow is implemented in the app code for guest generations.

Therefore, deletion usually requires manual operational action, which may involve:

- deleting database rows from `clothing_images`;
- deleting rows from `generated_models`;
- removing files from `clothing-incoming`;
- removing files from `clothing-output`;
- removing files from `clothing-angles`;
- reviewing whether logs or backups may still contain residual technical records.

This limitation should be understood clearly if the service is presented as GDPR-compliant in a strict operational sense.

## 15. Security Measures

The current architecture includes:

- Supabase row-level security on key application tables;
- service-role controlled uploads for generated outputs and preset assets;
- provider-managed infrastructure security at the hosting and storage layers;
- separation between client-side and server-side keys;
- server-side generation processing through a dedicated function;
- application-level status tracking and error handling.

However, security must be assessed together with the public bucket design noted above.

## 16. International Transfers

The current architecture involves at least the possibility of international transfers because:

- Vercel is a global hosting platform;
- Supabase region is configurable and may be outside the user’s country;
- Google Gemini processing occurs in Google-managed infrastructure not region-pinned in this repository.

Accordingly, international transfer analysis is relevant to the service as currently implemented.

## 17. Operational Improvements Recommended For Stronger GDPR Posture

If a stricter compliance position is required, the following measures are recommended:

- move incoming and generated files to private buckets;
- serve files through signed URLs rather than public URLs;
- implement automated retention and deletion schedules;
- record exact production regions for Supabase and Vercel in compliance documentation;
- consider regionalized AI processing if residency commitments are needed;
- add user-facing deletion and export workflows;
- document incident response and access review procedures;
- maintain a formal subprocessor register and transfer-impact review.

## 18. Source Basis For This Document

This document is based on:

- the current OMODA STUDIO codebase and Supabase schema;
- the current Vercel deployment configuration in the repository;
- the current Gemini integration implementation in `api/process.ts`;
- official provider documentation concerning project/function regions and Gemini API availability/usage behavior.

## 19. Practical Summary

As the system works today:

- user and generation data are primarily stored in Supabase database tables and storage buckets;
- website delivery and generation orchestration run through Vercel;
- image-generation inputs are transmitted to Google Gemini;
- exact live provider regions are controlled by platform configuration and are not fully pinned in repository code;
- several storage buckets are public;
- no automated deletion schedule is currently implemented in the codebase.

That summary should be treated as the most important compliance reality of the current implementation.
