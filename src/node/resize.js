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
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const meta = await sharp(inputPath, { animated: true }).metadata();
    const isAnimated = (meta.pages ?? 1) > 1;
    return sharp(inputPath, { animated: isAnimated })
        .rotate()
        .resize({ width, withoutEnlargement: true ,kernel: "lanczos3",})
        .toFormat("webp", {
            quality,
            effort: 4,
            alphaQuality: 95,
            smartSubsample: true,
            ...(isAnimated ? { animated: true, loop: 0 } : {}),
        })
        .toFile(outputPath);
}
/**
 * Resize one file to multiple widths (skips widths > original).
 * Returns { originalWidth, originalHeight, outputs: [ { width, path } ] }
 */
export async function resizeFile(inputPath, outputDir, sizes, quality, saveImages, verbose) {
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
        if(saveImages){
            await resizeImage(inputPath, outPath, width, quality)
        }
        verbose && console.log(`✔️\t${outPath}`)
    }

    return {
        width:origW,
        height:origH,
        maxWidth: maxWidth,
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
export async function resizeAll(  { localImageDir, localOutputDir, resizeWidths, quality = 75, saveImages, verbose = true,},filesToProcess) {
// export async function resizeAll(files, localDir, targetDir, sizes, quality = 75, saveImages, verbose = true) {

    fs.mkdirSync(localOutputDir, { recursive: true })
    const all = {}
    for (const file of filesToProcess) {
        // console.log(file)
        const meta = await resizeFile(file, localOutputDir, resizeWidths, quality, saveImages, verbose)
        let folder = file.replace(localImageDir, "")
        folder = path.dirname(folder)
        let ext = path.extname(file)
        let fileName = path.basename(file) // with ext
        let baseName = path.basename(file, ext) // no ext
        let finalBaseName = baseName
        let seenCnt = 1
        while (all[finalBaseName] !== undefined ) {
            finalBaseName = baseName + String(seenCnt)
            seenCnt++
        }
        
        all[finalBaseName] = {
            folder: folder,
            src: fileName,
            alt: "",
            ...meta,
        }
    }
    return all
}
