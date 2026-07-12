type CoreWebVitalName = "LCP" | "CLS" | "INP" | "FCP";

interface CoreWebVitalMetric {
  readonly name: CoreWebVitalName;
  readonly value: number;
  readonly path: string;
  readonly navigationType: string;
  readonly recordedAt: string;
}

const RUM_ENDPOINT = import.meta.env.VITE_RUM_ENDPOINT as string | undefined;

function publishMetric(metric: CoreWebVitalMetric): void {
  window.dispatchEvent(new CustomEvent<CoreWebVitalMetric>("ehq:rum", { detail: metric }));

  if (RUM_ENDPOINT === undefined || RUM_ENDPOINT.trim().length === 0) {
    return;
  }

  const body = JSON.stringify(metric);
  const payload = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon(RUM_ENDPOINT, payload)) {
    return;
  }

  void fetch(RUM_ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true
  });
}

export function startCoreWebVitalsMonitoring(): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return () => undefined;
  }

  const observers: PerformanceObserver[] = [];
  const values = new Map<CoreWebVitalName, number>();
  const reported = new Set<CoreWebVitalName>();

  const observe = (entryType: string, callback: (entries: readonly PerformanceEntry[]) => void): void => {
    if (!PerformanceObserver.supportedEntryTypes.includes(entryType)) {
      return;
    }

    const observer = new PerformanceObserver((list: PerformanceObserverEntryList): void => {
      callback(list.getEntries());
    });
    observer.observe({ type: entryType, buffered: true });
    observers.push(observer);
  };

  observe("largest-contentful-paint", (entries): void => {
    const latest = entries.at(-1);
    if (latest !== undefined) {
      values.set("LCP", latest.startTime);
    }
  });

  observe("paint", (entries): void => {
    const firstContentfulPaint = entries.find((entry): boolean => entry.name === "first-contentful-paint");
    if (firstContentfulPaint !== undefined) {
      values.set("FCP", firstContentfulPaint.startTime);
    }
  });

  observe("layout-shift", (entries): void => {
    const current = values.get("CLS") ?? 0;
    const shift = entries.reduce((total: number, entry: PerformanceEntry): number => {
      const layoutShift = entry as PerformanceEntry & { readonly hadRecentInput?: boolean; readonly value?: number };
      return total + (layoutShift.hadRecentInput === true ? 0 : layoutShift.value ?? 0);
    }, current);
    values.set("CLS", shift);
  });

  observe("event", (entries): void => {
    const current = values.get("INP") ?? 0;
    const interaction = entries.reduce((maximum: number, entry: PerformanceEntry): number => {
      return Math.max(maximum, entry.duration);
    }, current);
    values.set("INP", interaction);
  });

  const flush = (): void => {
    for (const name of ["LCP", "CLS", "INP", "FCP"] as const) {
      const value = values.get(name);
      if (value === undefined || reported.has(name)) {
        continue;
      }

      reported.add(name);
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      publishMetric({
        name,
        value,
        path: window.location.pathname,
        navigationType: navigation?.type ?? "unknown",
        recordedAt: new Date().toISOString()
      });
    }
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", flush);

  return (): void => {
    for (const observer of observers) {
      observer.disconnect();
    }
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", flush);
  };
}
