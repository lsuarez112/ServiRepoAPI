/**
 * Processes the user data to build the list of users to query.
 * @param {Object} userData - The main user object (from Browix API).
 * @param {boolean} includeSupervised - Whether to include supervised employees.
 * @returns {Promise<Object>} - Promise resolving to an object structured with all processed users.
 */
export async function processUsers(userData, includeSupervised) {
  const supervisorId = userData?.identification_number;
  const usersData = {};

  if (includeSupervised) {
    const API_SUPERVISED_URL =
      'https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/limit:200/page:1';

    const resSupervised = await fetch(API_SUPERVISED_URL);
    if (!resSupervised.ok) {
      console.warn(
        `Error fetching supervised employees for supervisor ID ${supervisorId}`
      );
      return usersData;
    }

    const dataSupervised = await resSupervised.json();
    const supervisedRecords = dataSupervised?.response?.data?.records || [];

    if (supervisedRecords.length === 0) {
      console.warn(
        `Warning: No supervised employees found for supervisor ID ${supervisorId}.`
      );
    }

    for (const record of supervisedRecords) {
      const supervisorData = record?.Supervisor || {};
      if (supervisorData?.identification_number !== supervisorId) {
        continue; // Only include employees supervised by this specific supervisor
      }

      const userInfo = record?.User || {};
      const firstName = userInfo?.name || 'UnknownName';
      const lastName = userInfo?.last_name || 'UnknownLastName';
      const identificationNumber =
        userInfo?.identification_number || 'UnknownID';

      const userName = `${lastName}, ${firstName}`;
      if (!usersData[userName]) {
        usersData[userName] = {
          intervals: {},
          primaryTransport: userInfo?.primary_transport || 'Unknown',
          secondaryTransport: userInfo?.alternative_transportation || 'Unknown',
          identificationNumber: identificationNumber,
        };
      }
    }
  }

  // Always include the main user
  const firstName = userData?.name || 'UnknownName';
  const lastName = userData?.last_name || 'UnknownLastName';
  const userName = `${lastName}, ${firstName}`;

  if (!usersData[userName]) {
    usersData[userName] = {
      intervals: {},
      primaryTransport: userData?.primary_transport || 'Unknown',
      secondaryTransport: userData?.alternative_transportation || 'Unknown',
      identificationNumber: supervisorId,
    };
  }

  return usersData;
}
