import { jsonResponse } from '../utils/response.js';

export async function handleUser(url) {
  const dni = url.searchParams.get('dni');

  if (!dni) {
    return jsonResponse({ error: "Parameter 'dni' is required" }, 400);
  }

  const API_URL = `https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/${dni}`;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      return jsonResponse(
        { error: 'Error fetching user data from external API' },
        500
      );
    }

    const data = await res.json();
    const records = data?.response?.data?.records || [];

    if (records.length === 0) {
      return jsonResponse({ error: `No user found with DNI: ${dni}` }, 404);
    }

    const record = records[0];
    const user = record?.User || {};
    const supervisor = record?.Supervisor || {};
    const customFields = record?.Customfieldvalue || [];

    const customFieldMap = {};
    customFields.forEach((item) => {
      const label = item?.Customfield?.field_label;
      const value = item?.field_value_alpha;
      if (label) {
        customFieldMap[label] = value;
      }
    });

    return jsonResponse({
      firstName: user?.name || '',
      lastName: user?.last_name || '',
      identificationNumber: user?.identification_number || '',
      primaryTransport: user?.primary_transport || '',
      alternativeTransport: user?.alternative_transportation || '',
      email: user?.email || '',
      phone: user?.phone || '',
      city: user?.city || '',
      state: user?.state || '',
      role: user?.role || '',
      clientId: user?.client_id || '',
      admissionDate: user?.admission_date || '',
      supervisor: {
        firstName: supervisor?.name || '',
        lastName: supervisor?.last_name || '',
        identificationNumber: supervisor?.identification_number || '',
      },
      customFields: customFieldMap,
    });
  } catch (error) {
    return jsonResponse(
      { error: 'Exception occurred while fetching user data' },
      500
    );
  }
}
