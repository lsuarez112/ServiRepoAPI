import { jsonResponse } from '../utils/response.js';

/**
 * Fetches and returns the list of supervised users for a given supervisor.
 * @param {URL} url - The request URL with query params.
 * @returns {Promise<Response>}
 */
export async function handleSupervisedUsers(url) {
  const supervisorDni = url.searchParams.get('dni');

  if (!supervisorDni) {
    return jsonResponse(
      { error: "Parameter 'dni' (supervisor DNI) is required" },
      400
    );
  }

  try {
    const API_SUPERVISED_URL =
      'https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/limit:200/page:1';

    const res = await fetch(API_SUPERVISED_URL);

    if (!res.ok) {
      return jsonResponse(
        {
          error: 'Failed to fetch supervised employees from the API',
        },
        500
      );
    }

    const data = await res.json();
    const records = data?.response?.data?.records || [];

    const supervisedUsers = records
      .filter((record) => {
        const supervisorData = record?.Supervisor || {};
        return supervisorData?.identification_number === supervisorDni;
      })
      .map((record) => {
        const user = record?.User || {};
        return {
          fullName: `${user?.last_name || 'UnknownLastName'}, ${
            user?.name || 'UnknownName'
          }`,
          dni: user?.identification_number || 'UnknownID',
          email: user?.email || '',
          phone: user?.phone || '',
          city: user?.city || '',
          state: user?.state || '',
          primaryTransport: user?.primary_transport || '',
          alternativeTransport: user?.alternative_transportation || '',
          role: user?.role || '',
          clientId: user?.client_id || '',
          admissionDate: user?.admission_date || '',
        };
      });

    return jsonResponse({
      status: 'OK',
      count: supervisedUsers.length,
      supervisorDni,
      supervisedUsers,
    });
  } catch (error) {
    console.error('Error in handleSupervisedUsers:', error);
    return jsonResponse({ error: 'Unexpected error occurred' }, 500);
  }
}
