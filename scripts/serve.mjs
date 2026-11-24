// Static preview server for `nuxt generate` output (Nitro static preset has no server).
// Mirrors static-host directory resolution and SPA fallback rules in `public/_redirects`.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

const root = normalize('.output/public')
const port = Number(process.env.PORT ?? 3000)
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function isSpaRoute(pathname) {
  return pathname === '/proyek'
    || pathname.startsWith('/proyek/')
    || pathname.startsWith('/editor/')
}

async function resolveStaticFile(pathname) {
  const candidate = normalize(join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname))
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return { status: 403 }
  }

  try {
    const info = await stat(candidate)
    if (info.isFile()) return { status: 200, file: candidate }
    if (info.isDirectory()) {
      const indexFile = join(candidate, 'index.html')
      const indexInfo = await stat(indexFile)
      if (indexInfo.isFile()) return { status: 200, file: indexFile }
    }
  }
  catch {
    // Fall through to SPA fallback or 404.html
  }

  if (isSpaRoute(pathname)) {
    return { status: 200, file: join(root, '200.html') }
  }

  return { status: 404, file: join(root, '404.html') }
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const resolved = await resolveStaticFile(pathname)

  if (resolved.status === 403) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const body = await readFile(resolved.file)
    res.writeHead(resolved.status, { 'content-type': types[extname(resolved.file)] ?? 'application/octet-stream' })
    res.end(body)
  }
  catch {
    res.writeHead(404).end('Not found')
  }
}).listen(port, () => console.log(`Preview: http://localhost:${port}`))
