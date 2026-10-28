import { ImageOff } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { media } from '../../lib/url'

/** Image that never breaks the layout: fades in on load, quiet placeholder on error. */
export function Img({ src: raw, alt = '', className, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const src = media(raw)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error')
  const [prev, setPrev] = useState(src)
  if (src !== prev) {
    setPrev(src)
    setState(src ? 'loading' : 'error')
  }

  if (state === 'error')
    return (
      <div className={cn('grid place-items-center bg-surface-2 text-faint', className)} role="img" aria-label={alt}>
        <ImageOff className="size-5" strokeWidth={1.5} />
      </div>
    )

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setState('ok')}
      onError={() => setState('error')}
      className={cn('transition-opacity duration-500', state === 'ok' ? 'opacity-100' : 'opacity-0', className)}
      {...rest}
    />
  )
}
