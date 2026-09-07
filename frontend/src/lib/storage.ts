import { Directory, File, Paths } from 'expo-file-system';
import { StateStorage, createJSONStorage } from 'zustand/middleware';

/**
 * Synchronous JSON persistence on top of expo-file-system (already a dependency),
 * so zustand stores hydrate before first render with no extra package.
 */
const stateDir = new Directory(Paths.document, 'state');

const fileFor = (name: string) => new File(stateDir, `${name}.json`);

const fileStorage: StateStorage = {
  getItem: (name) => {
    try {
      const file = fileFor(name);
      return file.exists ? file.textSync() : null;
    } catch (error) {
      console.warn(`[storage] read ${name} failed`, error);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (!stateDir.exists) stateDir.create({ intermediates: true, idempotent: true });
      const file = fileFor(name);
      if (!file.exists) file.create();
      file.write(value);
    } catch (error) {
      console.warn(`[storage] write ${name} failed`, error);
    }
  },
  removeItem: (name) => {
    try {
      const file = fileFor(name);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn(`[storage] remove ${name} failed`, error);
    }
  },
};

export const jsonFileStorage = () => createJSONStorage(() => fileStorage);
