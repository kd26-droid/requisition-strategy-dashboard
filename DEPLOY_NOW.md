# 🚀 Deploy Your Dashboard to Vercel in 2 Minutes

## Method 1: GitHub + Vercel (Easiest)

### Step 1: Push to GitHub
```bash
cd "/Users/kartikd/Downloads/procurement po/procurement-dashboard"

# Initialize git if not done
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/procurement-dashboard.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to https://vercel.com/signup
2. Sign in with GitHub
3. Click "New Project"
4. Import `procurement-dashboard` repo
5. Leave all settings as default (Vercel auto-detects Next.js)
6. Click "Deploy"
7. Wait 2 minutes
8. Done! You get URL like: `https://procurement-dashboard-abc123.vercel.app`

### Step 3: Update Factwise Button
In your Factwise code:
```typescript
<FWButton
    onClick={() => window.open(
        `https://procurement-dashboard-abc123.vercel.app?project_id=${project_id}`,
        '_blank'
    )}
>
    Strategy
</FWButton>
```

✅ **DONE! Zero configuration needed.**

---

## Method 2: Vercel CLI (Fastest)

```bash
cd "/Users/kartikd/Downloads/procurement po/procurement-dashboard"

# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (one command!)
vercel --prod

# You'll get URL immediately
# Example: https://procurement-dashboard.vercel.app
```

Copy the URL and use it in your Factwise button. Done!

---

## Method 3: Local Development (For Testing)

Run dashboard locally on different port:

```bash
cd "/Users/kartikd/Downloads/procurement po/procurement-dashboard"

# Edit package.json:
# Change "dev": "next dev"
# To: "dev": "next dev -p 3001"

npm run dev
# Now runs on http://localhost:3001
```

Update button to use localhost:
```typescript
<FWButton
    onClick={() => window.open(
        `http://localhost:3001?project_id=${project_id}`,
        '_blank'
    )}
>
    Strategy
</FWButton>
```

---

## Custom Domain (Optional)

After deploying to Vercel:

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your domain: `strategy.yourcompany.com`
4. Update DNS records as shown
5. Done!

---

## Environment Variables

If your dashboard needs API keys:

1. In Vercel dashboard → Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_API_URL=https://your-backend.com/api`
   - Any other env vars

---

## Cost

**Vercel Free Tier:**
- ✅ 100GB bandwidth/month
- ✅ Unlimited websites
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ $0/month

Perfect for your use case!

---

## Next Steps After Deployment

1. Get your Vercel URL
2. Update Strategy button in Factwise
3. Test it
4. Done!

**Total time: 2-5 minutes** ⏱️
