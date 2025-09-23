// resizeImages.mjs
import sharp from "sharp"
import fs from "fs"
import path from "path"

/** Build a unique output filename that lives in ONE folder */
function outName(inputPath, width) {
    const abs = path.resolve(inputPath)
    const { name, dir } = path.parse(abs)
    return `${name}-${width}.webp`
}

/** Resize a single image to a specific width and save as WebP. */
async function resizeImage(inputPath, outputPath, width, quality = 75) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    return sharp(inputPath)
        .rotate() // normalize orientation into the pixels
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toFile(outputPath) // no .withMetadata() → stripped
}

/**
 * Resize one file to multiple widths (skips widths > original).
 * Returns { originalWidth, originalHeight, outputs: [ { width, path } ] }
 */
export async function resizeFile(inputPath, outputDir, sizes, quality, verbose) {
    const meta = await sharp(inputPath).metadata()
    const origW = meta.width ?? Infinity
    const origH = meta.height ?? Infinity
    const [ow, oh] = reduceFraction(origW, origH)

    // filter valid widths
    const widths = Array.from(new Set(sizes)).filter((w) => Number.isFinite(w) && w > 0 && w <= origW)
    const maxWidth = widths.at(-1)
    for (const width of widths) {
        const fileName = outName(inputPath, width)
        const outPath = path.join(outputDir, fileName)
        await resizeImage(inputPath, outPath, width, quality)
        verbose && console.log(`✔️\t${outPath}`)
    }

    return {
        width: maxWidth,
        aspect: `${ow}/${oh}`,
    }
}

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b)
}

function reduceFraction(w, h) {
    const d = gcd(w, h)
    return [w / d, h / d]
}

/**
 * Resize all files to the given widths into a single targetDir.
 * Returns array of metadata objects for each input file.
 */
export async function resizeAll(files, localDir, targetDir, sizes, quality = 75, verbose = true) {
    fs.mkdirSync(targetDir, { recursive: true })
    const all = {}
    for (const file of files) {
        // console.log(file)
        const meta = await resizeFile(file, targetDir, sizes, quality, verbose)
        let folder = file.replace(localDir, "")
        folder = path.dirname(folder)
        let ext = path.extname(file)
        let baseName = path.basename(file, ext)
        let fileName = baseName
        ext = ext.slice(1)
        let cnt = 0
        while (all[fileName] !== undefined && all[fileName].ext === ext) {
            fileName = baseName + String(cnt)
            cnt++
        }
        all[fileName] = {
            folder: folder,
            src: fileName,
            ext: ext,
            alt: "",
            ...meta,
        }
    }
    return all
}
