const fs = require('fs');
const path = require('path');

const ENV_FILE_CANDIDATES = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '.env')
];

function stripWrappingQuotes(value) {
  const trimmed = String(value || '').trim();
  const startsWithDoubleQuote = trimmed.startsWith('"') && trimmed.endsWith('"');
  const startsWithSingleQuote = trimmed.startsWith("'") && trimmed.endsWith("'");

  if (!startsWithDoubleQuote && !startsWithSingleQuote) {
    return trimmed;
  }

  const unwrapped = trimmed.slice(1, -1);
  if (startsWithDoubleQuote) {
    return unwrapped
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"');
  }

  return unwrapped;
}

function parseEnvLine(line) {
  const match = String(line || '').match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return null;

  return {
    key: match[1],
    value: stripWrappingQuotes(match[2])
  };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const entry = parseEnvLine(line);
    if (!entry) {
      continue;
    }

    // Keep explicit shell/process variables as the source of truth.
    if (process.env[entry.key] == null || process.env[entry.key] === '') {
      process.env[entry.key] = entry.value;
    }
  }

  return true;
}

function loadEnvironment() {
  for (const filePath of ENV_FILE_CANDIDATES) {
    if (loadEnvFile(filePath)) {
      return filePath;
    }
  }

  return null;
}

const loadedEnvFile = loadEnvironment();

module.exports = {
  ENV_FILE_CANDIDATES,
  loadedEnvFile,
  loadEnvironment
};
