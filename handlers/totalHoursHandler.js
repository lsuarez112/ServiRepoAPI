import { jsonResponse } from '../utils/response.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleTotalHours(url) {
  const fromDate = url.searchParams.get('fromDate');
  const toDate = url.searchParams.get('toDate');
  const dni = url.searchParams.get('dni');

  if (!fromDate || !toDate || !dni) {
    return jsonResponse(
      { error: "Parameters 'fromDate', 'toDate' and 'dni' are required" },
      400
    );
  }

  try {
    const apiUrl = `https://cloud01.browix.com/v1/externalpermissions/getIntervalsInDateRange/uuid:5632674a4257a67218c812191c3efd81/${fromDate}/${toDate}/${dni}/returnOnlyDataPayload:1`;
    const intervalsRes = await fetch(apiUrl);
    const intervalsJson = await intervalsRes.json();
    const intervals = intervalsJson?.data || [];

    // Agrupamos solo los datos necesarios (entrada/salida)
    const groupedByDate = {};

    for (const interval of intervals) {
      const intervalData = interval.Interval;

      const datetimeIn = new Date(intervalData.datetime_in);
      const datetimeOut = intervalData.datetime_out
        ? new Date(intervalData.datetime_out)
        : new Date();
      const dateKey = datetimeIn.toISOString().split('T')[0];

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }

      groupedByDate[dateKey].push({
        datetime_in: intervalData.datetime_in,
        datetime_out: intervalData.datetime_out,
      });
    }

    // Totales globales
    let totalNetMs = 0;
    let totalTransferMs = 0;
    let totalGrossMs = 0;

    for (const [dateKey, dayIntervals] of Object.entries(groupedByDate)) {
      let dailyNetMs = 0;
      let dailyTransferMs = 0;

      // Ordenamos por hora de entrada
      dayIntervals.sort(
        (a, b) => new Date(a.datetime_in) - new Date(b.datetime_in)
      );

      // Sumamos neto
      dayIntervals.forEach((interval, idx) => {
        const start = new Date(interval.datetime_in);
        const end = interval.datetime_out
          ? new Date(interval.datetime_out)
          : new Date();

        dailyNetMs += end - start;

        if (idx > 0) {
          const prev = dayIntervals[idx - 1];
          const prevEnd = new Date(prev.datetime_out);
          const transferMs = start - prevEnd;
          dailyTransferMs += transferMs;
        }
      });

      // Calculamos bruto (primera entrada a última salida)
      const firstInterval = dayIntervals[0];
      const lastInterval = dayIntervals[dayIntervals.length - 1];
      const grossMs =
        new Date(
          lastInterval.datetime_out
            ? lastInterval.datetime_out
            : new Date()
        ) - new Date(firstInterval.datetime_in);

      // Acumulamos en los totales globales
      totalNetMs += dailyNetMs;
      totalTransferMs += dailyTransferMs;
      totalGrossMs += grossMs;
    }

    // Conversión a decimal y HMS
    const totals = (ms) => {
      const totalSeconds = ms / 1000;
      const decimal = +(totalSeconds / 3600).toFixed(2);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const hms = `${hours}:${String(minutes).padStart(2, '0')}:${String(
        seconds
      ).padStart(2, '0')}`;
      return { decimal, hms };
    };

    const result = {
      totalNetHours: totals(totalNetMs),
      totalTransferHours: totals(totalTransferMs),
      totalGrossHours: totals(totalGrossMs),
    };

    return jsonResponse({ status: 'OK', data: result });
  } catch (error) {
    console.error('Error in handleTotalHours:', error);
    return jsonResponse({ error: 'Unexpected error occurred' }, 500);
  }
}
