import { runResizer, setUp } from "../src/node/main.js"

main()

async function main() {
    await runResizer({
        localImageDir: "test/img/sample",
        localManifestLoc: "test/img/imageAssets.js",
        localOutputDir: "test/img/result",
        // basepath: "/public",
        readManifestCache: false,
        // writeManifestCache: true,
        // saveImages: true,
        imageSizes: [16], //[16, 32, 48, 64, 96, 128, 256, 384],
        deviceSizes: [], //[640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        // validExts: new Set([".gif"]), //new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".tif", ".tiff", ".gif", ".avif", ".heic", ".heif"])
        // importName: 'imageAssets',
        // quality: 75,
        generateBlurURL: false,
        // blurWidth: 8,
        verbose: true,
    })
}
