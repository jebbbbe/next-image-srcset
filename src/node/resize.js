// resizeImages.mjs
import sharp from "sharp"
import fs from "fs"
import path from "path"

function outName(inputPath, width) {
    const abs = path.resolve(inputPath)
    const { name, dir } = path.parse(abs)
    return `${name}-${width}.webp`
}

function stripLeadingSlash(p) {
    return p.replace(/^\/+/, "")
}

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b)
}

function reduceFraction(w, h) {
    const d = gcd(w, h)
    return [w / d, h / d]
}

export function pathToParts(p) {
    return {
        dir: path.dirname(p),
        fileName: path.basename(p),
        name: path.basename(p, path.extname(p)),
        ext: path.extname(p),
    }
}

/** Resize a single image to a specific width and save as WebP. */
async function resizeImage(inputPath, outputPath, width, quality = 75) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    const meta = await sharp(inputPath, { animated: true }).metadata()
    const isAnimated = (meta.pages ?? 1) > 1
    return sharp(inputPath, { animated: isAnimated })
        .rotate()
        .resize({ width, withoutEnlargement: true, kernel: "lanczos3" })
        .toFormat("webp", {
            quality,
            effort: 4,
            alphaQuality: 95,
            smartSubsample: true,
            ...(isAnimated ? { animated: true, loop: 0 } : {}),
        })
        .toFile(outputPath)
}

/**
 * Resize one file to multiple widths
 * Returns meta info from file
 */
export async function resizeFile(settings, file) {
    const meta = await sharp(file).metadata()
    const origW = meta.width
    const origH = meta.height
    const [ow, oh] = reduceFraction(origW, origH)
    const aspect = `${ow}/${oh}`

    // filter valid widths
    const widths = Array.from(new Set(settings.resizeWidths)).filter((w) => Number.isFinite(w) && w > 0 && w <= origW)
    for (const width of widths) {
        const fileName = outName(file, width)
        const outPath = path.join(settings.localOutputDir, fileName)
        if (settings.saveImages) {
            await resizeImage(file, outPath, width, settings.quality)
        }
        settings.verbose && console.log(`✅\t${outPath}`)
    }

    return {
        width: origW,
        height: origH,
        aspect,
    }
}

/**
 * generates a base64 data Url of the file
 * Returns url, widht, height of file
 */
async function generateBlurDataURL(filePath, blurSize = 8) {
    // ensure EXIF orientation is respected with .rotate()
    const buffer = await sharp(filePath)
        .rotate() // fix orientation before resize
        .resize(blurSize) // shrink to tiny size, preserve aspect ratio
        .webp({ quality: 50 }) // encode as webp for small size
        .toBuffer()

    const { width: blurWidth, height: blurHeight } = await sharp(buffer).metadata()

    const base64 = buffer.toString("base64")
    const blurDataURL = `data:image/webp;base64,${base64}`

    return {
        blurWidth,
        blurHeight,
        blurDataURL,
    }
}

/**
 * Resize all files to the given widths into a single targetDir.
 * Returns array of metadata objects for each input file.
 */
export async function resizeAll(settings, filesToProcess) {
    fs.mkdirSync(settings.localOutputDir, { recursive: true })
    const all = {}
    for (const file of filesToProcess) {
        const meta = await resizeFile(settings, file)
        const { dir, name, ext } = pathToParts(file)
        const filePath = stripLeadingSlash( file.replace(settings.basepath, "") )

        // ensure unique save name
        let saveName = name
        let seenCnt = 1
        while (all[saveName] !== undefined) {
            saveName = name + String(seenCnt)
            seenCnt++
        }
        saveName.replaceAll(" ", "-")

        let base64 = settings.generateBlurURL ? await generateBlurDataURL(file) : undefined

        all[saveName] = {
            src: filePath,
            alt: "",
            ...meta,
            ...(base64 || {}),
        }
    }
    return all
}
