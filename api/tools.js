const { spots } = require("../jeju_spots.json");

const MAX_RESULTS = 8;
const AREAS = ["동쪽", "서쪽", "서귀포", "제주시"];

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

module.exports = {
  tools: [find_spots_tool],
  handlers: { find_spots },
  find_spots,
  find_spots_tool,
};
