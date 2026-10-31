import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build erzeugt eine einzelne dist/index.html für das Artifact
export default defineConfig({
  plugins: [viteSingleFile()],
});
