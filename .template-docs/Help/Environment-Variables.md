# Environment Variables

Complete guide to configuring environment variables for this template.

---

## Quick Setup

```bash
cd web

# Copy example to local
cp .env.example .env.local

# Generate secret
openssl rand -base64 32

# Edit .env.local and add the generated secret
```

---

## Required Variables

### `NEXT_PUBLIC_API_BASE_URL`

**Purpose:** Base URL for external API calls

**Values:**
- Development: `http://localhost:8042`
- Production: Your API server URL

### `NEXTAUTH_URL`

**Purpose:** Base URL for your application

**Values:**
- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

### `NEXTAUTH_SECRET`

**Purpose:** Secret key for encrypting session tokens

**Generate:**
```bash
openssl rand -base64 32
```

**Important:**
- Use different secrets for dev/prod
- Never commit to git
- Minimum 32 characters

---

## Optional Variables

### OAuth Providers

#### Google OAuth

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

#### GitHub OAuth

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## File Structure

### `.env.example`
- Committed to git
- Contains all variable names with placeholder values
- Used as template for `.env.local`

### `.env.local`
- **NOT committed to git** (in `.gitignore`)
- Contains actual secrets
- Used by Next.js automatically

---

## Using Environment Variables

### Server-Side

Access via `process.env`:

```typescript
// app/api/example/route.ts
export async function GET() {
  const secret = process.env.NEXTAUTH_SECRET;
  // Only available server-side
}
```

### Client-Side

Prefix with `NEXT_PUBLIC_`:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
```

```typescript
// components/Example.tsx
'use client';

export default function Example() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  // Available client-side
}
```

**Warning:** Never expose secrets via `NEXT_PUBLIC_` prefix!

---

## Example `.env.local`

```bash
# ==================
# API Configuration
# ==================
NEXT_PUBLIC_API_BASE_URL=http://localhost:8042

# ==================
# Authentication
# ==================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret-key-minimum-32-characters

# ==================
# OAuth Providers (Optional)
# ==================
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## Troubleshooting

### "NEXTAUTH_SECRET is not set"

**Solution:**
```bash
# Generate new secret
openssl rand -base64 32

# Add to .env.local
echo "NEXTAUTH_SECRET=<generated-secret>" >> .env.local

# Restart dev server
npm run dev
```

### Environment variables not loading

**Checklist:**
- [ ] File is named `.env.local` (not `.env.local.txt`)
- [ ] File is in `web/` directory (same as `package.json`)
- [ ] Dev server restarted after changes
- [ ] Variable names are exactly correct (case-sensitive)

---

**Need more help?** Ask Claude Code about environment configuration!
