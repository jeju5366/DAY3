const { spots } = require("../jeju_spots.json");

const MAX_RESULTS = 8;
const AREAS = ["동쪽", "서쪽", "서귀포", "제주시"];

// 날씨 조회용 지역 대표 좌표 (jeju_spots.json 에는 좌표가 없다)
const AREA_COORDS = {
  동쪽: { latitude: 33.46, longitude: 126.93 },
  서쪽: { latitude: 33.41, longitude: 126.27 },
  서귀포: { latitude: 33.25, longitude: 126.56 },
  제주시: { latitude: 33.5, longitude: 126.53 },
};

// WMO 날씨 코드 → 한글 설명
const weatherText = (code) => {
  if (code === 0) return "맑음";
  if (code <= 2) return "대체로 맑음";
  if (code === 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if (code >= 51 && code <= 57) return "이슬비";
  if (code >= 61 && code <= 67) return "비";
  if (code >= 71 && code <= 77) return "눈";
  if (code >= 80 && code <= 82) return "소나기";
  if (code === 85 || code === 86) return "소낙눈";
  if (code >= 95) return "뇌우";
  return "알 수 없음";
};

// 입력 area 는 큰 지역명이고, 데이터의 area 는 "동쪽(성산)" 처럼 읍면이 붙어 있어 앞부분으로 비교한다.
function find_spots({ area, indoor } = {}) {
  if (!AREAS.includes(area)) {
    return { error: `area 는 ${AREAS.join(" · ")} 중 하나여야 합니다.` };
  }
  const found = spots
    .filter((s) => s.area.split("(")[0] === area)
    .filter((s) => indoor === undefined || indoor === null || s.indoor === indoor)
    .slice(0, MAX_RESULTS)
    .map(({ name, area, indoor, type }) => ({ name, area, indoor, description: type }));
  return { count: found.length, spots: found };
}

// Open-Meteo (API 키 필요 없음)
async function get_weather({ area, days } = {}) {
  const pos = AREA_COORDS[area];
  if (!pos) return { error: `area 는 ${AREAS.join(" · ")} 중 하나여야 합니다.` };
  const n = Math.min(Math.max(parseInt(days, 10) || 3, 1), 7);

  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    ...pos,
    current: "temperature_2m,weather_code,precipitation,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max",
    timezone: "Asia/Seoul",
    forecast_days: n,
  });
  const res = await fetch(url);
  if (!res.ok) return { error: `날씨 조회 실패 (${res.status})` };
  const w = await res.json();

  return {
    area,
    now: {
      날씨: weatherText(w.current.weather_code),
      기온_C: w.current.temperature_2m,
      강수량_mm: w.current.precipitation,
      풍속_kmh: w.current.wind_speed_10m,
    },
    daily: w.daily.time.map((date, i) => ({
      date,
      날씨: weatherText(w.daily.weather_code[i]),
      최고기온_C: w.daily.temperature_2m_max[i],
      최저기온_C: w.daily.temperature_2m_min[i],
      강수확률_퍼센트: w.daily.precipitation_probability_max[i],
      강수량_mm: w.daily.precipitation_sum[i],
      최대풍속_kmh: w.daily.wind_speed_10m_max[i],
    })),
  };
}

const find_spots_tool = {
  name: "find_spots",
  description:
    "제주 관광지 목록(jeju_spots.json)에서 지역과 실내/야외 조건에 맞는 장소를 최대 8곳 찾아 " +
    "이름 · 지역 · 실내 여부 · 설명을 돌려준다. " +
    "이 목록 밖의 장소는 없다. 결과에 없는 장소를 지어내거나 추천하지 말고, 결과가 비면 조건에 맞는 곳이 없다고 답한다. " +
    "운영시간 · 요금 · 휴무 정보는 담겨 있지 않다.",
  input_schema: {
    type: "object",
    properties: {
      area: {
        type: "string",
        enum: AREAS,
        description: "찾을 지역: 동쪽 · 서쪽 · 서귀포 · 제주시 중 하나",
      },
      indoor: {
        type: "boolean",
        description: "true 면 실내만, false 면 야외만. 생략하면 둘 다.",
      },
    },
    required: ["area"],
  },
};

const get_weather_tool = {
  name: "get_weather",
  description:
    "제주 지역의 현재 날씨와 앞으로 며칠간의 예보(날씨 · 최고/최저기온 · 강수확률 · 강수량 · 풍속)를 Open-Meteo 에서 가져온다. " +
    "비가 오는지, 바람이 센지에 따라 실내/야외를 고를 때 쓴다. 제주도 밖의 날씨는 조회할 수 없다.",
  input_schema: {
    type: "object",
    properties: {
      area: {
        type: "string",
        enum: AREAS,
        description: "날씨를 볼 지역: 동쪽 · 서쪽 · 서귀포 · 제주시 중 하나",
      },
      days: {
        type: "integer",
        description: "오늘부터 며칠치 예보를 볼지 (1~7, 생략하면 3)",
      },
    },
    required: ["area"],
  },
};

module.exports = {
  tools: [find_spots_tool, get_weather_tool],
  handlers: { find_spots, get_weather },
  find_spots,
  get_weather,
  find_spots_tool,
  get_weather_tool,
};
