import { createStore, del, get, set, values } from 'idb-keyval'
import { cloneProject, migrateProjectData, type Project } from '#shared/cad'

export interface ProjectStorageAdapter {
  load(id: string): Promise<Project | null>
  save(project: Project): Promise<number>
  remove(id: string): Promise<void>
  list(): Promise<Project[]>
}

let idbStore: ReturnType<typeof createStore> | null = null

function getIdbStore() {
  if (!idbStore) {
    idbStore = createStore('temandor', 'projects')
  }
  return idbStore
}

export const indexedDbProjectStorage: ProjectStorageAdapter = {
  async load(id: string): Promise<Project | null> {
    if (typeof indexedDB === 'undefined') return null
    const raw = await get<unknown>(id, getIdbStore())
    if (raw == null) return null
    const parsed = migrateProjectData(raw, { freshId: false })
    return parsed.ok ? parsed.project : null
  },

  async save(project: Project): Promise<number> {
    if (typeof indexedDB === 'undefined') return Date.now()
    const updated = Date.now()
    const plain: Project = { ...cloneProject(project), updated }
    await set(plain.id, plain, getIdbStore())
    return updated
  },

  async remove(id: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return
    await del(id, getIdbStore())
  },

  async list(): Promise<Project[]> {
    if (typeof indexedDB === 'undefined') return []
    const all = await values<unknown>(getIdbStore())
    const valid: Project[] = []
    for (const item of all) {
      const parsed = migrateProjectData(item, { freshId: false })
      if (parsed.ok) valid.push(parsed.project)
    }
    return valid.sort((a, b) => b.updated - a.updated)
  },
}

/** Penyimpanan in-memory sederhana untuk unit test (tanpa IndexedDB browser). */
export function createMemoryProjectStorage(initial: Project[] = []): ProjectStorageAdapter {
  const map = new Map<string, Project>()
  for (const item of initial) {
    map.set(item.id, cloneProject(item))
  }
  return {
    async load(id: string) {
      const found = map.get(id)
      return found ? cloneProject(found) : null
    },
    async save(project: Project) {
      const updated = Date.now()
      map.set(project.id, { ...cloneProject(project), updated })
      return updated
    },
    async remove(id: string) {
      map.delete(id)
    },
    async list() {
      return [...map.values()].map(cloneProject).sort((a, b) => b.updated - a.updated)
    },
  }
}
