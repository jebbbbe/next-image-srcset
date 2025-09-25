
export function makeSrcSetLoader(asset) {
    return function ({ src, width, quality }) {
        const base = process.env.SrcSetImage_ImagesDomain || '';
        const w = Math.min(width, asset.maxWidth);
        const safeSrc = encodeURIComponent(removeFileExt(src));
        // console.log(`${base}/${safeSrc}-${w}.webp`)
        return `${base}/${safeSrc}-${w}.webp`;
    };
}

function removeFileExt(str) {
    const lastDotIndex = str.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return str;
    }
    return str.slice(0, lastDotIndex);
}
