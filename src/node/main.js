import fs from "fs"
import path from "path"
import prettier from "prettier"
import { createRequire } from "module"
const require = createRequire(import.meta.url) // stupid mjs link stuff

import { resizeAll } from "./resize.js"

/* 


CDN FILE STRUCTURE
/originals
    imageAssets.js    // manifest js file
    /main
        photo.jpg
photo_16.webp
photo_32.webp
...
photo_2048.webp
photo_3840.webp

REPO FILE STRUCTURE

/public
    /images
        /main
            photo.jpg
    cdnExportOptimzer   ///in git ignore pls
        photo_16.webp
        photo_32.webp
        ...
        photo_2048.webp
        photo_3840.webp
/src
    iamgeAssets.js      // manifest js file

*/

let settings = {}

export function setUp({
    localImageDir = "./public/assets/images",
    localManifestLoc = "src/imageAssets.js",
    localOutputDir = "public/cdnExportOptimzer",
    readManifestCache = true,
    writeManifestCache = true,
    saveImages = true,
    imageSizes = [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    resizeWidths = undefined,
    validExts = new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".tif", ".tiff", ".gif", ".avif", ".heic", ".heif"]),
    importName = "imageAssets",
    verbose = false,
    quality = 75,
}) {
    settings.localImageDir = localImageDir
    settings.localManifestLoc = localManifestLoc
    settings.localOutputDir = localOutputDir
    settings.readManifestCache = readManifestCache
    settings.writeManifestCache = writeManifestCache
    settings.saveImages = saveImages
    settings.imageSizes = imageSizes
    settings.deviceSizes = deviceSizes
    settings.resizeWidths = resizeWidths !== undefined ? resizeWidths : [...settings.imageSizes, ...settings.deviceSizes]
    settings.validExts = validExts
    settings.importName = importName
    settings.verbose = verbose
    settings.quality = quality
}

export async function runResizer(props = {}) {
    setUp(props)

    settings.verbose && console.log(settings)
    // get all files in images directory
    const files = getImageFiles(settings.localImageDir)
    // get js props from imageAssets file
    const manifest = await loadLocalManifest(settings.localManifestLoc)
    // get image files that are already processed
    const originalFiles = new Set(Object.keys(manifest).map((k) => `${manifest[k].src}`)) // error here with file that have smae name and diff ext...

    let filesToProcess
    if (settings.readManifestCache) {
        // get new files that havent been processed yet
        filesToProcess = files.filter((f) => !originalFiles.has( path.basename(f) ))
    } else {
        filesToProcess = files
    }
    // process images
    const resultData = await resizeAll(filesToProcess, settings.localImageDir, settings.localOutputDir, settings.resizeWidths, 75, settings.saveImages, settings.verbose)
    if (settings.writeManifestCache) {
        // new data
        const newData = { ...manifest, ...resultData }
        // save JS file
        const js = createlocalManifestJS(newData)
        fs.writeFileSync(settings.localManifestLoc, js, "utf8")
        await formatFile(settings.localManifestLoc)
    }
}

function getImageFiles(dir, exts = settings.validExts) {
    let results = []

    const list = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of list) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            results = results.concat(getImageFiles(fullPath)) // dive in
        } else {
            const ext = path.extname(entry.name).toLowerCase()
            if (exts.has(ext)) {
                results.push(fullPath)
            }
        }
    }

    return results
}

async function loadLocalManifest(filePath, importName = settings.importName) {
    const abs = path.resolve(filePath)
    try {
        // clear cache so edits are picked up on reruns
        try {
            delete require.cache[require.resolve(abs)]
        } catch {}
        const mod = require(abs) // loads .js as CommonJS without warnings
        let res = mod[importName] ?? mod.default?.[importName]
        if (res === undefined) {
            throw new Error("config wasnt defined")
        }
        return res
    } catch (err) {
        console.warn("⚠️ Config not found, creating default one...")
        console.log(err)
        const defaultConfig = {}
        const js = createlocalManifestJS(defaultConfig)
        fs.writeFileSync(filePath, js, "utf8")
        await formatFile(filePath)
        return defaultConfig
    }
}

function createlocalManifestJS(obj, importName = settings.importName) {
    const header = ``
    const fileContents = `export const ${importName} = ${JSON.stringify(obj, null, 2)};`
    const footer = ``
    return header + `\n` + fileContents + `\n` + footer
}

async function formatFile(filePath) {
    // Load Prettier config (synchronously)
    const options = (await prettier.resolveConfig(filePath)) || {}

    // Read the file content
    const fileContent = fs.readFileSync(filePath, "utf8")

    // Format with Prettier + repo config
    const formatted = await prettier.format(fileContent, {
        ...options,
        filepath: filePath, // important so Prettier knows the parser
    })

    // Overwrite the file
    fs.writeFileSync(filePath, formatted)

    console.log(`Formatted: ${filePath}`)
}
