/**
 * Processes the user data to build the list of users to fetch intervals for.
 * @param {Object} userData - The main user object (from Browix API).
 * @param {boolean} includeSupervised - Whether to include supervised employees.
 * @returns {Promise<Array>} - Promise resolving to an array of user objects to process.
 */
export async function processUsers(userData, includeSupervised) {
  const supervisorId = userData?.identification_number;
  const usersList = [];

  // Always include the main user first
  const mainUser = {
    fullName: `${userData?.last_name || 'UnknownLastName'}, ${
      userData?.name || 'UnknownName'
    }`,
    identificationNumber: supervisorId,
    primaryTransport: userData?.primary_transport || 'Unknown',
    secondaryTransport: userData?.alternative_transportation || 'Unknown',
  };

  usersList.push(mainUser);

  if (includeSupervised) {
    const API_SUPERVISED_URL =
      'https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/limit:200/page:1';

    const resSupervised = await fetch(API_SUPERVISED_URL);
    if (!resSupervised.ok) {
      console.warn(
        `Error fetching supervised employees for supervisor ID ${supervisorId}`
      );
      return usersList; // Return only the main user if there's an error
    }

    const dataSupervised = await resSupervised.json();
    const supervisedRecords = dataSupervised?.response?.data?.records || [];

    if (supervisedRecords.length === 0) {
      console.warn(
        `No supervised employees found for supervisor ID ${supervisorId}.`
      );
      return usersList;
    }

    for (const record of supervisedRecords) {
      const supervisorData = record?.Supervisor || {};
      if (supervisorData?.identification_number !== supervisorId) {
        continue; // Only include employees supervised by this specific supervisor
      }

      const userInfo = record?.User || {};
      const userItem = {
        fullName: `${userInfo?.last_name || 'UnknownLastName'}, ${
          userInfo?.name || 'UnknownName'
        }`,
        identificationNumber: userInfo?.identification_number || 'UnknownID',
        primaryTransport: userInfo?.primary_transport || 'Unknown',
        secondaryTransport: userInfo?.alternative_transportation || 'Unknown',
      };

      usersList.push(userItem);
    }
  }

  return usersList;
}
