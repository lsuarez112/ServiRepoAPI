import { handleUser } from './handlers/userHandler.js';
import { handleMarcaciones } from './handlers/marcacionesHandler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/user') return await handleUser(url);
    if (path === '/marcaciones') return await handleMarcaciones(url);

    return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
