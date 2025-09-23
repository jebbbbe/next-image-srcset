import makeSrcSetLoader from "./loader"

const SrcSetImage = ({ asset, sizes = "100vw" }) => {//"(min-width: 1024px) 1024px, 100vw"
    const src = asset?.src || ""
    const alt = asset?.alt || ""
    const loader = makeSrcSetLoader(asset)
    return (
        <img
            src={src}
            alt={alt}
            loader={loader}
            fill
            sizes={sizes}
        />
    );
};

export default SrcSetImage