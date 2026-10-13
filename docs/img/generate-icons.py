#!/usr/bin/env python3
"""Draws every plugin icon: <plugin>/.claude-plugin/icon.svg.

One concept per plugin, drawn on a 256x256 plate: white subject, one yellow accent, a colour per plugin.
Run from anywhere after editing a shape:  python3 docs/img/generate-icons.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
W='#fff'; A='#FFD54A'
def svg(bg,body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="{bg}"/>{body}</svg>\n'
def st(c=W,w=12): return f'fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"'
I={}
# product: a document with ruled lines, a bulb rising from its corner = idea becoming the docs
I['agile-product']=svg('#6C4CF1',
 f'<path d="M44 96h86l34 34v90a10 10 0 0 1-10 10H54a10 10 0 0 1-10-10z" {st()}/>'
 f'<path d="M130 96v34h34" {st()}/>'
 f'<path d="M66 170h74M66 196h50" {st(W,10)}/>'
 f'<circle cx="186" cy="74" r="30" fill="{A}"/><path d="M175 112h22" {st(A,9)}/>'
 f'<path d="M186 22v10M226 40l-7 7M146 40l7 7M240 76h-10M142 76h-10" {st(A,8)}/>')
# planning: roadmap line with milestones above, sprint of stories (cards) below
I['agile-planning']=svg('#1F7AE0',
 f'<path d="M36 84h184" {st(W,10)}/>'
 f'<circle cx="52" cy="84" r="14" fill="{W}"/><circle cx="128" cy="84" r="14" fill="{W}"/><circle cx="204" cy="84" r="14" fill="{A}"/>'
 f'<path d="M204 70V38l26 10-26 10" {st(A,8)}/>'
 f'<rect x="34" y="124" width="52" height="38" rx="9" fill="{W}"/><rect x="34" y="172" width="52" height="38" rx="9" fill="{W}" opacity=".7"/>'
 f'<rect x="102" y="124" width="52" height="38" rx="9" fill="{W}"/><rect x="102" y="172" width="52" height="38" rx="9" fill="{W}" opacity=".7"/>'
 f'<rect x="170" y="124" width="52" height="38" rx="9" fill="{W}" opacity=".7"/>')
# execution: ticket -> pull request
I['agile-execution']=svg('#E0662B',
 f'<rect x="24" y="64" width="84" height="128" rx="14" {st()}/>'
 f'<path d="M42 96h48M42 122h36M42 148h42" {st(W,9)}/><path d="M42 172l8 8 14-16" {st(A,9)}/>'
 f'<path d="M116 128h28" {st(A,12)}/><path d="M136 112l18 16-18 16" {st(A,12)}/>'
 f'<circle cx="190" cy="80" r="15" {st(W,10)}/><circle cx="190" cy="176" r="15" {st(W,10)}/><path d="M190 95v66" {st(W,10)}/>')
# merge-review: a diff hunk under a magnifier with a check, merging into main
I['agile-merge-review']=svg('#1E9E6A',
 f'<rect x="30" y="44" width="150" height="124" rx="16" {st()}/>'
 f'<path d="M54 82h26M67 69v26" {st(A,10)}/><path d="M96 82h62" {st(W,10)}/>'
 f'<path d="M54 128h26" {st("#FF8A8A",10)}/><path d="M96 128h44" {st(W,10)}/>'
 f'<circle cx="170" cy="162" r="40" fill="#1E9E6A" stroke="{W}" stroke-width="12"/><path d="m200 192 34 34" {st(W,16)}/>'
 f'<path d="m152 162 13 13 24-26" {st(A,12)}/>')
# drain: tickets fall into a funnel, one outlet; merged result below
I['agile-sprint-drain']=svg('#7B3FE4',
 f'<rect x="46" y="26" width="52" height="34" rx="8" fill="{W}"/><rect x="102" y="40" width="52" height="34" rx="8" fill="{W}" opacity=".75"/><rect x="158" y="26" width="52" height="34" rx="8" fill="{W}" opacity=".55"/>'
 f'<path d="M38 96h180l-64 64v34l-52 24v-58z" fill="{W}"/>'
 f'<path d="M104 230h48" {st(A,12)}/>')
# sprint-close: checklist all checked, finish flag on top
I['agile-sprint-close']=svg('#1B97C9',
 f'<rect x="34" y="92" width="130" height="140" rx="16" {st()}/>'
 f'<path d="M54 130l10 10 18-20M54 168l10 10 18-20M54 206l10 10 18-20" {st(A,10)}/>'
 f'<path d="M96 130h50M96 168h50M96 206h50" {st(W,9)}/>'
 f'<path d="M190 36v118" {st(W,11)}/>'
 f'<path d="M190 38h50v50h-50z" fill="{W}"/><path d="M190 38h25v25h-25zM215 63h25v25h-25z" fill="#1B97C9"/>')
# deep-refactor: scattered blocks -> aligned blocks
I['deep-refactor']=svg('#C93A58',
 f'<g transform="rotate(-14 62 90)"><rect x="34" y="62" width="50" height="34" rx="8" fill="{W}"/></g>'
 f'<g transform="rotate(10 78 152)"><rect x="50" y="134" width="50" height="34" rx="8" fill="{W}" opacity=".8"/></g>'
 f'<g transform="rotate(-6 56 206)"><rect x="30" y="190" width="50" height="34" rx="8" fill="{W}" opacity=".6"/></g>'
 f'<path d="M104 128h34" {st(A,12)}/><path d="M128 110l20 18-20 18" {st(A,12)}/>'
 f'<rect x="162" y="62" width="62" height="34" rx="8" fill="{W}"/><rect x="162" y="112" width="62" height="34" rx="8" fill="{W}" opacity=".8"/><rect x="162" y="162" width="62" height="34" rx="8" fill="{W}" opacity=".6"/>')
# project-review: radar chart of assessed domains under a magnifier
I['project-review']=svg('#3F51B5',
 f'<path d="M104 24l70 52-26 82H60L34 76z" {st(W,8)} opacity=".55"/>'
 f'<path d="M104 56l40 30-15 52H78L64 88z" fill="{A}"/>'
 f'<path d="M104 24v32M174 76l-30 10M148 158l-19-20M60 158l19-20M34 76l30 12" {st(W,6)} opacity=".55"/>'
 f'<circle cx="168" cy="168" r="48" fill="#3F51B5" stroke="{W}" stroke-width="13"/><path d="m204 204 34 34" {st(W,17)}/>'
 f'<path d="m148 170 14 14 28-30" {st(A,12)}/>')
# session-audit: spend bars per skill with a coin
I['session-audit']=svg('#1F8A70',
 f'<path d="M40 70h120M40 118h90M40 166h140" {st(W,18)}/>'
 f'<path d="M40 214h60" {st(A,18)}/>'
 f'<circle cx="198" cy="76" r="34" fill="{A}"/><path d="M198 58v36M208 66c-4-5-20-5-20 4s20 5 20 14-16 9-22 3" {st("#1F8A70",8)}/>')

# agile-mods: a console with a guard shield
I['agile-mods']=(
 '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#C2308F"/>'
 '<rect x="26" y="52" width="204" height="152" rx="18" fill="none" stroke="#fff" stroke-width="12"/><path d="M26 88h204" fill="none" stroke="#fff" stroke-width="10"/>'
 '<circle cx="50" cy="70" r="5" fill="#fff"/><circle cx="68" cy="70" r="5" fill="#fff"/>'
 '<path d="M52 112l22 18-22 18" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'
 '<path d="M90 150h34" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/><path d="M52 178h72" fill="none" stroke="#FFD54A" stroke-width="10" stroke-linecap="round"/>'
 '<path d="M190 120l38 14v30c0 26-16 44-38 54-22-10-38-28-38-54v-30z" fill="#C2308F" stroke="#FFD54A" stroke-width="12" stroke-linejoin="round"/>'
 '<path d="m172 172 12 12 24-26" fill="none" stroke="#FFD54A" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>\n')

for plugin, svg_text in I.items():
    out = ROOT / plugin / '.claude-plugin' / 'icon.svg'
    out.write_text(svg_text)
    print('wrote', out.relative_to(ROOT))
