
export function makeSrcSetLoader(asset) {
    return function ({ src, width, quality }) {
        const base = process.env.SrcSetImage_ImagesDomain || '';
        const w = Math.min(width, asset.width);
        const srcStr = removeFileExt(src);
        return `${base}/${srcStr}-${w}.webp`;
    };
}

function removeFileExt(str) {
    const lastDotIndex = str.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return str;
    }
    return str.slice(0, lastDotIndex);
}

// import {imageAssets} from "@/imageAssets.js"

// export function cdnLoader({ src, width, quality }) {
//     const base = process.env.NEXT_PUBLIC_CDN_BASE?.replace(/\/+$/, '') || '';
//     const asset = imageAssets[src]
//     const w = Math.min(width, asset.width);
//     return `${base}/${asset.src}_${w}.webp`;
// }
