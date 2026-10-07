#!/usr/bin/env python3
"""새 ZEN 스위트 앱의 뼈대를 조립한다 — 글꼴 내장 + base.css + 셸이 든 단일 HTML.

    python3 scripts/new_app.py 출력.html --name 젠체크 --roman ZENCHECK \\
        --title "젠체크 · 현장 점검" --desc "현장 점검 결과를 모아 한 장으로"

나온 파일은 그 자리에서 더블클릭하면 뜬다(데모 계정 w01/m01/a01, 비밀번호 1234).
여기서부터 VIEWS 에 화면을 추가해 나가면 된다.

--slim 을 주면 근태 전용 블록(월 근태 그리드 table.mgt, 캘린더 .cal)을 빼고 조립한다.
날짜 축이 없는 앱이면 이쪽이 가볍다.
"""
import argparse
import io
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")

PLACEHOLDER = """/* ①  여기에 scripts/embed_fonts.py 결과(@font-face 2블록)를 붙여넣는다.
   ②  그 아래에 assets/base.css 를 통째로 붙여넣고 안 쓰는 블록을 지운다. */"""

# --slim 에서 덜어내는 블록. base.css 안의 주석 제목으로 구간을 잡는다.
SLIM_SECTIONS = [
    "/* 월 근태 그리드 (1인 1행 × 31일) */",
    "/* 캘린더 (근로자) */",
]


def drop_section(css, header):
    """주석 제목부터 다음 주석 제목 직전까지를 잘라낸다."""
    start = css.find(header)
    if start < 0:
        return css
    nxt = css.find("\n/* ", start + len(header))
    return css[:start] + (css[nxt + 1:] if nxt > 0 else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out", help="만들 HTML 파일 경로")
    ap.add_argument("--name", default="젠앱", help="앱 이름 (한글) — 로고와 로그인 제목에 들어간다")
    ap.add_argument("--roman", default="ZENAPP", help="로고 아래 영문 (대문자)")
    ap.add_argument("--sub", default="", help="로그인 제목 둘째 줄 (예: 통합 근태관리)")
    ap.add_argument("--title", default="", help="<title> — 없으면 이름에서 만든다")
    ap.add_argument("--desc", default="", help="meta description")
    ap.add_argument("--slim", action="store_true", help="근태 전용 CSS 블록 제외")
    a = ap.parse_args()

    ff = subprocess.run([sys.executable, os.path.join(HERE, "embed_fonts.py")],
                        capture_output=True, text=True)
    if ff.returncode != 0:
        sys.exit("글꼴 임베드 실패:\n" + ff.stderr)

    css = io.open(os.path.join(ASSETS, "base.css"), encoding="utf-8").read()
    if a.slim:
        for h in SLIM_SECTIONS:
            css = drop_section(css, h)

    html = io.open(os.path.join(ASSETS, "starter.html"), encoding="utf-8").read()
    if PLACEHOLDER not in html:
        sys.exit("starter.html 의 CSS 자리표시 주석을 못 찾았습니다.")
    html = html.replace(PLACEHOLDER, ff.stdout.rstrip() + "\n\n" + css)

    html = html.replace("APP_ROMAN", a.roman)
    html = html.replace("APP_NAME", a.name)
    html = html.replace("APP_SUB", a.sub or a.name)
    html = html.replace("APP_TITLE", a.title or a.name)
    html = html.replace("APP_DESC", a.desc or a.title or a.name)

    left = [t for t in ("APP_NAME", "APP_ROMAN", "APP_SUB", "APP_TITLE", "APP_DESC")
            if re.search(t, html)]
    if left:
        sys.exit("치환 안 된 자리표시가 남았습니다: " + ", ".join(left))

    io.open(a.out, "w", encoding="utf-8").write(html)
    kb = os.path.getsize(a.out) // 1024
    print("만들었습니다: %s (%dKB — 대부분 내장 글꼴)" % (a.out, kb))
    print("데모 계정 w01 / m01 / a01, 비밀번호 1234. VIEWS 에 화면을 추가해 나가세요.")
    print("완성 전 검증:  node %s/check_responsive.js file://%s --states states.js"
          % (HERE, os.path.abspath(a.out)))


if __name__ == "__main__":
    main()
