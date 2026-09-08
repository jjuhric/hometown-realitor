import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, 'storage', 'rooms');

// Ensure directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export function saveRoomState(roomId, state) {
  try {
    const filePath = path.join(STORAGE_DIR, `${roomId}.json`);
    const tempPath = path.join(STORAGE_DIR, `${roomId}.json.tmp`);
    const serialized = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[Persistence] Failed to save room ${roomId}:`, err);
    return false;
  }
}

export function loadRoomState(roomId) {
  try {
    const filePath = path.join(STORAGE_DIR, `${roomId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`[Persistence] Failed to load room ${roomId}:`, err);
  }
  return null;
}

export function deleteRoomState(roomId) {
  try {
    const filePath = path.join(STORAGE_DIR, `${roomId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[Persistence] Failed to delete room ${roomId}:`, err);
  }
}

export function listSavedRooms() {
  try {
    const files = fs.readdirSync(STORAGE_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => path.basename(f, '.json'));
  } catch (err) {
    console.error('[Persistence] Error listing saved rooms:', err);
    return [];
  }
}
