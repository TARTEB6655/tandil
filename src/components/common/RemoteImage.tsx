import React from 'react';
import { Image, type ImageProps } from 'expo-image';
import { FAST_IMAGE_PROPS } from '../../utils/fastImage';

/** Shared remote image: memory+disk cache, no fade-in, downscaled to view size. */
export default function RemoteImage({ cachePolicy, transition, allowDownscaling, ...rest }: ImageProps) {
  return (
    <Image
      {...FAST_IMAGE_PROPS}
      cachePolicy={cachePolicy ?? FAST_IMAGE_PROPS.cachePolicy}
      transition={transition ?? FAST_IMAGE_PROPS.transition}
      allowDownscaling={allowDownscaling ?? FAST_IMAGE_PROPS.allowDownscaling}
      {...rest}
    />
  );
}
