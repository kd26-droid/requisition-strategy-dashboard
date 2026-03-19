# Environment Configuration

## API URLs by Environment

| Environment | API URL | Config File |
|------------|---------|-------------|
| **Local Dev** | `http://localhost:8000` | `.env.local` (not committed) |
| **Vercel Dev** | AWS Dev API Gateway | `.env.development` (committed) |
| **Vercel Prod** | AWS Prod API Gateway | `.env.production` (committed) |

## AWS API Gateway Endpoints

- **Dev**: `https://poiigw0go0.execute-api.us-east-1.amazonaws.com/dev`
- **Staging**: `https://poiigw0go0.execute-api.us-east-1.amazonaws.com/staging`
- **Prod**: `https://poiigw0go0.execute-api.us-east-1.amazonaws.com/prod`

## Local Development Setup

1. Create `.env.local` file:
```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

2. Run the development server:
```bash
npm run dev
```

The dashboard will use your local backend at `http://localhost:8000`.

## Deployment

### Dev Deployment
```bash
vercel
```
Uses `.env.development` → AWS Dev API Gateway

### Production Deployment
```bash
vercel --prod
```
Uses `.env.production` → AWS Prod API Gateway

## How It Works

The `lib/api.ts` file reads the `NEXT_PUBLIC_API_URL` environment variable:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://poiigw0go0.execute-api.us-east-1.amazonaws.com/dev';
```

Next.js automatically loads the correct `.env` file based on the environment:
- `npm run dev` → loads `.env.local` (local backend)
- `vercel` (preview) → loads `.env.development` (AWS dev)
- `vercel --prod` → loads `.env.production` (AWS prod)
