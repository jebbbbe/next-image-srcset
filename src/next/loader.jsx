export function makeSrcSetLoader(asset) {
    return function ({ src, width, quality }) {
        const base = process.env?.SrcSetImage_ImagesDomain || '';
        const w = Math.min(width, asset.width);
        return `${base}/${src}_${w}.webp`;
    };
}


// import {imageAssets} from "@/imageAssets.js"

// export function cdnLoader({ src, width, quality }) {
//     const base = process.env.NEXT_PUBLIC_CDN_BASE?.replace(/\/+$/, '') || '';
//     const asset = imageAssets[src]
//     const w = Math.min(width, asset.width);
//     return `${base}/${asset.src}_${w}.webp`;
// }