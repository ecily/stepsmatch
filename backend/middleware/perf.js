// middleware/perf.js
import compression from 'compression';
import helmet from 'helmet';

// Minimal, sicher & schnell für API-JSON
export default function applyPerf(app) {
  // Security headers (ohne CSP, damit Maps/Images nicht brechen)
  app.use(helmet({ contentSecurityPolicy: false }));

  // GZIP/Brotli (Node bestimmt den besten Encoder)
  app.use(compression());

  // Sinnvolle API-Defaults
  app.set('trust proxy', 1); // falls hinter Proxy/DO Load Balancer
}
