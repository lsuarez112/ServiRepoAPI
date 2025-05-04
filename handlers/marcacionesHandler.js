import { jsonResponse } from '../utils/response.js';
import { processUsers } from './usersProcessor.js';
import { calculateTimeDifference } from '../utils/calculateTimeDifference.js';
import { buildGoogleMapsLink } from '../utils/buildGoogleMapsLink.js';

function msToHMS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleMarcaciones(url) {
  const fromDate = url.searchParams.get('fromDate');
  const toDate = url.searchParams.get('toDate');
  const dni = url.searchParams.get('dni');
  const includeSupervised =
    url.searchParams.get('includeSupervised') === 'true';
  const totalsOnly = url.searchParams.get('totalsOnly') === 'true';

  if (!fromDate || !toDate || !dni) {
    return jsonResponse(
      { error: "Parameters 'fromDate', 'toDate' and 'dni' are required" },
      400
    );
  }

  try {
    const userRes = await fetch(
      `https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/${dni}/returnOnlyDataPayload:1`
    );
    const userJson = await userRes.json();
    const userData = userJson?.data?.records[0]?.User;
    if (!userData) {
      return jsonResponse({ error: 'User not found.' }, 404);
    }

    await sleep(1500);

    const usersList = await processUsers(userData, includeSupervised);
    const result = {};
    const totals = {};

    for (const user of usersList) {
      await sleep(1000);

      const apiUrl = `https://cloud01.browix.com/v1/externalpermissions/getIntervalsInDateRange/uuid:5632674a4257a67218c812191c3efd81/${fromDate}/${toDate}/${user.identificationNumber}/returnOnlyDataPayload:1`;
      const intervalsRes = await fetch(apiUrl);
      const intervalsJson = await intervalsRes.json();
      const intervals = intervalsJson?.data || [];

      const groupedByDate = {};

      let userNetMs = 0;
      let userTransferMs = 0;
      let userGrossMs = 0;

      for (const interval of intervals) {
        const intervalData = interval.Interval;
        const branchIn = interval.BranchIn;

        const datetimeIn = new Date(intervalData.datetime_in);
        const datetimeOut = new Date(intervalData.datetime_out);
        const dateKey = datetimeIn.toISOString().split('T')[0];

        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = {
            intervals: [],
            routePoints: [],
          };
        }

        groupedByDate[dateKey].intervals.push({
          datetime_in: intervalData.datetime_in,
          datetime_out: intervalData.datetime_out,
          location: branchIn?.name || 'Unknown',
          latIn: intervalData.lat_in,
          lonIn: intervalData.lon_in,
          latOut: intervalData.lat_out,
          lonOut: intervalData.lon_out,
        });

        groupedByDate[dateKey].routePoints.push(
          `${intervalData.lat_in},${intervalData.lon_in}`
        );
      }

      const userDataObject = {};

      for (const [dateKey, dayData] of Object.entries(groupedByDate)) {
        let dayNetMs = 0;
        let dayTransferMs = 0;

        const processedIntervals = dayData.intervals.map((interval, idx) => {
          const start = new Date(interval.datetime_in);
          const end = new Date(interval.datetime_out);

          dayNetMs += end - start;

          let transferTimeHMS = '00:00:00';
          let transferLabel = 'Start of Day';
          let from = 'Start of Day';

          if (idx > 0) {
            const prev = dayData.intervals[idx - 1];
            const prevEnd = new Date(prev.datetime_out);
            const transfer = calculateTimeDifference(prevEnd, start);
            transferTimeHMS = transfer.hms;
            transferLabel = `${prev.location} --> ${interval.location}`;
            from = buildGoogleMapsLink(
              prev.latOut,
              prev.lonOut,
              interval.latIn,
              interval.lonIn
            );
            dayTransferMs += start - prevEnd;
          }

          return {
            number: idx + 1,
            transferTimeBetween: transferTimeHMS,
            branchName: interval.location,
            timeIn: interval.datetime_in || 'Sin Entrada Registrada',
            mapIn: buildGoogleMapsLink(interval.latIn, interval.lonIn),
            timeOut: interval.datetime_out || 'Sin Salida Registrada',
            mapOut: buildGoogleMapsLink(interval.latOut, interval.lonOut),
            transferLabel,
            from,
            transportType: user.primaryTransport || 'N/A',
          };
        });

        const firstInterval = dayData.intervals[0];
        const lastInterval = dayData.intervals[dayData.intervals.length - 1];
        const grossMs =
          new Date(lastInterval.datetime_out) -
          new Date(firstInterval.datetime_in);

        userDataObject[dateKey] = {
          intervals: processedIntervals,
          routeUrl: `https://www.google.com/maps/dir/${dayData.routePoints.join(
            '/'
          )}`,
          totalGrossHours: new Date(grossMs).toISOString().substr(11, 8),
          totalNetHours: new Date(dayNetMs).toISOString().substr(11, 8),
          totalTransferHours: new Date(dayTransferMs)
            .toISOString()
            .substr(11, 8),
        };

        userNetMs += dayNetMs;
        userTransferMs += dayTransferMs;
        userGrossMs += grossMs;
      }

      totals[user.fullName] = {
        totalNetHours: {
          decimal: +(userNetMs / 3600000).toFixed(2),
          hms: msToHMS(userNetMs),
        },
        totalTransferHours: {
          decimal: +(userTransferMs / 3600000).toFixed(2),
          hms: msToHMS(userTransferMs),
        },
        totalGrossHours: {
          decimal: +(userGrossMs / 3600000).toFixed(2),
          hms: msToHMS(userGrossMs),
        },
      };

      if (!totalsOnly) {
        result[user.fullName] = {
          dni: user.identificationNumber,
          data: userDataObject,
        };
      }
    }

    if (totalsOnly) {
      return jsonResponse({
        status: 'OK',
        totals,
      });
    } else {
      return jsonResponse({
        status: 'OK',
        data: result,
        totals,
      });
    }
  } catch (error) {
    console.error('Error in handleMarcaciones:', error);
    return jsonResponse({ error: 'Unexpected error occurred' }, 500);
  }
}
