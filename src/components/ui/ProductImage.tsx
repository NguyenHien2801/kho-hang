'use client'
/**
 * ProductImage Component
 * ----------------------
 * Tự động lấy ảnh sản phẩm từ Open Food Facts API theo mã vạch.
 * Nếu không tìm thấy ảnh → hiển thị emoji theo danh mục.
 * Có cache trong memory để không gọi API lặp lại.
 *
 * Cách dùng:
 *   <ProductImage barcode="8934673000011" category="Thực phẩm" name="Mì Hảo Hảo" size={48} />
 */

import { useState, useEffect } from 'react'

const CATEGORY_EMOJI: Record<string, string> = {
  'Thực phẩm': '🍜',
  'Đồ uống':   '🥤',
  'Bánh kẹo':  '🍪',
  'Gia vị':    '🧂',
  'Hóa phẩm':  '🧴',
  'Khác':      '📦',
}

const imageCache: Record<string, string | null> = {}

interface ProductImageProps {
  barcode:    string
  category?:  string
  name?:      string
  size?:      number
  className?: string
  style?:     React.CSSProperties
}

export default function ProductImage({
  barcode, category = 'Khác', name = '', size = 48, className, style,
}: ProductImageProps) {
  const cached = imageCache[barcode]
  const [imgUrl,  setImgUrl]  = useState<string | null>(cached !== undefined ? cached : null)
  const [loading, setLoading] = useState(cached === undefined)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (imageCache[barcode] !== undefined) {
      setImgUrl(imageCache[barcode]); setLoading(false); return
    }
    let cancelled = false
    setLoading(true); setError(false)

    async function fetchImage() {
      try {
        const res  = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
          { signal: AbortSignal.timeout(5000) }
        )
        const data = await res.json()
        if (!cancelled) {
          const url = data?.product?.image_front_small_url
            || data?.product?.image_front_url
            || data?.product?.image_url || null
          imageCache[barcode] = url
          setImgUrl(url); setLoading(false)
        }
      } catch {
        if (!cancelled) { imageCache[barcode] = null; setImgUrl(null); setLoading(false) }
      }
    }
    fetchImage()
    return () => { cancelled = true }
  }, [barcode])

  const emoji = CATEGORY_EMOJI[category] || '📦'
  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: Math.round(size * 0.2),
    overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f8fafc', border: '1px solid #e2e8f0',
    fontSize: Math.round(size * 0.45), userSelect: 'none', ...style,
  }

  if (loading) return <div className={className} style={{ ...box, background:'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }} />
  if (!imgUrl || error) return <div className={className} style={box} title={name}>{emoji}</div>
  return (
    <div className={className} style={box}>
      <img src={imgUrl} alt={name} title={name} style={{ width:'100%', height:'100%', objectFit:'contain' }} onError={() => setError(true)} />
    </div>
  )
}