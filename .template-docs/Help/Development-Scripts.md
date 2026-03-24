# Development Scripts

Complete reference for all npm scripts available in this template.

All commands should be run from the `/web` directory.

---

## Core Development

### `npm run dev`

**Purpose:** Start development server with hot reload

```bash
npm run dev
```

- Opens: http://localhost:3000
- Hot reload enabled
- TypeScript checking active
- Fast Refresh for React components

---

### `npm run build`

**Purpose:** Create optimized production build

```bash
npm run build
```

- Compiles TypeScript
- Bundles and minifies
- Generates static pages
- Output: `.next/` folder

---

### `npm run start`

**Purpose:** Start production server (requires build first)

```bash
npm run build
npm run start
```

---

## Code Quality

### `npm run lint`

**Purpose:** Check code for linting errors

```bash
npm run lint
```

---

### `npm run lint:fix`

**Purpose:** Automatically fix linting errors

```bash
npm run lint:fix
```

---

### `npm run format`

**Purpose:** Format all code with Prettier

```bash
npm run format
```

---

### `npm run format:check`

**Purpose:** Check if code is formatted correctly

```bash
npm run format:check
```

---

## Testing

### `npm test`

**Purpose:** Run all Vitest tests

```bash
npm test
```

---

### `npm run test:watch`

**Purpose:** Run tests in watch mode

```bash
npm run test:watch
```

---

### `npm run test:coverage`

**Purpose:** Run tests with coverage report

```bash
npm run test:coverage
```

---

## Common Workflows

### Daily Development

```bash
# Morning routine
git pull
npm install                    # If package.json changed
npm run dev

# Throughout the day
npm run lint:fix              # Before committing
npm run format                # Format code
git add .
git commit -m "feat: ..."
```

### Before Pull Request

```bash
# Complete check
npm run lint
npm run format:check
npx tsc --noEmit
npm test
npm run build

# Or use Claude Code
/quality-check
```

---

## Troubleshooting

### Scripts hang or freeze

**Solution:**
```bash
# Kill port 3000
npx kill-port 3000

# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### Scripts fail after git pull

**Solution:**
```bash
# Reinstall dependencies
npm install

# Clear cache and rebuild
rm -rf .next node_modules
npm install
```

---

**Need more help?** Ask Claude Code about any script or workflow!
