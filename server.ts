import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');
const PUBLIC_TOUR_DATA_FILE = path.resolve(__dirname, 'public', 'tour-data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseSchema {
  properties: any[];
  config: any;
  selectedPropertyId?: string;
  activeRoomId?: string;
  updatedAt: string;
}

function readDB(): DatabaseSchema | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  return null;
}

function writeDB(data: Partial<DatabaseSchema>) {
  try {
    const existing = readDB() || {
      properties: [],
      config: {},
      updatedAt: new Date().toISOString(),
    };
    const updated: DatabaseSchema = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    try {
      fs.writeFileSync(PUBLIC_TOUR_DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (pubErr) {
      console.warn('Could not write to public/tour-data.json:', pubErr);
    }
    return updated;
  } catch (err) {
    console.error('Error writing to database file:', err);
    throw err;
  }
}

async function startServer() {
  const app = express();

  // High payload limit for 4K textures, floorplans, and property media
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- RESTful Backend Persistence Endpoints ---

  // GET /api/properties
  app.get('/api/properties', (req, res) => {
    const db = readDB();
    if (db && Array.isArray(db.properties) && db.properties.length > 0) {
      return res.json({ success: true, properties: db.properties });
    }
    return res.json({ success: true, properties: [] });
  });

  // POST /api/properties
  app.post('/api/properties', (req, res) => {
    const { properties } = req.body;
    if (!Array.isArray(properties)) {
      return res.status(400).json({ success: false, message: 'properties must be an array' });
    }
    const saved = writeDB({ properties });
    return res.json({ success: true, count: saved.properties.length });
  });

  // GET /api/config
  app.get('/api/config', (req, res) => {
    const db = readDB();
    return res.json(db?.config || null);
  });

  // POST /api/config
  app.post('/api/config', (req, res) => {
    const config = req.body;
    writeDB({ config });
    return res.json({ success: true, config });
  });

  // GET /api/active-state
  app.get('/api/active-state', (req, res) => {
    const db = readDB();
    return res.json({
      selectedPropertyId: db?.selectedPropertyId || null,
      activeRoomId: db?.activeRoomId || null,
    });
  });

  // POST /api/active-state
  app.post('/api/active-state', (req, res) => {
    const { selectedPropertyId, activeRoomId } = req.body;
    writeDB({ selectedPropertyId, activeRoomId });
    return res.json({ success: true });
  });

  // POST /api/reset
  app.post('/api/reset', (req, res) => {
    try {
      if (fs.existsSync(DB_FILE)) {
        fs.unlinkSync(DB_FILE);
      }
    } catch {}
    return res.json({ success: true, message: 'Database reset to defaults' });
  });

  // GET /api/video-stream?url=...
  // Transparent streaming proxy for Google Drive and external videos with HTTP 206 Partial Content (Byte-Range) and CORS support
  app.get('/api/video-stream', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const upstreamRes = await fetch(targetUrl, {
        headers,
        redirect: 'follow',
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type, Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      res.setHeader('Accept-Ranges', 'bytes');

      const contentType = upstreamRes.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', contentType);

      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }

      const contentLength = upstreamRes.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      res.status(upstreamRes.status);

      if (upstreamRes.body) {
        const { Readable } = await import('stream');
        // @ts-ignore
        const nodeStream = Readable.fromWeb(upstreamRes.body as any);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('[Video Proxy] Error streaming video:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to fetch video stream from remote host' });
      }
    }
  });

  // --- Development & Production Serving ---
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VibeTour Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[VibeTour Backend] Failed to start server:', err);
  process.exit(1);
});
