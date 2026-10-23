// Photo prise au téléphone (3 à 8 Mo) → image WebP d'environ 40 à 80 Ko, avant envoi.
// Économise le forfait internet et accélère l'affichage du catalogue.
const MAX_SIDE = 640

export async function compressImage(file: File, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  // Anciens navigateurs sans encodeur WebP : ils renvoient du PNG, on préfère alors du JPEG.
  const webp = await toBlob('image/webp')
  const blob = webp?.type === 'image/webp' ? webp : await toBlob('image/jpeg')
  if (!blob) throw new Error('Image illisible')
  return blob
}
