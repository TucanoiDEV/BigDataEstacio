import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { geoIdentity, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { BIN_COLORS, type MapShape } from "@/lib/map-colors";
import type { UfValue } from "@/server/services/observatory";

let cached: FeatureCollection<Geometry, { codarea: string }> | null | undefined;

/** Malha das UFs (IBGE), baixada pelo pipeline para public/geo/br-uf.json. */
async function loadMesh() {
  if (cached !== undefined) return cached;
  try {
    const raw = await readFile(path.join(process.cwd(), "public", "geo", "br-uf.json"), "utf8");
    cached = JSON.parse(raw);
  } catch {
    cached = null;
  }
  return cached;
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** Classes simétricas: tercis dos positivos e dos negativos (+ zero neutro). */
export function binValues(values: number[]) {
  const pos = values.filter((v) => v > 0).sort((a, b) => a - b);
  const neg = values.filter((v) => v < 0).map(Math.abs).sort((a, b) => a - b);
  const tert = (arr: number[]) => (arr.length ? [arr[Math.floor(arr.length / 3)] ?? arr[0], arr[Math.floor((2 * arr.length) / 3)] ?? arr[arr.length - 1]] : [0, 0]);
  const [p1, p2] = tert(pos);
  const [n1, n2] = tert(neg);
  const binOf = (v: number) => {
    if (v === 0) return 3;
    if (v > 0) return v < p1 ? 4 : v < p2 ? 5 : 6;
    const a = Math.abs(v);
    return a < n1 ? 2 : a < n2 ? 1 : 0;
  };
  const legend = [
    ...(neg.length ? [{ label: `≤ ${compact.format(-n2)}`, color: BIN_COLORS[0] }, { label: `${compact.format(-n2)} a ${compact.format(-n1)}`, color: BIN_COLORS[1] }, { label: `${compact.format(-n1)} a −1`, color: BIN_COLORS[2] }] : []),
    { label: "0", color: BIN_COLORS[3] },
    ...(pos.length ? [{ label: `+1 a ${compact.format(p1)}`, color: BIN_COLORS[4] }, { label: `${compact.format(p1)} a ${compact.format(p2)}`, color: BIN_COLORS[5] }, { label: `≥ ${compact.format(p2)}`, color: BIN_COLORS[6] }] : []),
  ];
  return { binOf, legend };
}

export async function buildUfMap(values: UfValue[]): Promise<{ shapes: MapShape[]; viewBox: string; bins: { label: string; color: string }[] } | null> {
  const mesh = await loadMesh();
  if (!mesh) return null;
  const W = 600;
  const H = 600;
  // Projeção plana (coordenadas geográficas como plano) — independe do sentido dos anéis do GeoJSON.
  const projection = geoIdentity().reflectY(true).fitSize([W, H], mesh);
  const gen = geoPath(projection);
  const byCode = new Map(values.map((v) => [v.code, v]));
  const { binOf, legend } = binValues(values.map((v) => v.balance));
  const shapes = mesh.features
    .map((f) => {
      const v = byCode.get(f.properties.codarea);
      const d = gen(f);
      if (!v || !d) return null;
      return { code: v.code, abbr: v.abbr, name: v.name, d, value: v.balance, admissions: v.admissions, separations: v.separations, bin: binOf(v.balance) };
    })
    .filter((s): s is MapShape => s !== null);
  return { shapes, viewBox: `0 0 ${W} ${H}`, bins: legend };
}
