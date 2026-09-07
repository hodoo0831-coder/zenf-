#!/usr/bin/env python3
"""서브셋 나눔고딕을 base64로 감싼 @font-face 블록을 stdout에 찍는다.

CDN을 못 쓰는 단일 HTML 앱에 글꼴을 넣을 때 쓴다. 결과를 <style> 맨 위에 붙이면
사용자 PC에 나눔고딕이 없어도, 인터넷이 끊겨 있어도 같은 화면이 나온다.

    python3 embed_fonts.py > fontface.css

굵기는 400/700 두 벌뿐이다. CSS에서 500을 쓰면 400으로, 600을 쓰면 700으로 그려지므로
중간값을 쓰지 말고 400 아니면 700으로 정할 것.
"""
import base64
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(os.path.dirname(HERE), "assets")

FACES = [(400, "nanum_400.woff2"), (700, "nanum_700.woff2")]

HEAD = """/* 나눔고딕 내장 — 외부 CDN 없이 어디서 열어도 같은 글꼴로 보이게 한다.
   라틴 + 한국어 상용 음절(KS X 1001)로 서브셋. 굵기는 400·700 두 벌.
   500/600 지정은 각각 400/700으로 그려지니 중간값을 쓰지 말 것. */"""


def main():
    out = [HEAD]
    total = 0
    for weight, fname in FACES:
        path = os.path.join(ASSETS, fname)
        if not os.path.exists(path):
            sys.exit("없는 파일: %s" % path)
        raw = open(path, "rb").read()
        total += len(raw)
        b64 = base64.b64encode(raw).decode("ascii")
        out.append(
            "@font-face{font-family:'NanumGothicEmbedded';font-style:normal;"
            "font-weight:%d;font-display:swap;\n"
            "  src:url(data:font/woff2;base64,%s) format('woff2')}" % (weight, b64)
        )
    print("\n".join(out))
    sys.stderr.write(
        "woff2 %d바이트 → base64로 약 %d바이트. gzip 배포하면 전송량은 원본에 가깝다.\n"
        % (total, total * 4 // 3)
    )


if __name__ == "__main__":
    main()
