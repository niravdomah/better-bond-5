#!/usr/bin/env node

/**
 * Environment setup script
 * - Creates .env.local from .env.example if it doesn't exist
 * - Generates NEXTAUTH_SECRET if not present or contains placeholder
 *
 * Run manually with: npm run setup:env
 * Also called automatically by the welcome script during postinstall
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
const ENV_EXAMPLE_PATH = path.join(__dirname, '..', '.env.example');

// Allow silent mode for programmatic use
const silent = process.argv.includes('--silent');

function log(message) {
  if (!silent) {
    console.log(message);
  }
}

function setupEnvironment() {
  let envCreated = false;
  let secretGenerated = false;

  // Check if .env.local exists
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    if (fs.existsSync(ENV_EXAMPLE_PATH)) {
      fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_LOCAL_PATH);
      envCreated = true;
      log('✅ Created .env.local from .env.example');
    } else {
      const basicEnv = `NEXT_PUBLIC_API_BASE_URL=http://localhost:8042\nNEXTAUTH_URL=http://localhost:3000\nNEXTAUTH_SECRET=\n`;
      fs.writeFileSync(ENV_LOCAL_PATH, basicEnv);
      envCreated = true;
      log('✅ Created .env.local');
    }
  }

  // Check if NEXTAUTH_SECRET needs to be generated
  const envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
  const secretMatch = envContent.match(/NEXTAUTH_SECRET=(.*)$/m);
  const currentSecret = secretMatch ? secretMatch[1].trim() : '';

  // Check if secret is missing, empty, or a placeholder value
  const isPlaceholder =
    !currentSecret ||
    currentSecret.length < 20 ||
    /^["']?["']?$/.test(currentSecret) ||
    /your[-_]?secret/i.test(currentSecret) ||
    /placeholder/i.test(currentSecret) ||
    /changeme/i.test(currentSecret) ||
    /secret[-_]?key[-_]?here/i.test(currentSecret) ||
    /generate[-_]?with[-_]?openssl/i.test(currentSecret);

  if (isPlaceholder) {
    // Generate secure random secret (32 bytes = 44 chars base64)
    const secret = crypto.randomBytes(32).toString('base64');

    let updatedEnv = envContent;
    if (envContent.includes('NEXTAUTH_SECRET=')) {
      updatedEnv = envContent.replace(
        /NEXTAUTH_SECRET=.*/,
        `NEXTAUTH_SECRET=${secret}`,
      );
    } else {
      updatedEnv = envContent.trim() + `\nNEXTAUTH_SECRET=${secret}\n`;
    }

    fs.writeFileSync(ENV_LOCAL_PATH, updatedEnv);
    secretGenerated = true;
    log('🔐 Generated NEXTAUTH_SECRET automatically');
  } else {
    log('✅ NEXTAUTH_SECRET already configured');
  }

  return { envCreated, secretGenerated };
}

// Run if called directly
if (require.main === module) {
  setupEnvironment();
}

module.exports = { setupEnvironment };
