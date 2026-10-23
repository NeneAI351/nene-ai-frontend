from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
for name in ['brand-logo.svg','brand-mark.svg']:
 p=Path(name);p.write_text(p.read_text().replace('M156 294V154h36l115 140V154h37v140h-36L193 155v139Z','M156 154h37v140h-37Z M307 154h37v140h-37Z M174 154h42l110 140h-42Z'))
scale=4;sz=512*scale
im=Image.new('RGB',(sz,sz),'#070707');mask=Image.new('L',(sz,sz));d=ImageDraw.Draw(mask)
def coords(points):return [(int(x*scale),int(y*scale)) for x,y in points]
d.ellipse((112*scale,80*scale,400*scale,368*scale),outline=255,width=2*scale)
for pts in [[(156,154),(193,154),(193,294),(156,294)],[(307,154),(344,154),(344,294),(307,294)],[(174,154),(216,154),(326,294),(284,294)]]:d.polygon(coords(pts),fill=255)
gradient=Image.new('RGB',(sz,sz));g=ImageDraw.Draw(gradient)
for y in range(sz):
 t=y/(sz-1);color=tuple(round(a+(b-a)*t) for a,b in zip((255,240,185),(167,121,48)));g.line((0,y,sz,y),fill=color)
im.paste(gradient,(0,0),mask);d=ImageDraw.Draw(im);d.polygon(coords([(242,207),(272,225),(242,243)]),fill='#070707')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',31*scale)
text='NENE AI';spacing=5*scale;width=sum(d.textlength(c,font=font) for c in text)+spacing*(len(text)-1);x=(sz-width)/2
for c in text:d.text((x,422*scale),c,font=font,fill='#ead6a0',anchor='ls');x+=d.textlength(c,font=font)+spacing
for size in [192,512]:im.resize((size,size),Image.Resampling.LANCZOS).save(f'nene-icon-{size}-v2.png')
