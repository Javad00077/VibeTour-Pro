/**
 * Regenerates public/tour-data.json (static GitHub Pages payload) and
 * data/database.json (local Express backend DB) from src/data/properties.ts.
 *
 * Run with:  npx tsx scripts/gen-tour-data.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LUXURY_PROPERTIES, DEFAULT_CONFIG } from '../src/data/properties';
import { sanitizeProperties, sanitizeConfig } from '../src/services/storageService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const payload = {
  properties: sanitizeProperties(LUXURY_PROPERTIES),
  config: sanitizeConfig(DEFAULT_CONFIG),
  selectedPropertyId: LUXURY_PROPERTIES[0]?.id,
  activeRoomId: LUXURY_PROPERTIES[0]?.rooms[0]?.id,
  updatedAt: new Date().toISOString()
};

const targets = [
  path.resolve(projectRoot, 'public', 'tour-data.json'),
  path.resolve(projectRoot, 'data', 'database.json')
];

targets.forEach((target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`✓ wrote ${path.relative(projectRoot, target)}`);
});

console.log(`✓ ${payload.properties[0].rooms.length} rooms · config speed ${payload.config.scrollSpeedFactor}x`);
