import fs from 'fs';
import path from 'path';

export async function loadModulesArray<T>(dir: string): Promise<T[]> {
  const files = fs.readdirSync(dir);
  const modules: T[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      modules.push(...await loadModulesArray<T>(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(fullPath);
      if (mod && (mod.data || mod.execute)) {
        modules.push(mod);
      } else if (mod && mod.default) {
        modules.push(mod.default);
      }
    }
  }
  return modules;
} 