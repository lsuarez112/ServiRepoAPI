import { handleUser } from './handlers/userHandler.js';
import { handleSupervisedUsers } from './handlers/handleSupervisedUsers.js';
import { handleMarcaciones } from './handlers/marcacionesHandler.js';
import { handleTotalHours } from './handlers/totalHoursHandler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/user') return await handleUser(url);
    if (path === '/supervicedUsers') return await handleSupervisedUsers(url);
    if (path === '/marcaciones') return await handleMarcaciones(url);
    if (path === '/totalHours') return await handleTotalHours(url);

    return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
