# NewsTok

NewsTok is a TikTok-style news MVP built as a pnpm monorepo with:

- a microservices backend
- a REST API gateway for mobile
- internal gRPC service calls
- PostgreSQL for content and user profiles
- Redis for feed caching
- a SwiftUI iPhone app with vertical feed paging and topic-based personalization
- an Expo Go preview app for testing the feed on a phone from Windows

## Stack

- Node.js `22`
- pnpm `9`
- NestJS
- PostgreSQL `16`
- Redis `7`
- SwiftUI / Xcode `16`

## Monorepo Layout

- `apps/ios`
  - SwiftUI iOS client
- `apps/expo-preview`
  - Expo Go preview client for Android/iPhone testing
- `services/api-gateway`
  - REST API for the mobile app
- `services/content-service`
  - Article storage and pagination
- `services/profile-service`
  - Demo user profile and topic preferences
- `services/feed-service`
  - Ranking, pagination, and Redis cache
- `services/ai-summary-service`
  - Deterministic MVP summarization and category inference
- `packages/proto`
  - gRPC contracts
- `packages/shared`
  - Shared TypeScript types reserved for future cleanup
- `infra`
  - Docker Compose for local infrastructure

## Environment

1. Install Node `22`.
2. Install `pnpm` if it is not already available.
3. Install Docker Desktop.
4. Copy the env template:

```powershell
Copy-Item .env.example .env
```

The default `.env.example` values already work for local MVP mode.

## Install Dependencies

```powershell
pnpm install
```

## Start Local Infrastructure

```powershell
pnpm db:up
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

If Docker is not installed yet, you can still preview the MVP backend in memory-only mode by skipping `pnpm db:up` and `pnpm seed`.

## Seed Demo Content

```powershell
pnpm seed
```

The seed command inserts demo articles into PostgreSQL. Profile data is auto-created by the profile service on first boot.

If you are running without Docker/PostgreSQL, skip this step. The content, profile, and summary services automatically fall back to in-memory MVP data.

## Start The Backend

```powershell
pnpm dev:backend
```

This launches:

- API Gateway on `http://localhost:3000`
- Content Service HTTP health on `http://localhost:3101/health`
- Profile Service HTTP health on `http://localhost:3102/health`
- Feed Service HTTP health on `http://localhost:3103/health`
- AI Summary Service HTTP health on `http://localhost:3104/health`

On a machine without Docker, the backend still starts in MVP preview mode:

- PostgreSQL-backed services fall back to in-memory demo data
- Redis caching is disabled automatically
- Feed and profile endpoints still work for local UI preview

Quick checks:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod "http://localhost:3000/v1/feed?userId=demo-user&limit=4"
Invoke-RestMethod http://localhost:3000/v1/profile/demo-user
```

## Open The iOS App

You need macOS with Xcode to run the app in Simulator or on a real iPhone.

Project file:

- `apps/ios/NewsTok.xcodeproj`

### Simulator

1. Open `apps/ios/NewsTok.xcodeproj` in Xcode.
2. Select the `NewsTok` scheme.
3. Choose an iPhone simulator, for example `iPhone 16`.
4. Make sure the backend is already running on your Mac.
5. Press Run.

The shared Xcode scheme already sets:

- `IOS_API_BASE_URL=http://127.0.0.1:3000`

That works for the iOS Simulator.

### Real iPhone

1. Keep the backend running on your Mac.
2. Find your Mac's LAN IP address, for example `192.168.1.20`.
3. In Xcode, edit the `NewsTok` scheme environment variable:
   - `IOS_API_BASE_URL=http://YOUR_MAC_IP:3000`
4. Connect your iPhone with Xcode signing enabled.
5. Run the app on the device.

## Test On A Phone With Expo Go

This is the fastest way to see the NewsTok feed on a real phone from Windows.

1. Install Expo Go on your phone:
   - iPhone: open `https://expo.dev/go` and install Expo Go from the App Store.
   - Android: open `https://expo.dev/go` and install Expo Go from Google Play.
2. Keep the backend running:

```powershell
pnpm dev:backend
```

3. Find your Windows LAN IP address:

```powershell
ipconfig
```

Use the IPv4 address from your active Wi-Fi adapter, for example `192.168.1.20`.

4. Start the Expo preview app:

```powershell
pnpm install
pnpm dev:expo-preview
```

5. Scan the QR code with Expo Go.
6. Inside the app, replace `http://localhost:3000` with `http://YOUR_WINDOWS_IP:3000`.
7. Tap `Connect`.

If everything is wired correctly, you will see:

- a vertically paged personalized feed
- topic chips for reranking
- tap-through article detail in a modal sheet

Notes:

- Your phone and PC must be on the same Wi-Fi network.
- `localhost` will not work from a real phone.
- If Windows Firewall asks for permission, allow Node.js on private networks.
- Expo Go is for fast preview/testing. The production iPhone app in this repo is still the SwiftUI project in `apps/ios`.

## What You Should See

- A vertically paged "For You" feed
- Large gradient news cards with title, short summary, source, and personalization reason
- Topic chips across the top for `technology`, `business`, `science`, `world`, `culture`, and `sports`
- Tapping a card opens the article detail screen
- Changing topics updates the demo profile and reshapes the ranking

## API Endpoints

- `GET /health`
- `GET /v1/feed?userId=demo-user&cursor=0&limit=4`
- `GET /v1/articles/:id`
- `GET /v1/profile/:userId`
- `POST /v1/profile/:userId/topics`

Example topic update:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/v1/profile/demo-user/topics `
  -ContentType "application/json" `
  -Body '{"selectedTopics":["technology","science","world"]}'
```

## Troubleshooting

- If the backend fails on startup, make sure Docker Desktop is running and `pnpm db:up` completed successfully.
- If PostgreSQL is still starting, wait a few seconds and rerun `pnpm dev:backend`.
- If the iOS app shows preview content instead of live data, confirm `http://localhost:3000/v1/feed?userId=demo-user&limit=4` returns JSON first.
- If the real iPhone cannot connect, use your Mac LAN IP instead of `127.0.0.1`.
- If the Expo Go preview cannot connect, use your Windows LAN IP instead of `localhost` and confirm `http://YOUR_WINDOWS_IP:3000/health` opens from another device on the same network.
- If Xcode blocks HTTP requests, clean the build folder and rerun. The project includes local-development ATS allowances.
- If Redis is unavailable, the feed service continues without cache, but for the intended architecture you should keep Redis running.

## Notes

- MVP mode requires no external news API keys.
- MVP AI summaries are deterministic and local, but the AI summary service boundary is in place for a real LLM later.
- This repository was authored from a non-macOS environment, so the SwiftUI app structure and Xcode project were created statically and should be opened and built on macOS.
