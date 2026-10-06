import MapLibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs";

self.worker ??= new MapLibreWorker(self);
