// Art direction and pixel density are separate: each composition has its own
// full-height landscape, then several raster resolutions of that landscape.
export const mosaics = [
  { id: "standard", width: 1400, height: 350, minWidth: 0 },
  { id: "wide", width: 2100, height: 350, minWidth: 1280 },
  { id: "ultrawide", width: 2800, height: 350, minWidth: 1920 },
  { id: "panoramic", width: 4200, height: 350, minWidth: 2560 },
  { id: "extreme", width: 6300, height: 350, minWidth: 3840 },
];
export const sunPosition = { x: 1045 / 1400, y: 96, radius: 63 };
export const mosaicName = (mosaic, night = false) =>
  `spica-mosaic${night ? "-night" : ""}${mosaic.id === "standard" ? "" : `-${mosaic.id}`}`;
export const tileFile = mosaic =>
  `sky-tiles${mosaic.id === "standard" ? "" : `-${mosaic.id}`}.json`;
export const resolutions = mosaic => (mosaic.id === "standard" ? [1, 2] : [0.5, 1, 2])
  .map(scale => ({ width: mosaic.width * scale, suffix: scale === 1 ? "" : scale === 2 ? "@2x" : "-small" }));
export const mosaicForWidth = width => mosaics.findLast(mosaic => width > mosaic.minWidth) || mosaics[0];
export const mosaicForSource = source => mosaics.find(mosaic =>
  [false, true].some(night => resolutions(mosaic).some(({ suffix }) =>
    source.endsWith(`/${mosaicName(mosaic, night)}${suffix}.webp`))));
