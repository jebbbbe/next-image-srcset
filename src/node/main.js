import fs from "fs"
import path from "path"
import prettier from "prettier"
import { createRequire } from "module"
const require = createRequire(import.meta.url) // stupid mjs link stuff

import { resizeAll, pathToParts } from "./resize.js"

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

/**
 * Configure image optimizer/resizer settings.
 *
 * @param {Object} [options] - Configuration options.
 * @param {string} [options.localImageDir="./public/assets/images"] - Path to local images directory.
 * @param {string} [options.localManifestLoc="src/imageAssets.js"] - Path to manifest file.
 * @param {string} [options.localOutputDir="public/cdnExportOptimzer"] - Output directory for optimized images.
 * @param {string} [options.basepath="/public"] - Base path for resolving local assets.
 * @param {boolean} [options.readManifestCache=true] - Whether to read from manifest cache.
 * @param {boolean} [options.writeManifestCache=true] - Whether to write to manifest cache.
 * @param {boolean} [options.saveImages=true] - Whether to save optimized images.
 * @param {number[]} [options.imageSizes=[16,32,48,64,96,128,256,384]] - Sizes for image resizing.
 * @param {number[]} [options.deviceSizes=[640,750,828,1080,1200,1920,2048,3840]] - Device sizes for responsive images.
 * @param {number[]} [options.resizeWidths] - Explicit list of resize widths (overrides imageSizes + deviceSizes).
 * @param {Set<string>} [options.validExts=new Set([".jpg",".jpeg",".jfif",".png",".webp",".tif",".tiff",".gif",".avif",".heic",".heif"])] - Allowed image extensions.
 * @param {string} [options.importName="imageAssets"] - Import name for manifest.
 * @param {number} [options.quality=75] - Output image quality (0–100).
 * @param {boolean} [options.generateBlurURL=true] - Whether to generate blurred placeholder URLs.
 * @param {number} [options.blurWidth=8] - Width of blur placeholder.
 * @param {number} [options.preserveNames=true] - keep Key names that exist in manifest
 * @param {boolean} [options.verbose=false] - Verbose logging.
 */
export function setUp({
    localImageDir = "./public/assets/images",
    localManifestLoc = "src/imageAssets.js",
    localOutputDir = "public/cdnExportOptimzer",
    basepath = "public/",
    readManifestCache = true,
    writeManifestCache = true,
    saveImages = true,
    imageSizes = [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    resizeWidths = undefined,
    validExts = new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".tif", ".tiff", ".gif", ".avif", ".heic", ".heif"]),
    importName = "imageAssets",
    quality = 75,
    generateBlurURL = true,
    blurWidth = 8,
    preserveNames = true,
    verbose = false,
}) {
    settings.localImageDir = normalizeInputPath(localImageDir)
    settings.localManifestLoc = normalizeInputPath(localManifestLoc)
    settings.localOutputDir = normalizeInputPath(localOutputDir)
    settings.basepath = basepath
    settings.readManifestCache = readManifestCache
    settings.writeManifestCache = writeManifestCache
    settings.saveImages = saveImages
    settings.imageSizes = imageSizes
    settings.deviceSizes = deviceSizes
    settings.resizeWidths = resizeWidths !== undefined ? resizeWidths : [...settings.imageSizes, ...settings.deviceSizes]
    settings.validExts = validExts
    settings.importName = importName
    settings.quality = quality
    settings.generateBlurURL = generateBlurURL
    settings.blurWidth = blurWidth
    settings.preserveNames = preserveNames
    settings.verbose = verbose
}

/**
 * Run the resizer with provided options.
 *
 * @param {Object} [props] - Same options as {@link setUp}.
 * @returns {Promise<void>}
 */
export async function runResizer(props = {}) {
    //get deafualt values
    setUp(props)

    // get all files in images directory
    const files = getImageFiles(settings.localImageDir)
    // get js props from imageAssets file
    const manifest = await loadLocalManifest(settings.localManifestLoc)
    // get image files that are already processed
    const originalFiles = new Set(Object.keys(manifest).map((k) => path.basename(`${manifest[k].src}`))) // error here with file that have smae name and diff ext...

    let filesToProcess
    if (settings.readManifestCache) {
        // get new files that havent been processed yet
        filesToProcess = files.filter((f) => {
            return !originalFiles.has(path.basename(f))
        })
    } else {
        filesToProcess = files
    }
    // process images
    const resultData = await resizeAll(settings, filesToProcess)
    if (settings.writeManifestCache) {
        if (settings.preserveNames) {
            let nameMap = {}
            // map of src filename -> prop name for manifest
            Object.keys(manifest).forEach((key) => {
                // nameMap[manifest[key].src] = key
                nameMap[path.basename(manifest[key].src)] = key
            })
            // iterate over resultData, swap props with matching src to manifest prop name
            Object.keys(resultData).forEach((key) => {
                // const _src = resultData[key].src
                const _src = path.basename(resultData[key].src)
                const prevName = nameMap[_src]
                if( key !== prevName && prevName !== undefined){
                    renameProp(resultData, key, prevName)
                }
            })
        }
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
            results = results.concat(getImageFiles(fullPath))
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
        // bust cache by appending a query param
        const mod = await import(abs + "?update=" + Date.now())
        let res = mod[importName] ?? mod.default?.[importName]
        if (res === undefined) {
            throw new Error("config wasnt defined")
        }
        return res
    } catch (err) {
        console.warn("⚠️ Config not found, creating default one...")
        const defaultConfig = {}
        const js = createlocalManifestJS(defaultConfig)
        fs.writeFileSync(filePath, js, "utf8")
        await formatFile(filePath, false)
        return defaultConfig
    }
}

function createlocalManifestJS(obj, importName = settings.importName) {
    const header = ``
    const fileContents = `export const ${importName} = ${JSON.stringify(obj, null, 2)};`
    const footer = ``
    return header + `\n` + fileContents + `\n` + footer
}

async function formatFile(filePath, verbose = settings.verbose) {
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

    verbose && console.log(`Formatted: ${filePath}`)
}

function normalizeInputPath(p) {
    // Normalize slashes for safety, then strip leading ./ or /
    let normalized = path.normalize(p).replace(/^(\.\/|\/)+/, "")
    return normalized
}

function renameProp(obj, srcKey, targKey) {
    if (srcKey in obj) {
        obj[targKey] = obj[srcKey]
        delete obj[srcKey]
    }
    return obj
}
