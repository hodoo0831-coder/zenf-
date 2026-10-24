#!/usr/bin/env python3
"""한국관광공사 TourAPI(KorService2)에서 지자체별 행사/공연/축제 정보를 수집한다.

3강 데모(3) 파이프라인 1단계용. 인증키는 코드에 넣지 않고 환경변수로 받는다.

  export DATA_GO_KR_KEY='<공공데이터포털 일반 인증키(Decoding)>'
  python3 scripts/fetch_festivals.py --days 7 --out out/festivals.json

주의: 교재 PDF에 인쇄된 인증키는 강의용 공개 키다. 실제 운영에는 본인 계정의 키를 쓸 것.
"""
import argparse, datetime as dt, json, os, sys, urllib.error, urllib.parse, urllib.request

BASE = "https://apis.data.go.kr/B551011/KorService2/searchFestival2"

# 행사 유형 분류 키워드 (전통문화 / K-컬처 / 자연)
THEME_RULES = [
    ("전통문화", ["전통", "민속", "한복", "국악", "종가", "서원", "향교", "사물놀이", "탈춤", "다례"]),
    ("K-컬처",  ["K-", "케이", "아이돌", "가요", "뮤직", "영화제", "웹툰", "e스포츠", "페스티벌", "콘서트"]),
    ("자연",     ["꽃", "벚", "단풍", "해변", "바다", "산", "숲", "반딧불", "눈", "빙어", "갈대", "억새", "장미", "튤립"]),
]


def classify(title: str) -> str:
    for theme, kws in THEME_RULES:
        if any(k in title for k in kws):
            return theme
    return "기타"


def fetch(key: str, start: str, rows: int, page: int) -> dict:
    params = {
        "serviceKey": key, "MobileOS": "ETC", "MobileApp": "AXPipeline",
        "_type": "json", "arrange": "A", "eventStartDate": start,
        "numOfRows": rows, "pageNo": page,
    }
    url = f"{BASE}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} — 인증키 또는 요청 파라미터를 확인하세요.") from None
    except OSError as e:
        raise RuntimeError(
            f"apis.data.go.kr 에 접속할 수 없습니다({e}). 사내망 방화벽·프록시 설정을 확인하세요."
        ) from None
    if not body.lstrip().startswith("{"):
        raise RuntimeError(f"JSON이 아닌 응답(인증키·엔드포인트 확인 필요):\n{body[:400]}")
    return json.loads(body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7, help="오늘부터 며칠 이내 시작 행사")
    ap.add_argument("--rows", type=int, default=100)
    ap.add_argument("--out", default="out/festivals.json")
    a = ap.parse_args()

    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        print("DATA_GO_KR_KEY 환경변수가 없습니다. 공공데이터포털 일반 인증키(Decoding)를 설정하세요.", file=sys.stderr)
        return 2

    today = dt.date.today()
    limit = today + dt.timedelta(days=a.days)
    try:
        data = fetch(key, today.strftime("%Y%m%d"), a.rows, 1)
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 1

    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") not in ("0000", "00"):
        print(f"API 오류: {header}", file=sys.stderr)
        return 1

    body = data.get("response", {}).get("body", {})
    raw = body.get("items", {})
    items = raw.get("item", []) if isinstance(raw, dict) else []
    if isinstance(items, dict):
        items = [items]

    out = []
    for it in items:
        sd = str(it.get("eventstartdate", ""))
        if not sd or not (today.strftime("%Y%m%d") <= sd <= limit.strftime("%Y%m%d")):
            continue
        title = it.get("title", "")
        out.append({
            "제목": title,
            "유형": classify(title),
            "지역코드": it.get("areacode", ""),
            "주소": it.get("addr1", ""),
            "시작일": sd,
            "종료일": str(it.get("eventenddate", "")),
            "전화": it.get("tel", ""),
            "이미지": it.get("firstimage", ""),
            "출처": "한국관광공사 TourAPI KorService2 / searchFestival2",
        })

    out.sort(key=lambda x: (x["시작일"], x["제목"]))
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"수집일": today.isoformat(), "기간": f"{today}~{limit}",
                   "건수": len(out), "총건수(API)": body.get("totalCount"),
                   "행사": out}, f, ensure_ascii=False, indent=2)
    print(f"{len(out)}건 저장 → {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
