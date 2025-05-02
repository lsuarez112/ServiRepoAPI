/**
 * Processes the user data to build the list of users to fetch intervals for.
 * @param {Object} userData - The main user object (from Browix API).
 * @param {boolean} includeSupervised - Whether to include supervised employees.
 * @returns {Promise<Array>} - Promise resolving to an array of user objects to process.
 */
export async function processUsers(userData, includeSupervised) {
  const supervisorId = userData?.identification_number;
  const usersList = [];

  // console.log(`🔍 [processUsers] Supervisor ID: ${supervisorId}`);
  // console.log(`🔍 [processUsers] Include supervised: ${includeSupervised}`);

  // Always include the main user first
  const mainUser = {
    fullName: `${userData?.last_name || 'UnknownLastName'}, ${
      userData?.name || 'UnknownName'
    }`,
    identificationNumber: supervisorId,
    primaryTransport: userData?.primary_transport || 'Unknown',
    secondaryTransport: userData?.alternative_transportation || 'Unknown',
  };

  // console.log(`✅ [processUsers] Added main user: ${mainUser.fullName}`);
  usersList.push(mainUser);

  if (includeSupervised) {
    const API_SUPERVISED_URL =
      'https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/limit:200/page:1';

    // console.log(
    //   `➡️ [processUsers] Fetching supervised from: ${API_SUPERVISED_URL}`
    // );

    const resSupervised = await fetch(API_SUPERVISED_URL);
    // console.log(`📶 [processUsers] Response status: ${resSupervised.status}`);

    if (!resSupervised.ok) {
      // console.warn(
      //   `⚠️ [processUsers] Error fetching supervised employees for supervisor ID ${supervisorId}`
      // );
      return usersList; // Return only the main user if there's an error
    }

    const dataSupervised = await resSupervised.json();
    const supervisedRecords = dataSupervised?.response?.data?.records || [];
    // console.log(
    //   `📊 [processUsers] Supervised records found: ${supervisedRecords.length}`
    // );

    if (supervisedRecords.length === 0) {
      // console.warn(
      //   `⚠️ [processUsers] No supervised employees found for supervisor ID ${supervisorId}.`
      // );
      return usersList;
    }

    for (const record of supervisedRecords) {
      const supervisorData = record?.Supervisor || {};
      const supervisorOfRecord = supervisorData?.identification_number;

      // console.log(
      //   `👀 [processUsers] Found supervisor ID in record: ${supervisorOfRecord}`
      // );

      if (supervisorOfRecord !== supervisorId) {
        // console.log(
        //   `⏭️ [processUsers] Skipped: Supervisor ID does not match (${supervisorOfRecord} !== ${supervisorId})`
        // );
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

      // console.log(
      //   `✅ [processUsers] Added supervised user: ${userItem.fullName}`
      // );
      usersList.push(userItem);
    }
  }

  // console.log(`🔚 [processUsers] Total users to process: ${usersList.length}`);
  return usersList;
}
