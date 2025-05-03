var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-IIHPmq/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// utils/response.js
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
__name(jsonResponse, "jsonResponse");

// handlers/userHandler.js
async function handleUser(url) {
  const dni = url.searchParams.get("dni");
  if (!dni) {
    return jsonResponse({ error: "Parameter 'dni' is required" }, 400);
  }
  const API_URL = `https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/${dni}/returnOnlyDataPayload:1`;
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      return jsonResponse(
        { error: "Error fetching user data from external API" },
        500
      );
    }
    const jsonData = await res.json();
    const records = jsonData?.data?.records || [];
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
      firstName: user?.name || "",
      lastName: user?.last_name || "",
      identificationNumber: user?.identification_number || "",
      primaryTransport: user?.primary_transport || "",
      alternativeTransport: user?.alternative_transportation || "",
      email: user?.email || "",
      phone: user?.phone || "",
      city: user?.city || "",
      state: user?.state || "",
      role: user?.role || "",
      clientId: user?.client_id || "",
      admissionDate: user?.admission_date || "",
      supervisor: {
        firstName: supervisor?.name || "",
        lastName: supervisor?.last_name || "",
        identificationNumber: supervisor?.identification_number || ""
      },
      customFields: customFieldMap
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Exception occurred while fetching user data",
        details: error.message
      },
      500
    );
  }
}
__name(handleUser, "handleUser");

// handlers/usersProcessor.js
async function processUsers(userData, includeSupervised) {
  const supervisorId = userData?.identification_number;
  const usersList = [];
  const mainUser = {
    fullName: `${userData?.last_name || "UnknownLastName"}, ${userData?.name || "UnknownName"}`,
    identificationNumber: supervisorId,
    primaryTransport: userData?.primary_transport || "Unknown",
    secondaryTransport: userData?.alternative_transportation || "Unknown"
  };
  usersList.push(mainUser);
  if (includeSupervised) {
    const API_SUPERVISED_URL = "https://cloud01.browix.com/v1/externalpermissions/getUsers/uuid:5632674a4257a67218c812191c3efd81/limit:200/page:1";
    const resSupervised = await fetch(API_SUPERVISED_URL);
    if (!resSupervised.ok) {
      return usersList;
    }
    const dataSupervised = await resSupervised.json();
    const supervisedRecords = dataSupervised?.response?.data?.records || [];
    if (supervisedRecords.length === 0) {
      return usersList;
    }
    for (const record of supervisedRecords) {
      const supervisorData = record?.Supervisor || {};
      const supervisorOfRecord = supervisorData?.identification_number;
      if (supervisorOfRecord !== supervisorId) {
        continue;
      }
      const userInfo = record?.User || {};
      const userItem = {
        fullName: `${userInfo?.last_name || "UnknownLastName"}, ${userInfo?.name || "UnknownName"}`,
        identificationNumber: userInfo?.identification_number || "UnknownID",
        primaryTransport: userInfo?.primary_transport || "Unknown",
        secondaryTransport: userInfo?.alternative_transportation || "Unknown"
      };
      usersList.push(userItem);
    }
  }
  return usersList;
}
__name(processUsers, "processUsers");

// utils/calculateTimeDifference.js
function calculateTimeDifference(start, end) {
  const diffMs = end - start;
  const totalSeconds = diffMs / 1e3;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const decimal = totalSeconds / 3600;
  const hms = `${hours}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
  return { decimal, hms };
}
__name(calculateTimeDifference, "calculateTimeDifference");

// utils/buildGoogleMapsLink.js
function buildGoogleMapsLink(lat1, lon1, lat2 = null, lon2 = null) {
  if (!lat2 || !lon2) {
    return `https://www.google.com/maps?q=${lat1},${lon1}`;
  }
  return `https://www.google.com/maps/dir/${lat1},${lon1}/${lat2},${lon2}`;
}
__name(buildGoogleMapsLink, "buildGoogleMapsLink");

// handlers/marcacionesHandler.js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
async function handleMarcaciones(url) {
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const dni = url.searchParams.get("dni");
  const includeSupervised = url.searchParams.get("includeSupervised") === "true";
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
      return jsonResponse({ error: "User not found." }, 404);
    }
    await sleep(1500);
    const usersList = await processUsers(userData, includeSupervised);
    const result = {};
    for (const user of usersList) {
      await sleep(1e3);
      const apiUrl = `https://cloud01.browix.com/v1/externalpermissions/getIntervalsInDateRange/uuid:5632674a4257a67218c812191c3efd81/${fromDate}/${toDate}/${user.identificationNumber}/returnOnlyDataPayload:1`;
      const intervalsRes = await fetch(apiUrl);
      const intervalsJson = await intervalsRes.json();
      const intervals = intervalsJson?.data || [];
      const groupedByDate = {};
      for (const interval of intervals) {
        const intervalData = interval.Interval;
        const branchIn = interval.BranchIn;
        const datetimeIn = new Date(intervalData.datetime_in);
        const datetimeOut = intervalData.datetime_out ? new Date(intervalData.datetime_out) : /* @__PURE__ */ new Date();
        const dateKey = datetimeIn.toISOString().split("T")[0];
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = {
            intervals: [],
            routeUrl: "",
            totalGrossHours: "",
            totalNetHours: "",
            totalTransferHours: ""
          };
        }
        groupedByDate[dateKey].intervals.push({
          datetime_in: intervalData.datetime_in,
          datetime_out: intervalData.datetime_out,
          location: branchIn?.name || "Unknown",
          latIn: intervalData.lat_in,
          lonIn: intervalData.lon_in,
          latOut: intervalData.lat_out,
          lonOut: intervalData.lon_out,
          // Campos adicionales que rellenamos luego
          mapIn: "",
          mapOut: "",
          from: "",
          transferLabel: "",
          transferTimeHMS: ""
        });
      }
      for (const [dateKey, dayData] of Object.entries(groupedByDate)) {
        let totalNetMs = 0;
        let totalTransferMs = 0;
        const routePoints = [];
        dayData.intervals.forEach((interval, idx) => {
          const start = new Date(interval.datetime_in);
          const end = interval.datetime_out ? new Date(interval.datetime_out) : /* @__PURE__ */ new Date();
          totalNetMs += end - start;
          routePoints.push(`${interval.latIn},${interval.lonIn}`);
          interval.mapIn = buildGoogleMapsLink(interval.latIn, interval.lonIn);
          interval.mapOut = buildGoogleMapsLink(
            interval.latOut,
            interval.lonOut
          );
          if (idx === 0) {
            interval.from = "Start of Day";
            interval.transferLabel = "Start of Day";
            interval.transferTimeHMS = "00:00:00";
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
          lastInterval.datetime_out ? new Date(lastInterval.datetime_out) : /* @__PURE__ */ new Date()
        );
        dayData.totalNetHours = new Date(totalNetMs).toISOString().substr(11, 8);
        dayData.totalTransferHours = new Date(totalTransferMs).toISOString().substr(11, 8);
        dayData.totalGrossHours = gross.hms;
        dayData.routeUrl = `https://www.google.com/maps/dir/${routePoints.join(
          "/"
        )}`;
        dayData.intervals = dayData.intervals.map((marcacion, idx) => ({
          number: idx + 1,
          transferTimeBetween: marcacion.transferTimeHMS,
          branchName: marcacion.location,
          timeIn: marcacion.datetime_in || "Sin Entrada Registrada",
          mapIn: marcacion.mapIn,
          timeOut: marcacion.datetime_out || "Sin Salida Registrada",
          mapOut: marcacion.mapOut,
          transferLabel: marcacion.transferLabel,
          from: marcacion.from,
          transportType: user.primaryTransport || "N/A"
        }));
      }
      result[user.fullName] = groupedByDate;
    }
    return jsonResponse({ status: "OK", data: result });
  } catch (error) {
    console.error("Error in handleMarcaciones:", error);
    return jsonResponse({ error: "Unexpected error occurred" }, 500);
  }
}
__name(handleMarcaciones, "handleMarcaciones");

// handlers/totalHoursHandler.js
async function handleTotalHours(url) {
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const dni = url.searchParams.get("dni");
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
    const groupedByDate = {};
    for (const interval of intervals) {
      const intervalData = interval.Interval;
      const datetimeIn = new Date(intervalData.datetime_in);
      const datetimeOut = intervalData.datetime_out ? new Date(intervalData.datetime_out) : /* @__PURE__ */ new Date();
      const dateKey = datetimeIn.toISOString().split("T")[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push({
        datetime_in: intervalData.datetime_in,
        datetime_out: intervalData.datetime_out
      });
    }
    let totalNetMs = 0;
    let totalTransferMs = 0;
    let totalGrossMs = 0;
    for (const [dateKey, dayIntervals] of Object.entries(groupedByDate)) {
      let dailyNetMs = 0;
      let dailyTransferMs = 0;
      dayIntervals.sort(
        (a, b) => new Date(a.datetime_in) - new Date(b.datetime_in)
      );
      dayIntervals.forEach((interval, idx) => {
        const start = new Date(interval.datetime_in);
        const end = interval.datetime_out ? new Date(interval.datetime_out) : /* @__PURE__ */ new Date();
        dailyNetMs += end - start;
        if (idx > 0) {
          const prev = dayIntervals[idx - 1];
          const prevEnd = new Date(prev.datetime_out);
          const transferMs = start - prevEnd;
          dailyTransferMs += transferMs;
        }
      });
      const firstInterval = dayIntervals[0];
      const lastInterval = dayIntervals[dayIntervals.length - 1];
      const grossMs = new Date(
        lastInterval.datetime_out ? lastInterval.datetime_out : /* @__PURE__ */ new Date()
      ) - new Date(firstInterval.datetime_in);
      totalNetMs += dailyNetMs;
      totalTransferMs += dailyTransferMs;
      totalGrossMs += grossMs;
    }
    const totals = /* @__PURE__ */ __name((ms) => {
      const totalSeconds = ms / 1e3;
      const decimal = +(totalSeconds / 3600).toFixed(2);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor(totalSeconds % 3600 / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const hms = `${hours}:${String(minutes).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`;
      return { decimal, hms };
    }, "totals");
    const result = {
      totalNetHours: totals(totalNetMs),
      totalTransferHours: totals(totalTransferMs),
      totalGrossHours: totals(totalGrossMs)
    };
    return jsonResponse({ status: "OK", data: result });
  } catch (error) {
    console.error("Error in handleTotalHours:", error);
    return jsonResponse({ error: "Unexpected error occurred" }, 500);
  }
}
__name(handleTotalHours, "handleTotalHours");

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/user") return await handleUser(url);
    if (path === "/marcaciones") return await handleMarcaciones(url);
    if (path === "/totalHours") return await handleTotalHours(url);
    return new Response(JSON.stringify({ error: "Endpoint no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-IIHPmq/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-IIHPmq/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
