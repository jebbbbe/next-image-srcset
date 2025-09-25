'use client';

import Image from 'next/image';
import { makeSrcSetLoader } from './loader.js';
import * as assets from '@/assets';

const SrcSetImage = ({className = "", asset, sizes = '100vw' }) => {
    //"(min-width: 1024px) 1024px, 100vw"
    const src = asset?.src || '';
    const alt = asset?.alt || '';
    const myLoader = makeSrcSetLoader(asset);
    console.log(asset);
    return (
        <Image
            className={className}
            width={100}
            height={100}
            src={src}
            alt={alt}
            loader={myLoader}
            // fill
            // sizes={sizes}
        />
    );
};

export default SrcSetImage;
