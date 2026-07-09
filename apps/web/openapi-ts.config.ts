import { defineConfig } from '@hey-api/openapi-ts';

// Regenerates the TypeScript API client from the running FastAPI OpenAPI spec.
// Usage: start apps/api (uvicorn on :8000), then `npm run gen:api`.
export default defineConfig({
  input: 'http://localhost:8000/openapi.json',
  output: 'src/lib/api',
  client: '@hey-api/client-fetch',
});
