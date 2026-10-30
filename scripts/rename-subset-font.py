"""Rename a subset font for OFL-1.1 condition 3 (Reserved Font Names).

    python3 scripts/rename-subset-font.py <font.woff2> "<Family>" "<Style>" <PostScriptName>

A subset is a Modified Version under the OFL, so it may not keep a Reserved Font Name
(Pretendard reserves "Pretendard"; Noto Serif CJK reserves "Source"). The family, style, full,
PostScript, unique and typographic names are replaced. Copyright (0), trademark (7),
vendor/designer (8, 9, 11, 12) and licence (13, 14) records are kept unchanged: the OFL requires
the copyright notice and licence to travel with the font. Generation-time tool only (fontTools);
the renamed WOFF2 files are committed.
"""
import sys
from fontTools.ttLib import TTFont

path, family, style, postscript = sys.argv[1:5]
font = TTFont(path)
name = font['name']
full = f'{family} {style}'
ribbi = style in ('Regular', 'Bold', 'Italic', 'Bold Italic')
base = {1: family if ribbi else full, 2: style if ribbi else 'Regular', 3: f'{postscript};subset',
        4: full, 6: postscript, 16: family, 17: style}
optional = {18: full, 21: family, 22: style}
present = {record.nameID for record in name.names}
for name_id in [*base, *optional]:
    name.removeNames(nameID=name_id)
for name_id, value in [*base.items(), *[(key, value) for key, value in optional.items() if key in present]]:
    name.setName(value, name_id, 3, 1, 0x409)
    name.setName(value, name_id, 1, 0, 0)
if 'CFF ' in font:
    cff = font['CFF '].cff
    cff.fontNames = [postscript]
    top = cff.topDictIndex[0]
    top.FamilyName = family
    top.FullName = full
font.flavor = 'woff2'
font.save(path)
reserved = ('Pretendard', 'Source', 'Noto')
names = TTFont(path)['name'].names
leftover = [record.toUnicode() for record in names if record.nameID in (*base, *optional) and any(word in record.toUnicode() for word in reserved)]
assert not leftover, leftover
print(f'renamed {path} -> {full} ({postscript})')
