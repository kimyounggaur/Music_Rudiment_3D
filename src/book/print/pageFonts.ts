import { PAGE_FONTS, PAGE_FONT_VERSION } from './pageFonts.generated.ts';

/**
 * Load the bundled OFL page fonts (public/fonts) once; canvases draw only after they are ready.
 * "Book Sans" / "Book Serif" are renamed subsets of Pretendard / Noto Serif CJK KR (OFL condition 3).
 */
let loading: Promise<string> | undefined;

export function ensurePageFontsReady(): Promise<string> {
  if (!loading) loading = (async () => {
    if (typeof document === 'undefined' || !document.fonts) throw new Error('이 환경에서는 페이지 글꼴을 확인할 수 없습니다.');
    const owned: FontFace[] = [];
    try {
      await Promise.all(PAGE_FONTS.map(async font => {
        const face = new FontFace(font.family, `url("${font.url}") format("woff2")`, { weight: font.weight, display: 'block' });
        owned.push(face);
        document.fonts.add(face);
        await face.load();
      }));
      const checks = await Promise.all([
        document.fonts.load('400 20px "Book Sans"', '가'),
        document.fonts.load('600 20px "Book Sans"', '가'),
        document.fonts.load('700 20px "Book Serif"', '가'),
      ]);
      if (checks.some(faces => !faces.length)) throw new Error('페이지 글꼴 준비를 확인하지 못했습니다.');
      return PAGE_FONT_VERSION;
    } catch (reason) {
      owned.forEach(face => document.fonts.delete(face));
      throw reason;
    }
  })().catch((reason: unknown) => { loading = undefined; throw reason; });
  return loading;
}
