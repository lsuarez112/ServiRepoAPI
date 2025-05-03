import { jsonResponse } from '../utils/response.js';
import { processUsers } from './usersProcessor.js';
import { calculateTimeDifference } from '../utils/calculateTimeDifference.js';
import { buildGoogleMapsLink } from '../utils/buildGoogleMapsLink.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleMarcaciones(url) {
  const fromDate = url.searchParams.get('fromDate');
  const toDate = url.searchParams.get('toDate');
  const dni = url.searchParams.get('dni');
  const includeSupervised =
    url.searchParams.get('includeSupervised') === 'true';

  if (!fromDate || !toDate || !dni) {
    return jsonResponse(
      { error: "Parameters 'fromDate', 'toDate' and 'dni' are required" },
      400
    );
  }

  try {
    const userRes = await fetch(
      `https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/${dni}`
    );
    const userJson = await userRes.json();
    const userData = userJson?.response?.data?.records?.[0]?.User;
    if (!userData) {
      return jsonResponse({ error: 'User not found.' }, 404);
    }

    // console.log(
    //   '🛑 [handleMarcaciones] Sleeping 1.5 seconds before fetching supervised users...'
    // );
    await sleep(1500); // 1.5 segundos de espera

    const usersList = await processUsers(userData, includeSupervised);
    const result = {};

    for (const user of usersList) {
      await sleep(1000);

      const apiUrl = `https://cloud01.browix.com/v1/externalpermissions/getIntervalsInDateRange/uuid:5632674a4257a67218c812191c3efd81/${fromDate}/${toDate}/${user.identificationNumber}/returnOnlyDataPayload:1`;
      const intervalsRes = await fetch(apiUrl);
      const intervalsJson = await intervalsRes.json();
      const intervals = intervalsJson?.data || [];

      const groupedByDate = {};

      for (const interval of intervals) {
        const intervalData = interval.Interval;
        const branchIn = interval.BranchIn;

        const datetimeIn = new Date(intervalData.datetime_in);
        const datetimeOut = intervalData.datetime_out
          ? new Date(intervalData.datetime_out)
          : new Date();
        const dateKey = datetimeIn.toISOString().split('T')[0];

        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = {
            intervals: [],
            routeUrl: '',
            totalGrossHours: '',
            totalNetHours: '',
            totalTransferHours: '',
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
          // Campos adicionales que rellenamos luego
          mapIn: '',
          mapOut: '',
          from: '',
          transferLabel: '',
          transferTimeHMS: '',
        });
      }

      // Proceso para cada fecha
      for (const [dateKey, dayData] of Object.entries(groupedByDate)) {
        let totalNetMs = 0;
        let totalTransferMs = 0;
        const routePoints = [];

        dayData.intervals.forEach((interval, idx) => {
          const start = new Date(interval.datetime_in);
          const end = interval.datetime_out
            ? new Date(interval.datetime_out)
            : new Date();

          totalNetMs += end - start;
          routePoints.push(`${interval.latIn},${interval.lonIn}`);

          interval.mapIn = buildGoogleMapsLink(interval.latIn, interval.lonIn);
          interval.mapOut = buildGoogleMapsLink(
            interval.latOut,
            interval.lonOut
          );

          if (idx === 0) {
            interval.from = 'Start of Day';
            interval.transferLabel = 'Start of Day';
            interval.transferTimeHMS = '00:00:00';
          } else {
            const prev = dayData.intervals[idx - 1];
            const prevEnd = new Date(prev.datetime_out);
            const transfer = calculateTimeDifference(prevEnd, start);

            interval.from = buildGoogleMapsLink(
              prev.latOut,
              prev.lonOut,
              interval.latIn,
              interval.lonIn
            );
            interval.transferLabel = `${prev.location} --> ${interval.location}`;
            interval.transferTimeHMS = transfer.hms;
            totalTransferMs += start - prevEnd;
          }
        });

        const firstInterval = dayData.intervals[0];
        const lastInterval = dayData.intervals[dayData.intervals.length - 1];
        const gross = calculateTimeDifference(
          new Date(firstInterval.datetime_in),
          lastInterval.datetime_out
            ? new Date(lastInterval.datetime_out)
            : new Date()
        );

        // Métricas finales del día
        dayData.totalNetHours = new Date(totalNetMs)
          .toISOString()
          .substr(11, 8);
        dayData.totalTransferHours = new Date(totalTransferMs)
          .toISOString()
          .substr(11, 8);
        dayData.totalGrossHours = gross.hms;
        dayData.routeUrl = `https://www.google.com/maps/dir/${routePoints.join(
          '/'
        )}`;

        // 🔄 Ahora transformamos cada marcación para solo dejar las columnas útiles para el reporte
        dayData.intervals = dayData.intervals.map((marcacion, idx) => ({
          number: idx + 1,
          transferTimeBetween: marcacion.transferTimeHMS,
          branchName: marcacion.location,
          timeIn: marcacion.datetime_in || 'Sin Entrada Registrada',
          mapIn: marcacion.mapIn,
          timeOut: marcacion.datetime_out || 'Sin Salida Registrada',
          mapOut: marcacion.mapOut,
          transferLabel: marcacion.transferLabel,
          from: marcacion.from,
          transportType: user.primaryTransport || 'N/A',
        }));
      }

      // Guardamos todo agrupado por usuario
      result[user.fullName] = {
        dni: user.identificationNumber,
        data: groupedByDate,
      };
    }

    return jsonResponse({ status: 'OK', data: result });
  } catch (error) {
    console.error('Error in handleMarcaciones:', error);
    return jsonResponse({ error: 'Unexpected error occurred' }, 500);
  }
}
