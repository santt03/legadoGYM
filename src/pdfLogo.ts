/** Prepara una imagen estable para jsPDF sin recortar logos de otra proporción. */
export async function preparePdfLogo(logoUrl: string): Promise<string | undefined> {
  try {
    const image = new Image()
    image.src = logoUrl
    await image.decode()
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height) return undefined

    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 640
    const context = canvas.getContext('2d')
    if (!context) return undefined

    // La base opaca evita halos o fondos negros al renderizar transparencias SVG/PNG en PDF.
    context.fillStyle = '#262629'
    context.fillRect(0, 0, 640, 640)
    const available = 600
    const scale = Math.min(available / width, available / height)
    const drawWidth = width * scale
    const drawHeight = height * scale
    context.drawImage(image, (640 - drawWidth) / 2, (640 - drawHeight) / 2, drawWidth, drawHeight)
    return canvas.toDataURL('image/png')
  } catch {
    // El encabezado tiene un monograma de respaldo si el archivo no se puede cargar.
    return undefined
  }
}
