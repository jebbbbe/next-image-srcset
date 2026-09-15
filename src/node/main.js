import fs from "fs"
import path from "path"
import prettier from "prettier"
import sharp from "sharp"

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
 * @param {string} [options.localCacheLoc="cache/images.json"] - Path to processed image cache.
 * @param {string} [options.localOutputDir="public/cdnExportOptimzer"] - Output directory for optimized images.
 * @param {string} [options.basepath="/public"] - Base path for resolving local assets.
 * @param {boolean} [options.readCache=true] - Whether to skip cached images.
 * @param {boolean} [options.writeCache=true] - Whether to save processed images to cache.
 * @param {boolean} [options.writeManifestCache=true] - Whether to update the asset manifest.
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
    localImageDir = "public/assets/images",
    localManifestLoc = "src/imageAssets.js",
    localCacheLoc = "cache/images.json",
    localOutputDir = "public/cdnExportOptimzer",
    basepath = "public/",
    readCache = true,
    writeCache = true,
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
    settings.localCacheLoc = normalizeInputPath(localCacheLoc)
    settings.localOutputDir = normalizeInputPath(localOutputDir)
    settings.basepath = basepath
    settings.readCache = readCache
    settings.writeCache = writeCache
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
    // track processed images separately from the asset manifest
    const cache = fs.existsSync(settings.localCacheLoc) ? JSON.parse(fs.readFileSync(settings.localCacheLoc, "utf8")) : {}
    const originalFiles = new Set(Object.values(cache).map((asset) => asset.src))

    let filesToProcess
    if (settings.readCache) {
        // get new files that havent been processed yet
        filesToProcess = files.filter((f) => {
            return !originalFiles.has(f.replace(settings.basepath, "").replace(/^\/+/, ""))
        })
    } else {
        filesToProcess = files
    }
    // save each completed image so interrupted runs can resume
    for (const file of filesToProcess) {
        const resultData = await resizeAll(settings, [file])
        // Match metadata to the EXIF rotation already applied by the resizer.
        const { orientation } = await sharp(file).metadata()
        if (orientation >= 5 && orientation <= 8) {
            Object.values(resultData).forEach((data) => {
                const width = data.width
                data.width = data.height
                data.height = width
                data.aspect = data.aspect.split("/").reverse().join("/")
            })
        }
        if (settings.writeManifestCache) {
            if (settings.preserveNames) {
                let nameMap = {}
                // map of src -> prop name for manifest
                Object.keys(manifest).forEach((key) => {
                    nameMap[manifest[key].src] = key
                })
                // swap props with matching src to manifest prop name
                Object.keys(resultData).forEach((key) => {
                    const _src = resultData[key].src
                    const prevName = nameMap[_src]
                    if (prevName !== undefined) {
                        resultData[key] = { ...manifest[prevName], ...resultData[key], alt: manifest[prevName].alt ?? resultData[key].alt }
                        if (key !== prevName) renameProp(resultData, key, prevName)
                    }
                })
            }
            Object.keys(resultData).forEach((key) => {
                let name = key
                for (let suffix = 1; manifest[name] !== undefined && manifest[name].src !== resultData[key].src; suffix++) name = key + String(suffix)
                if (name !== key) renameProp(resultData, key, name)
            })
            // new data
            const newData = { ...manifest, ...resultData }
            // save JS file
            const js = createlocalManifestJS(newData)
            fs.writeFileSync(settings.localManifestLoc, js, "utf8")
            await formatFile(settings.localManifestLoc)
            Object.assign(manifest, resultData)
        }
        if (settings.writeCache && settings.saveImages) {
            Object.values(resultData).forEach((data) => {
                cache[data.src] = data
            })
            fs.mkdirSync(path.dirname(settings.localCacheLoc), { recursive: true })
            fs.writeFileSync(settings.localCacheLoc + ".tmp", JSON.stringify(cache, null, 2), "utf8")
            fs.renameSync(settings.localCacheLoc + ".tmp", settings.localCacheLoc)
        }
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
