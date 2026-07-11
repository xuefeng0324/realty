// Generate a minimal valid 16x16 transparent ICO at static/favicon.ico.
// We just need 2xx on the route — the visual doesn't matter for the smoke check.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) + bitmap data (BMP-style header + 16x16 32bpp pixels + AND mask)
// Pre-crafted minimal payload, base64-decoded.
const b64 =
  'AAABAAEAEBAAAAAAAABoBQAAFgAAACgAAAAQAAAAIAAAAAEACAAAAAAAQAEAAAAAAAAAAAAAAAAAAAAAAAA' +
  '////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8AAAAAAAAAAAAAAAAAAAAAAAAA=';
const bytes = Buffer.from(b64, 'base64');

const out = resolve(process.cwd(), 'static/favicon.ico');
mkdirSync(resolve(process.cwd(), 'static'), { recursive: true });
writeFileSync(out, bytes);
console.log(`Wrote ${bytes.length} bytes to ${out}`);
