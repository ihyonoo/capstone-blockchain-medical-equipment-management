import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH =
  process.argv[2] ?? path.join(ROOT_DIR, "examples", "usage-record-batch-150.json");
const KST_OFFSET_SECONDS = 9 * 60 * 60;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260615);

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

function weightedPick(list) {
  const totalWeight = list.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * totalWeight;
  for (const item of list) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item;
    }
  }
  return list[list.length - 1];
}

function minuteOfDayKst(epochSeconds) {
  return ((Math.floor((epochSeconds + KST_OFFSET_SECONDS) / 60) % 1440) + 1440) % 1440;
}

function startOfDayKst(epochSeconds) {
  return Math.floor((epochSeconds + KST_OFFSET_SECONDS) / 86400) * 86400 - KST_OFFSET_SECONDS;
}

function moveIntoWindow(epochSeconds, window) {
  const [startMinute, endMinute] = window;
  const currentMinute = minuteOfDayKst(epochSeconds);
  const dayStart = startOfDayKst(epochSeconds);

  if (currentMinute < startMinute) {
    return dayStart + startMinute * 60 + randomInt(0, 18) * 60;
  }

  if (currentMinute > endMinute) {
    return dayStart + 86400 + startMinute * 60 + randomInt(0, 18) * 60;
  }

  return epochSeconds;
}

function formatUsageId(value) {
  return String(value).padStart(8, "0");
}

function pickUser(location, previousUserId = null) {
  const pool = STAFF_BY_LOCATION[location];
  if (!pool || pool.length === 0) {
    throw new Error(`missing staff pool for location: ${location}`);
  }

  if (pool.length === 1) {
    return pool[0];
  }

  let userId = pick(pool);
  if (previousUserId === null) {
    return userId;
  }

  let guard = 0;
  while (userId === previousUserId && guard < 6) {
    userId = pick(pool);
    guard += 1;
  }
  return userId;
}

function shouldUseDifferentReturnUser(fromLocation, toLocation, equipmentType, durationMinutes) {
  if (fromLocation === toLocation) {
    return random() < 0.02;
  }

  let probability = 0.08;

  if (["중환자실", "수술실", "회복실"].includes(toLocation)) {
    probability += 0.04;
  }

  if (["CT실", "MRI실", "영상의학과", "내시경실"].includes(toLocation)) {
    probability += 0.02;
  }

  if (["ventilator", "monitor", "infusion"].includes(equipmentType)) {
    probability += 0.02;
  }

  if (durationMinutes >= 150) {
    probability += 0.02;
  }

  return random() < probability;
}

function createRouteMap(defaultWindow, entries) {
  return Object.fromEntries(
    Object.entries(entries).map(([from, routes]) => [
      from,
      routes.map((route) => ({
        window: defaultWindow,
        ...route,
      })),
    ]),
  );
}

const STAFF_BY_LOCATION = {
  "응급실": [2410837, 2409126, 2407714, 2419054],
  "중환자실": [2411942, 2412875, 2434097, 2417386],
  "수술실": [2416640, 2414589, 2413768, 2415524],
  "회복실": [2432061, 2416640, 2415524],
  "7병동": [2420186, 2425210, 2426841],
  "8병동": [2421463, 2426624, 2427442],
  "영상의학과": [2423018, 2429283, 2424871],
  "CT실": [2423018, 2429283, 2424871],
  "MRI실": [2429283, 2423018, 2424871],
  "검사실": [2431184, 2428814, 2430156],
  "내시경실": [2427745, 2426127, 2429540],
  "분만실": [2436152, 2437310, 2438422],
  "격리병실": [2435221, 2436448, 2437091],
};

const TYPE_CONFIGS = {
  stretcher: {
    defaultWindow: [390, 1160],
    idleGapMinutes: [360, 1560],
    routes: createRouteMap([390, 1160], {
      "응급실": [
        { to: "CT실", durationMinutes: [22, 46], weight: 4 },
        { to: "MRI실", durationMinutes: [38, 72], weight: 3 },
        { to: "중환자실", durationMinutes: [28, 60], weight: 2 },
        { to: "수술실", durationMinutes: [48, 92], weight: 2 },
      ],
      "CT실": [
        { to: "응급실", durationMinutes: [16, 34], weight: 4 },
        { to: "7병동", durationMinutes: [24, 40], weight: 2 },
        { to: "8병동", durationMinutes: [24, 44], weight: 2 },
      ],
      "MRI실": [
        { to: "응급실", durationMinutes: [28, 50], weight: 3 },
        { to: "7병동", durationMinutes: [30, 54], weight: 2 },
        { to: "8병동", durationMinutes: [30, 54], weight: 2 },
      ],
      "7병동": [
        { to: "영상의학과", durationMinutes: [32, 58], weight: 4 },
        { to: "CT실", durationMinutes: [26, 48], weight: 3 },
        { to: "내시경실", durationMinutes: [34, 64], weight: 2 },
      ],
      "8병동": [
        { to: "CT실", durationMinutes: [26, 48], weight: 4 },
        { to: "MRI실", durationMinutes: [38, 66], weight: 2 },
        { to: "내시경실", durationMinutes: [34, 60], weight: 2 },
      ],
      "영상의학과": [
        { to: "7병동", durationMinutes: [24, 48], weight: 4 },
        { to: "8병동", durationMinutes: [24, 48], weight: 3 },
        { to: "응급실", durationMinutes: [22, 40], weight: 2 },
      ],
      "수술실": [
        { to: "회복실", durationMinutes: [18, 36], weight: 5 },
        { to: "중환자실", durationMinutes: [30, 58], weight: 2 },
      ],
      "회복실": [
        { to: "수술실", durationMinutes: [18, 34], weight: 4 },
        { to: "7병동", durationMinutes: [26, 44], weight: 3 },
        { to: "8병동", durationMinutes: [26, 46], weight: 2 },
      ],
      "중환자실": [
        { to: "CT실", durationMinutes: [20, 38], weight: 2 },
        { to: "응급실", durationMinutes: [20, 38], weight: 2 },
      ],
      "분만실": [
        { to: "수술실", durationMinutes: [20, 36], weight: 4 },
        { to: "회복실", durationMinutes: [30, 54], weight: 2 },
      ],
      "내시경실": [
        { to: "7병동", durationMinutes: [30, 54], weight: 3 },
        { to: "8병동", durationMinutes: [30, 54], weight: 2 },
      ],
    }),
  },
  wheelchair: {
    defaultWindow: [420, 1110],
    idleGapMinutes: [300, 1440],
    routes: createRouteMap([420, 1110], {
      "7병동": [
        { to: "영상의학과", durationMinutes: [28, 52], weight: 4 },
        { to: "내시경실", durationMinutes: [34, 66], weight: 3 },
        { to: "CT실", durationMinutes: [26, 48], weight: 2 },
      ],
      "8병동": [
        { to: "영상의학과", durationMinutes: [28, 52], weight: 4 },
        { to: "MRI실", durationMinutes: [36, 64], weight: 2 },
        { to: "내시경실", durationMinutes: [32, 60], weight: 3 },
      ],
      "응급실": [
        { to: "CT실", durationMinutes: [20, 38], weight: 3 },
        { to: "영상의학과", durationMinutes: [24, 42], weight: 2 },
        { to: "8병동", durationMinutes: [22, 40], weight: 1 },
      ],
      "영상의학과": [
        { to: "7병동", durationMinutes: [20, 44], weight: 4 },
        { to: "8병동", durationMinutes: [20, 44], weight: 4 },
        { to: "응급실", durationMinutes: [18, 34], weight: 2 },
      ],
      "CT실": [
        { to: "7병동", durationMinutes: [18, 34], weight: 3 },
        { to: "8병동", durationMinutes: [18, 36], weight: 3 },
        { to: "응급실", durationMinutes: [16, 28], weight: 2 },
      ],
      "MRI실": [
        { to: "8병동", durationMinutes: [24, 44], weight: 4 },
        { to: "응급실", durationMinutes: [24, 42], weight: 2 },
      ],
      "내시경실": [
        { to: "7병동", durationMinutes: [22, 42], weight: 4 },
        { to: "8병동", durationMinutes: [22, 42], weight: 4 },
      ],
      "분만실": [
        { to: "검사실", durationMinutes: [20, 34], weight: 2 },
        { to: "회복실", durationMinutes: [26, 44], weight: 2 },
      ],
      "회복실": [
        { to: "7병동", durationMinutes: [18, 34], weight: 2 },
        { to: "8병동", durationMinutes: [18, 34], weight: 2 },
      ],
      "검사실": [
        { to: "분만실", durationMinutes: [18, 30], weight: 1 },
        { to: "7병동", durationMinutes: [18, 34], weight: 2 },
      ],
    }),
  },
  defibrillator: {
    defaultWindow: [360, 1380],
    idleGapMinutes: [600, 1800],
    routes: createRouteMap([360, 1380], {
      "응급실": [
        { to: "응급실", durationMinutes: [18, 64], weight: 5 },
        { to: "중환자실", durationMinutes: [24, 82], weight: 3 },
        { to: "수술실", durationMinutes: [42, 92], weight: 1 },
      ],
      "중환자실": [
        { to: "중환자실", durationMinutes: [28, 120], weight: 5 },
        { to: "CT실", durationMinutes: [20, 48], weight: 2 },
        { to: "응급실", durationMinutes: [22, 44], weight: 1 },
      ],
      "수술실": [
        { to: "수술실", durationMinutes: [24, 72], weight: 4 },
        { to: "회복실", durationMinutes: [26, 66], weight: 3 },
        { to: "중환자실", durationMinutes: [28, 72], weight: 2 },
      ],
      "회복실": [
        { to: "회복실", durationMinutes: [18, 48], weight: 3 },
        { to: "수술실", durationMinutes: [18, 42], weight: 2 },
        { to: "중환자실", durationMinutes: [26, 54], weight: 2 },
      ],
      "CT실": [
        { to: "중환자실", durationMinutes: [18, 34], weight: 3 },
        { to: "응급실", durationMinutes: [18, 30], weight: 2 },
      ],
    }),
  },
  ventilator: {
    defaultWindow: [330, 1410],
    idleGapMinutes: [720, 2160],
    routes: createRouteMap([330, 1410], {
      "응급실": [
        { to: "중환자실", durationMinutes: [42, 120], weight: 5 },
        { to: "응급실", durationMinutes: [30, 90], weight: 2 },
      ],
      "중환자실": [
        { to: "중환자실", durationMinutes: [90, 300], weight: 6 },
        { to: "CT실", durationMinutes: [26, 68], weight: 2 },
        { to: "MRI실", durationMinutes: [42, 88], weight: 1 },
        { to: "수술실", durationMinutes: [56, 148], weight: 2 },
      ],
      "CT실": [
        { to: "중환자실", durationMinutes: [24, 54], weight: 4 },
        { to: "응급실", durationMinutes: [28, 60], weight: 2 },
      ],
      "MRI실": [
        { to: "중환자실", durationMinutes: [34, 68], weight: 4 },
      ],
      "수술실": [
        { to: "중환자실", durationMinutes: [42, 110], weight: 4 },
        { to: "회복실", durationMinutes: [32, 74], weight: 2 },
      ],
      "회복실": [
        { to: "중환자실", durationMinutes: [28, 62], weight: 4 },
      ],
    }),
  },
  infusion: {
    defaultWindow: [360, 1320],
    idleGapMinutes: [480, 1680],
    routes: createRouteMap([360, 1320], {
      "7병동": [
        { to: "7병동", durationMinutes: [140, 420], weight: 6 },
        { to: "영상의학과", durationMinutes: [48, 120], weight: 2 },
        { to: "내시경실", durationMinutes: [68, 144], weight: 2 },
        { to: "수술실", durationMinutes: [92, 188], weight: 1 },
      ],
      "8병동": [
        { to: "8병동", durationMinutes: [140, 420], weight: 6 },
        { to: "CT실", durationMinutes: [42, 108], weight: 2 },
        { to: "내시경실", durationMinutes: [68, 144], weight: 2 },
        { to: "중환자실", durationMinutes: [84, 172], weight: 1 },
      ],
      "응급실": [
        { to: "중환자실", durationMinutes: [64, 180], weight: 4 },
        { to: "응급실", durationMinutes: [48, 124], weight: 3 },
      ],
      "중환자실": [
        { to: "중환자실", durationMinutes: [180, 480], weight: 6 },
        { to: "CT실", durationMinutes: [42, 88], weight: 1 },
        { to: "수술실", durationMinutes: [88, 182], weight: 1 },
        { to: "응급실", durationMinutes: [56, 124], weight: 1 },
      ],
      "수술실": [
        { to: "회복실", durationMinutes: [66, 174], weight: 4 },
        { to: "수술실", durationMinutes: [110, 220], weight: 2 },
      ],
      "회복실": [
        { to: "7병동", durationMinutes: [60, 170], weight: 3 },
        { to: "8병동", durationMinutes: [60, 170], weight: 3 },
        { to: "회복실", durationMinutes: [54, 132], weight: 2 },
      ],
      "영상의학과": [
        { to: "7병동", durationMinutes: [42, 110], weight: 3 },
        { to: "8병동", durationMinutes: [42, 110], weight: 2 },
      ],
      "CT실": [
        { to: "8병동", durationMinutes: [40, 102], weight: 3 },
        { to: "중환자실", durationMinutes: [40, 102], weight: 2 },
      ],
      "내시경실": [
        { to: "7병동", durationMinutes: [58, 142], weight: 3 },
        { to: "8병동", durationMinutes: [58, 142], weight: 3 },
      ],
    }),
  },
  monitor: {
    defaultWindow: [360, 1320],
    idleGapMinutes: [600, 1920],
    routes: createRouteMap([360, 1320], {
      "수술실": [
        { to: "회복실", durationMinutes: [60, 160], weight: 5 },
        { to: "수술실", durationMinutes: [90, 220], weight: 3 },
      ],
      "회복실": [
        { to: "수술실", durationMinutes: [32, 82], weight: 3 },
        { to: "7병동", durationMinutes: [44, 110], weight: 2 },
        { to: "8병동", durationMinutes: [44, 110], weight: 2 },
      ],
      "중환자실": [
        { to: "중환자실", durationMinutes: [110, 280], weight: 6 },
        { to: "CT실", durationMinutes: [34, 88], weight: 2 },
      ],
      "응급실": [
        { to: "검사실", durationMinutes: [24, 58], weight: 3 },
        { to: "중환자실", durationMinutes: [40, 92], weight: 2 },
        { to: "응급실", durationMinutes: [26, 74], weight: 2 },
      ],
      "7병동": [
        { to: "검사실", durationMinutes: [24, 56], weight: 3 },
        { to: "7병동", durationMinutes: [82, 210], weight: 3 },
      ],
      "8병동": [
        { to: "검사실", durationMinutes: [24, 56], weight: 3 },
        { to: "8병동", durationMinutes: [82, 210], weight: 3 },
      ],
      "검사실": [
        { to: "응급실", durationMinutes: [20, 40], weight: 2 },
        { to: "7병동", durationMinutes: [20, 42], weight: 2 },
        { to: "8병동", durationMinutes: [20, 42], weight: 2 },
      ],
      "CT실": [
        { to: "중환자실", durationMinutes: [22, 48], weight: 3 },
        { to: "응급실", durationMinutes: [22, 44], weight: 2 },
        { to: "7병동", durationMinutes: [24, 48], weight: 1 },
      ],
      "분만실": [
        { to: "분만실", durationMinutes: [70, 180], weight: 3 },
        { to: "수술실", durationMinutes: [32, 70], weight: 2 },
      ],
    }),
  },
  suction: {
    defaultWindow: [360, 1380],
    idleGapMinutes: [720, 1800],
    routes: createRouteMap([360, 1380], {
      "중환자실": [
        { to: "중환자실", durationMinutes: [40, 160], weight: 6 },
        { to: "응급실", durationMinutes: [28, 72], weight: 2 },
      ],
      "격리병실": [
        { to: "격리병실", durationMinutes: [36, 120], weight: 6 },
        { to: "중환자실", durationMinutes: [44, 92], weight: 2 },
      ],
      "응급실": [
        { to: "중환자실", durationMinutes: [24, 58], weight: 3 },
        { to: "응급실", durationMinutes: [22, 54], weight: 3 },
      ],
      "8병동": [
        { to: "8병동", durationMinutes: [36, 120], weight: 4 },
        { to: "CT실", durationMinutes: [20, 46], weight: 1 },
      ],
      "CT실": [
        { to: "8병동", durationMinutes: [20, 42], weight: 2 },
        { to: "중환자실", durationMinutes: [20, 42], weight: 1 },
      ],
    }),
  },
  oximeter: {
    defaultWindow: [360, 1320],
    idleGapMinutes: [540, 1620],
    routes: createRouteMap([360, 1320], {
      "응급실": [
        { to: "응급실", durationMinutes: [18, 70], weight: 5 },
        { to: "수술실", durationMinutes: [44, 96], weight: 2 },
        { to: "중환자실", durationMinutes: [28, 74], weight: 2 },
      ],
      "수술실": [
        { to: "수술실", durationMinutes: [34, 120], weight: 5 },
        { to: "회복실", durationMinutes: [26, 70], weight: 3 },
      ],
      "중환자실": [
        { to: "중환자실", durationMinutes: [34, 140], weight: 5 },
        { to: "CT실", durationMinutes: [20, 46], weight: 1 },
      ],
      "7병동": [
        { to: "7병동", durationMinutes: [24, 110], weight: 4 },
        { to: "검사실", durationMinutes: [20, 42], weight: 2 },
      ],
      "8병동": [
        { to: "8병동", durationMinutes: [24, 110], weight: 4 },
        { to: "검사실", durationMinutes: [20, 42], weight: 2 },
      ],
      "회복실": [
        { to: "7병동", durationMinutes: [22, 52], weight: 2 },
        { to: "8병동", durationMinutes: [22, 52], weight: 2 },
      ],
      "검사실": [
        { to: "7병동", durationMinutes: [18, 34], weight: 2 },
        { to: "8병동", durationMinutes: [18, 34], weight: 2 },
      ],
      "CT실": [
        { to: "중환자실", durationMinutes: [18, 34], weight: 2 },
        { to: "응급실", durationMinutes: [18, 32], weight: 2 },
      ],
    }),
  },
  ecg: {
    defaultWindow: [390, 1260],
    idleGapMinutes: [480, 1440],
    routes: createRouteMap([390, 1260], {
      "응급실": [
        { to: "검사실", durationMinutes: [16, 34], weight: 5 },
        { to: "응급실", durationMinutes: [14, 28], weight: 3 },
        { to: "중환자실", durationMinutes: [20, 44], weight: 1 },
      ],
      "7병동": [
        { to: "검사실", durationMinutes: [18, 38], weight: 4 },
        { to: "7병동", durationMinutes: [18, 46], weight: 3 },
      ],
      "8병동": [
        { to: "검사실", durationMinutes: [18, 38], weight: 4 },
        { to: "8병동", durationMinutes: [18, 46], weight: 3 },
      ],
      "검사실": [
        { to: "응급실", durationMinutes: [14, 28], weight: 3 },
        { to: "7병동", durationMinutes: [16, 32], weight: 3 },
        { to: "8병동", durationMinutes: [16, 32], weight: 3 },
        { to: "분만실", durationMinutes: [18, 34], weight: 1 },
      ],
      "분만실": [
        { to: "검사실", durationMinutes: [18, 34], weight: 2 },
        { to: "분만실", durationMinutes: [16, 42], weight: 2 },
      ],
      "중환자실": [
        { to: "검사실", durationMinutes: [18, 34], weight: 2 },
        { to: "중환자실", durationMinutes: [18, 46], weight: 2 },
      ],
    }),
  },
  nebulizer: {
    defaultWindow: [360, 1380],
    idleGapMinutes: [600, 1560],
    routes: createRouteMap([360, 1380], {
      "격리병실": [
        { to: "격리병실", durationMinutes: [32, 98], weight: 6 },
        { to: "중환자실", durationMinutes: [42, 96], weight: 1 },
      ],
      "8병동": [
        { to: "8병동", durationMinutes: [32, 112], weight: 5 },
        { to: "CT실", durationMinutes: [22, 44], weight: 1 },
      ],
      "7병동": [
        { to: "7병동", durationMinutes: [32, 112], weight: 5 },
        { to: "내시경실", durationMinutes: [38, 72], weight: 1 },
      ],
      "중환자실": [
        { to: "중환자실", durationMinutes: [42, 136], weight: 6 },
        { to: "응급실", durationMinutes: [24, 58], weight: 1 },
      ],
      "응급실": [
        { to: "중환자실", durationMinutes: [26, 60], weight: 3 },
        { to: "응급실", durationMinutes: [24, 58], weight: 2 },
      ],
      "CT실": [
        { to: "8병동", durationMinutes: [20, 36], weight: 2 },
      ],
      "내시경실": [
        { to: "7병동", durationMinutes: [24, 42], weight: 2 },
      ],
    }),
  },
};

const TAG_PROFILES = [
  { tagId: "FAC-20-008741", type: "stretcher", startLocation: "응급실", count: 8, initialDayOffset: 0 },
  { tagId: "FAC-21-014582", type: "stretcher", startLocation: "7병동", count: 7, initialDayOffset: 0 },
  { tagId: "FAC-20-008745", type: "wheelchair", startLocation: "7병동", count: 8, initialDayOffset: 1 },
  { tagId: "FAC-21-014583", type: "wheelchair", startLocation: "8병동", count: 7, initialDayOffset: 1 },
  { tagId: "BME-24-003117", type: "defibrillator", startLocation: "응급실", count: 8, initialDayOffset: 0 },
  { tagId: "BME-24-003118", type: "defibrillator", startLocation: "중환자실", count: 8, initialDayOffset: 2 },
  { tagId: "BME-24-002418", type: "ventilator", startLocation: "응급실", count: 7, initialDayOffset: 0 },
  { tagId: "BME-24-002419", type: "ventilator", startLocation: "중환자실", count: 7, initialDayOffset: 1 },
  { tagId: "BME-24-008531", type: "infusion", startLocation: "7병동", count: 9, initialDayOffset: 0 },
  { tagId: "BME-24-008533", type: "infusion", startLocation: "8병동", count: 9, initialDayOffset: 1 },
  { tagId: "BME-23-001984", type: "monitor", startLocation: "수술실", count: 7, initialDayOffset: 0 },
  { tagId: "BME-23-001985", type: "monitor", startLocation: "중환자실", count: 7, initialDayOffset: 2 },
  { tagId: "BME-23-009144", type: "suction", startLocation: "중환자실", count: 7, initialDayOffset: 0 },
  { tagId: "BME-23-009145", type: "suction", startLocation: "격리병실", count: 7, initialDayOffset: 1 },
  { tagId: "BME-22-006207", type: "oximeter", startLocation: "응급실", count: 8, initialDayOffset: 0 },
  { tagId: "BME-22-006208", type: "nebulizer", startLocation: "격리병실", count: 8, initialDayOffset: 1 },
  { tagId: "BME-22-004263", type: "ecg", startLocation: "응급실", count: 7, initialDayOffset: 0 },
  { tagId: "BME-22-004264", type: "ecg", startLocation: "7병동", count: 7, initialDayOffset: 2 },
  { tagId: "BME-21-011506", type: "nebulizer", startLocation: "8병동", count: 7, initialDayOffset: 1 },
  { tagId: "BME-21-011507", type: "nebulizer", startLocation: "중환자실", count: 7, initialDayOffset: 2 },
];

function buildRecords() {
  const baseEpoch = Math.floor(Date.parse("2026-06-08T06:40:00+09:00") / 1000);
  const records = [];

  for (const profile of TAG_PROFILES) {
    const typeConfig = TYPE_CONFIGS[profile.type];
    if (!typeConfig) {
      throw new Error(`missing type config for ${profile.type}`);
    }

    let currentLocation = profile.startLocation;
    let nextAvailableAt =
      baseEpoch + profile.initialDayOffset * 86400 + randomInt(0, 110) * 60;

    for (let index = 0; index < profile.count; index += 1) {
      const availableRoutes = typeConfig.routes[currentLocation];
      if (!availableRoutes || availableRoutes.length === 0) {
        throw new Error(`no routes from ${currentLocation} for type ${profile.type}`);
      }

      const route = weightedPick(availableRoutes);
      let checkoutAt =
        nextAvailableAt + randomInt(typeConfig.idleGapMinutes[0], typeConfig.idleGapMinutes[1]) * 60;
      checkoutAt = moveIntoWindow(checkoutAt, route.window ?? typeConfig.defaultWindow);

      const durationMinutes = randomInt(route.durationMinutes[0], route.durationMinutes[1]);
      const returnedAt = checkoutAt + durationMinutes * 60;
      const checkoutUserId = pickUser(currentLocation);
      const returnUserId = shouldUseDifferentReturnUser(
        currentLocation,
        route.to,
        profile.type,
        durationMinutes,
      )
        ? pickUser(route.to, checkoutUserId)
        : checkoutUserId;

      records.push({
        checkoutUserId,
        returnUserId,
        tagId: profile.tagId,
        checkoutLocation: currentLocation,
        checkoutAt,
        returnLocation: route.to,
        returnedAt,
      });

      currentLocation = route.to;
      nextAvailableAt = returnedAt;
    }
  }

  records.sort((left, right) => {
    if (left.checkoutAt !== right.checkoutAt) {
      return left.checkoutAt - right.checkoutAt;
    }
    return left.tagId.localeCompare(right.tagId);
  });

  return records.map((record, index) => ({
    usageId: formatUsageId(113 + index),
    ...record,
  }));
}

function validate(records) {
  if (records.length !== 150) {
    throw new Error(`expected 150 records, received ${records.length}`);
  }

  const usageIds = new Set();
  for (const record of records) {
    if (usageIds.has(record.usageId)) {
      throw new Error(`duplicate usageId: ${record.usageId}`);
    }
    usageIds.add(record.usageId);
  }

  const byTag = new Map();
  for (const record of records) {
    if (!byTag.has(record.tagId)) {
      byTag.set(record.tagId, []);
    }
    byTag.get(record.tagId).push(record);
  }

  for (const [tagId, items] of byTag.entries()) {
    items.sort((left, right) => left.checkoutAt - right.checkoutAt);
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      if (current.checkoutAt < previous.returnedAt) {
        throw new Error(`time overlap for ${tagId}: ${previous.usageId} and ${current.usageId}`);
      }
    }
  }
}

const records = buildRecords();
validate(records);
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(records, null, 2));

const first = records[0];
const last = records[records.length - 1];
console.log(
  JSON.stringify(
    {
      outputPath: OUTPUT_PATH,
      recordCount: records.length,
      usageIdRange: [first.usageId, last.usageId],
      checkoutRange: [first.checkoutAt, last.checkoutAt],
      tagCount: [...new Set(records.map((record) => record.tagId))].length,
      userCount: [
        ...new Set(records.flatMap((record) => [record.checkoutUserId, record.returnUserId])),
      ].length,
    },
    null,
    2,
  ),
);
