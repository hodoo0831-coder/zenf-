# -*- coding: utf-8 -*-
"""AP 브랜딩 제거 + 제니엘 워드마크 삽입 (slideLayout11/12)"""
import shutil, zipfile, os, re
from lxml import etree

SRC = 'orig.pptx'
WORK = 'unpacked'
OUT = 'base.pptx'

if os.path.exists(WORK):
    shutil.rmtree(WORK)
zipfile.ZipFile(SRC).extractall(WORK)

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
A = NS['a']; P = NS['p']

NAVY = '0F2A4A'; BLUE = '1B6CA8'; GREY = '8A949F'

REMOVE = {
    'slideLayout11.xml': ['그림 21', '그림 1', '양쪽 모서리가 둥근 사각형 31',
                          '양쪽 모서리가 둥근 사각형 32', '양쪽 모서리가 둥근 사각형 37', 'TextBox 2'],
    'slideLayout12.xml': ['그림 3', '그림 13', '양쪽 모서리가 둥근 사각형 16',
                          '양쪽 모서리가 둥근 사각형 17', '양쪽 모서리가 둥근 사각형 18', 'TextBox 11'],
}

def emu(inch):
    return int(round(inch * 914400))

def textbox_xml(sid, name, x, y, cx, cy, runs, align='l'):
    """runs: list of (text, size_pt, bold, hexcolor, spacing)"""
    rs = []
    for txt, sz, b, col, sp in runs:
        spc = ' spc="%d"' % sp if sp else ''
        rs.append(
            '<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="%d" b="%d"%s dirty="0">'
            '<a:solidFill><a:srgbClr val="%s"/></a:solidFill>'
            '<a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/><a:cs typeface="맑은 고딕"/>'
            '</a:rPr><a:t>%s</a:t></a:r>' % (int(sz * 100), 1 if b else 0, spc, col, txt))
    return (
        '<p:sp xmlns:p="%s" xmlns:a="%s"><p:nvSpPr>'
        '<p:cNvPr id="%d" name="%s"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        '<p:spPr><a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
        '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr">'
        '<a:noAutofit/></a:bodyPr><a:lstStyle/>'
        '<a:p><a:pPr algn="%s"/>%s</a:p></p:txBody></p:sp>'
        % (P, A, sid, name, x, y, cx, cy, align, ''.join(rs)))

for fname, names in REMOVE.items():
    path = os.path.join(WORK, 'ppt/slideLayouts', fname)
    tree = etree.parse(path)
    root = tree.getroot()
    spTree = root.find('.//p:cSld/p:spTree', NS)
    for el in list(spTree):
        cNvPr = el.find('.//p:cNvPr', NS)
        if cNvPr is not None and cNvPr.get('name') in names:
            spTree.remove(el)
    if fname == 'slideLayout12.xml':
        # 제니엘 워드마크(좌하단) + 문서명(우하단)
        spTree.append(etree.fromstring(textbox_xml(
            9001, 'ZENIEL_MARK', emu(0.26), emu(7.13), emu(3.0), emu(0.26),
            [('제니엘', 11, True, NAVY, 0), ('  ZENIEL', 8, False, GREY, 120)])))
        spTree.append(etree.fromstring(textbox_xml(
            9002, 'ZENIEL_DOCTITLE', emu(6.0), emu(7.13), emu(4.57), emu(0.26),
            [('현장 CCTV 설치 장소(위치) 조사', 8, False, GREY, 0)], align='r')))
    tree.write(path, xml_declaration=True, encoding='UTF-8', standalone=True)
    print('debranded', fname)

# repack
if os.path.exists(OUT):
    os.remove(OUT)
zf = zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED)
for root_d, _, files in os.walk(WORK):
    for f in files:
        full = os.path.join(root_d, f)
        zf.write(full, os.path.relpath(full, WORK))
zf.close()
print('wrote', OUT)
