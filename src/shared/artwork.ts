const ARTWORK_SIZE_PATTERN = /100x100bb/

function artworkVariant(imageUrl: string, size: number): string {
  return imageUrl.replace(ARTWORK_SIZE_PATTERN, `${size}x${size}bb`)
}

export function getArtworkUrl(imageUrl: string): string {
  if (!imageUrl) {
    return ''
  }

  return artworkVariant(imageUrl, 600)
}

export function getArtworkSrcSet(imageUrl: string): string {
  if (!imageUrl || !ARTWORK_SIZE_PATTERN.test(imageUrl)) {
    return ''
  }

  return [200, 400, 600]
    .map((size) => `${artworkVariant(imageUrl, size)} ${size}w`)
    .join(', ')
}

export function renderArtworkMarkup(): string {
  return `
    <figure class="artwork">
      <div class="artwork__frame">
        <img class="artwork__image" data-artwork-image alt="" decoding="async" sizes="(max-width: 380px) 195px, (max-width: 560px) 230px, 300px" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <span class="artwork__mystery" data-artwork-placeholder aria-hidden="true">
          <svg class="artwork__disc" viewBox="0 0 200 200" focusable="false">
            <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="3" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="3" />
            <circle cx="100" cy="100" r="13" fill="#31d982" />
            <path d="M100 100 L100 74" stroke="#31d982" stroke-width="5" stroke-linecap="round" />
          </svg>
        </span>
      </div>
    </figure>
  `
}

export function revealArtwork(root: ParentNode, imageUrl: string, alt: string): void {
  const image = root.querySelector<HTMLImageElement>('[data-artwork-image]')
  const placeholder = root.querySelector<HTMLElement>('[data-artwork-placeholder]')

  if (!image || !placeholder || image.dataset.revealed === 'true') {
    return
  }

  const src = getArtworkUrl(imageUrl)

  if (!src) {
    return
  }

  image.dataset.revealed = 'true'
  image.alt = alt
  const onLoad = (): void => {
    if (image.naturalWidth <= 2) {
      return
    }

    image.removeEventListener('load', onLoad)
    image.classList.add('is-visible')
    placeholder.classList.add('is-hidden')
  }
  image.addEventListener('load', onLoad)
  image.addEventListener('error', () => {
    image.removeEventListener('load', onLoad)
    image.removeAttribute('data-revealed')
  }, { once: true })

  const srcSet = getArtworkSrcSet(imageUrl)
  if (srcSet) {
    image.srcset = srcSet
  }
  image.src = src
}
