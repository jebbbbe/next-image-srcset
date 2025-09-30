import fs from "fs"
import { runResizer, setUp } from "../src/node/main.js"

main()

async function main() {
    let mPath = "test/img/imageAssets.js"

    if (fs.existsSync(mPath)) {
        fs.unlinkSync(mPath)
    }

    await runResizer({
        localImageDir: "test/img/sample",
        localManifestLoc: mPath,
        localOutputDir: "test/img/result",
        basepath: "test/",
        // readManifestCache: true,
        // writeManifestCache: true,
        saveImages: false,
        imageSizes: [16], //[16, 32, 48, 64, 96, 128, 256, 384],
        deviceSizes: [], //[640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        // validExts: new Set([".gif"]), //new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".tif", ".tiff", ".gif", ".avif", ".heic", ".heif"])
        // importName: 'imageAssets',
        // quality: 75,
        generateBlurURL: true,
        // blurWidth: 8,
        preserveNames: true,
        verbose: true,
    })
}
