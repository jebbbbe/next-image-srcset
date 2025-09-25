import { runResizer,setUp } from "../src/node/main.js"

main();

async function main() {
    await runResizer({
        localImageDir: "test/img/test",
        localManifestLoc: "test/img/imageAssets.js",
        localOutputDir: "test/img/result",
        readManifestCache: false,
        writeManifestCache: false,
        // imageSizes: [16],
        // deviceSizes: [],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        // validExts: new Set([".gif"]),
        // importName: 'imageAssets',
        // saveImages:false,
        verbose:true
    });
}
