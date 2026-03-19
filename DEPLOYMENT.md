# 🚀 Fast Deployment Guide

Deploy your Procurement Dashboard to the web in minutes using Vercel or Netlify.

## 📋 Prerequisites

1. **GitHub Repository**: Your code should be on GitHub
   - Run `./deploy-to-github.sh` to push your code to GitHub
   - Repository: https://github.com/kd26-droid/procurement-dashboard

2. **Accounts**: Create accounts on your preferred platform:
   - [Vercel](https://vercel.com) (Recommended for Next.js)
   - [Netlify](https://netlify.com)

---

## 🟢 Option 1: Deploy on Vercel (Recommended)

**Why Vercel?** Built specifically for Next.js projects, zero configuration needed.

### Steps:

1. **Go to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Click "Start Deploying"

2. **Import Project**
   - Click "Import Git Repository"
   - Connect your GitHub account
   - Select `kd26-droid/procurement-dashboard`

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

4. **Environment Variables** (if needed)
   - Add any environment variables your project needs
   - For this project, no special env vars are required

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Get your live URL: `https://your-project-name.vercel.app`

### ⚡ Super Fast Method:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kd26-droid/procurement-dashboard)

---

## 🔵 Option 2: Deploy on Netlify

### Steps:

1. **Go to Netlify**
   - Visit [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"

2. **Connect to GitHub**
   - Choose "GitHub"
   - Authorize Netlify
   - Select `kd26-droid/procurement-dashboard`

3. **Build Settings**
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build && npm run export`
   - **Publish directory**: `out`
   - **Node version**: 18.x (in Environment variables)

4. **Environment Variables**
   ```
   NODE_VERSION = 18
   NPM_VERSION = 8
   ```

5. **Deploy**
   - Click "Deploy site"
   - Wait 3-5 minutes for build
   - Get your live URL: `https://random-name.netlify.app`

---

## 📦 Build Configuration

### For Netlify deployment, add to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
```

### Add export script to `package.json`:

```json
{
  "scripts": {
    "export": "next export"
  }
}
```

---

## 🔧 Troubleshooting

### Common Issues:

1. **Build fails on Netlify**
   - Make sure you added the export configuration
   - Check Node.js version is set to 18.x

2. **Images not loading**
   - Add `images: { unoptimized: true }` to next.config.js

3. **404 on refresh**
   - For Netlify: Add `_redirects` file with `/* /index.html 200`
   - For Vercel: No action needed (handled automatically)

---

## 🎯 Quick Commands

```bash
# Deploy to GitHub
chmod +x deploy-to-github.sh
./deploy-to-github.sh

# Test build locally
npm run build

# Test export (for Netlify)
npm run build && npm run export
```

---

## 🌐 Post-Deployment

After successful deployment:

1. **Custom Domain** (Optional)
   - Vercel: Project Settings → Domains
   - Netlify: Site Settings → Domain Management

2. **HTTPS**: Automatically enabled on both platforms

3. **Auto-Deploy**: Pushes to `main` branch auto-deploy

4. **Analytics**: Enable in platform settings

---

## 📞 Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Netlify Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Next.js Deployment**: [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)

---

## 🚀 One-Click Deploy Buttons

### Vercel:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kd26-droid/procurement-dashboard)

### Netlify:
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/kd26-droid/procurement-dashboard)

---

**Estimated Deployment Time**: 2-5 minutes ⚡