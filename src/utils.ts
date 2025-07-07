import fs from 'fs';
import path from 'path';

export interface CommandModule {
  data: { name: string };
  execute: (...args: any[]) => any;
}

export interface InteractionModule {
  data: { name: string | RegExp | (string | RegExp)[] };
  execute: (...args: any[]) => any;
}

export async function loadModulesArray<T extends { data: any; execute: any }>(dir: string): Promise<T[]> {
  const modules: T[] = [];
  async function traverse(currentPath: string) {
    for (const file of fs.readdirSync(currentPath)) {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        await traverse(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const imported = await import(fullPath.replace(/\\/g, '/'));
        if (imported.data && imported.execute) {
          modules.push(imported as T);
        }
      }
    }
  }
  await traverse(dir);
  return modules;
} 