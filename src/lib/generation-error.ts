export type GenerationStage = "loading" | "credentials" | "provider" | "document" | "storage";

/** Curated messages only: SDK exceptions may contain API keys, URLs and prompts. */
export function describeGenerationError(error: unknown, stage: GenerationStage, provider: string) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = typeof value.status === "number" && Number.isInteger(value.status) ? value.status : undefined;
  const name = typeof value.name === "string" ? value.name : "";
  const code = typeof value.code === "string" ? value.code : "";
  const prefix = provider.toLowerCase().startsWith("gemini") ? "Gemini" : "OpenAI";
  const result = (kind: string, message: string) => ({ kind, stage, status, message: `${prefix}: ${message}` });

  if (stage === "credentials") return result("credentials", "저장된 API Key를 읽거나 복호화하지 못했습니다. 서버의 기존 ENCRYPTION_KEY를 확인하고 웹 설정에서 API Key를 다시 등록해주세요.");
  if (stage === "storage") return result("storage", "생성 결과를 DB에 저장하지 못했습니다. 서식 문서 마이그레이션과 DB 연결을 확인해주세요.");
  if (stage === "loading") return result("loading", "생성할 글 또는 참고 데이터를 조회하지 못했습니다. DB 연결과 테이블 설정을 확인해주세요.");
  if (stage === "document") return result("document", "AI 응답이 서식 문서 규격(JSON·필수 항목·허용 서식·이미지 참조)에 맞지 않습니다. 다시 생성해주세요. 같은 문제가 반복되면 다른 모델을 선택해주세요.");
  if (status === 401) return result("authentication", "API Key 인증에 실패했습니다(401). 선택한 제공업체의 키를 웹 설정에서 다시 등록해주세요.");
  if (status === 403) return result("permission", "API 접근이 거부되었습니다(403). 프로젝트의 API 활성화, 키 제한, 모델 이용 권한과 지역 제한을 확인해주세요.");
  if (status === 404) return result("model", "선택한 모델을 API에서 찾지 못했습니다(404). 모델 목록을 새로 불러오고 다른 모델을 선택해주세요.");
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached" || status === 402) return result("billing", "API 크레딧 또는 결제 한도가 부족합니다. AI 앱 구독과 별개인 API 프로젝트의 잔액·결제 설정을 확인해주세요.");
  if (status === 429) return result("quota", "API 요청·토큰 할당량에 도달했습니다(429). 무료 한도·분당/일일 제한·결제 상태를 AI 제공업체 콘솔에서 확인해주세요. 할당량이 0이면 기다리는 것만으로 해결되지 않을 수 있습니다.");
  if (/Timeout|Abort/.test(name)) return result("timeout", "AI 응답 대기 시간을 초과했습니다. 입력량을 줄이거나 잠시 후 다시 시도해주세요.");
  if (status === 400) return result("request", "AI가 요청 형식을 거부했습니다(400). API Key 유효성, 선택 모델의 이미지 입력·JSON 출력 지원 및 첨부 파일을 확인해주세요.");
  if (status === 503) return result("unavailable", "선택한 모델이 일시적으로 혼잡하거나 사용 불가 상태입니다(503). 잠시 후 다시 시도하거나 다른 모델을 선택해주세요.");
  if (status === 504) return result("unavailable", "AI 서버가 처리 제한 시간 내에 응답하지 못했습니다(504). 이미지·참고 글의 양을 줄이거나 다른 모델을 선택해주세요.");
  if (status !== undefined && status >= 500) return result("unavailable", `AI 제공업체 서버 오류가 발생했습니다(${status}). 같은 오류가 반복되면 입력량을 줄이거나 다른 모델을 선택해주세요.`);
  if (name === "APIConnectionError" || name === "TypeError") return result("connection", "AI 서버 연결에 실패했습니다. 서버 네트워크·프록시 설정을 확인해주세요.");
  return result("provider", "AI 요청이 완료되지 않았습니다. 모델의 응답 차단·출력 중단 여부를 확인하거나 다른 모델을 선택해주세요.");
}

/** Retry only explicit transient HTTP failures, within one shared time budget. */
export async function withGeminiRetry<T>(
  operation: (timeoutMs: number) => Promise<T>,
  options: { budgetMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {},
): Promise<T> {
  const budget = options.budgetMs ?? 210_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const started = now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation(Math.max(1, budget - (now() - started)));
    } catch (error: unknown) {
      const status = error && typeof error === "object" ? (error as { status?: unknown }).status : undefined;
      // No retry on auth/quota/invalid JSON, or ambiguous connection timeouts.
      if (attempt >= 2 || typeof status !== "number" || ![500, 502, 503, 504].includes(status)) throw error;
      const delay = 1000 * 2 ** attempt + Math.floor(random() * 250);
      if (now() - started + delay + 1000 >= budget) throw error;
      await sleep(delay);
      if (now() - started >= budget) throw error;
    }
  }
}
