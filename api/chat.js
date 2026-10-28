// Vercel 서버리스 함수: 환경변수 GEMINI_API_KEY 로 Gemini 를 호출하고,
// Gemini 가 요청하는 도구(find_spots · get_weather)를 대신 실행해주는 에이전트 루프.
const { tools, handlers } = require("./tools");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_TURNS = 5;      // 도구를 부르는 왕복 최대 횟수
const MAX_HISTORY = 10;   // 대화 기록은 최근 10개만
const MAX_LENGTH = 500;   // 메시지 한 개의 최대 글자 수

const functionDeclarations = tools.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: t.input_schema,
}));

const systemPrompt = () => {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
  return [
    "너는 제주도 여행지를 추천해주는 친근한 도우미야. 해요체로 짧고 따뜻하게 말하고 이모지는 적당히 써.",
    `오늘은 ${today}이야.`,
    "추천하기 전에 반드시 도구를 써서 확인해:",
    "1) get_weather 로 해당 지역의 날씨를 확인하고,",
    "2) 비·강풍이면 find_spots 를 indoor=true 로, 날씨가 좋으면 야외(indoor=false) 위주로 찾아.",
    "지역을 말하지 않았으면 가장 알맞은 지역을 골라도 되지만, 정말 모르겠으면 어느 지역인지 먼저 물어봐.",
    "추천은 find_spots 결과에 나온 장소만 해. 목록에 없는 장소, 운영시간, 요금은 지어내지 마.",
    "추천 이유에는 확인한 날씨(기온·강수확률 등)를 꼭 넣어줘.",
  ].join("\n");
};

const callGemini = async (contents) => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents,
      tools: [{ functionDeclarations }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini 오류 (${res.status}): ${data.error?.message || JSON.stringify(data)}`);
  return data;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("POST 로 요청해주세요.");
  if (!process.env.GEMINI_API_KEY) return res.status(500).send("서버에 GEMINI_API_KEY 환경변수가 설정되지 않았어요.");

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const contents = messages
    .slice(-MAX_HISTORY)
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_LENGTH) }] }));
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return res.status(400).send("마지막 메시지는 사용자의 질문이어야 해요.");
  }

  const steps = []; // 화면에 보여줄 도구 호출 기록

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const data = await callGemini(contents);
      const content = data.candidates?.[0]?.content;
      const parts = content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (!calls.length) {
        const reply = parts.map((p) => p.text).filter(Boolean).join("").trim();
        return res.status(200).json({ reply: reply || "답변을 만들지 못했어요. 다시 물어봐 주세요.", steps });
      }

      // 모델이 보낸 내용은 그대로 다시 넣어야 함 (thought signature 유지)
      contents.push(content);

      const responseParts = [];
      for (const { functionCall } of calls) {
        const { name, args = {} } = functionCall;
        let result;
        try {
          result = handlers[name] ? await handlers[name](args) : { error: `없는 도구: ${name}` };
        } catch (e) {
          result = { error: e.message };
        }
        steps.push({ name, args, result });
        responseParts.push({ functionResponse: { name, response: { result } } });
      }
      contents.push({ role: "user", parts: responseParts });
    }
    res.status(200).json({ reply: "도구를 너무 많이 써서 멈췄어요. 질문을 조금 더 구체적으로 해주세요.", steps });
  } catch (e) {
    res.status(502).send(e.message);
  }
};
