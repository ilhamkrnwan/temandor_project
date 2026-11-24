// Peta seluruh ikon SVG komponen dari app/assets/svg/*.svg (dibundel Vite untuk dev & static build).
const svgModules = import.meta.glob<string>('../assets/svg/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const svgUrlByName: Record<string, string> = {}
for (const [path, url] of Object.entries(svgModules)) {
  const match = /\/([^/]+)\.svg$/.exec(path)
  if (match?.[1]) {
    svgUrlByName[match[1]] = url
  }
}

export function getComponentIconUrl(iconName?: string): string {
  if (!iconName) return ''
  return svgUrlByName[iconName] ?? ''
}
