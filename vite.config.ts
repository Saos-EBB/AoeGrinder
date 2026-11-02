import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build erzeugt eine einzelne dist/index.html für das Artifact,
// npm run build:vfx eine einzelne dist-vfx/vfx.html fürs VFX-Labor. Im Dev-Server liegt es unter /vfx.html.
export default defineConfig(({ mode }) => ({
  plugins: [viteSingleFile()],
  build: mode === 'vfx' ? { outDir: 'dist-vfx', rollupOptions: { input: 'vfx.html' } } : {},
}));
