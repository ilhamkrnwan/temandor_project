// Static preview server for `nuxt generate` output (Nitro static preset has no server).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

const root = normalize('.output/public')
const port = Number(process.env.PORT ?? 3000)
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = normalize(join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname))
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  }
  catch {
    res.writeHead(404).end('Not found')
  }
}).listen(port, () => console.log(`Preview: http://localhost:${port}`))
