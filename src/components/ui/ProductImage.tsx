'use client'
/**
 * ProductImage Component
 * ----------------------
 * Ưu tiên load ảnh từ image_url (Supabase Storage).
 * Fallback: Open Food Facts API theo barcode.
 * Fallback cuối: emoji theo danh mục.
 */

import { useState, useEffect } from 'react'

const CATEGORY_EMOJI: Record<string, string> = {
  'Thực phẩm':       '🍜',
  'Đồ uống':         '🥤',
  'Bánh kẹo':        '🍪',
  'Gia vị':          '🧂',
  'Hóa phẩm':        '🧴',
  'Văn phòng phẩm':  '✏️',
  'Khác':            '📦',
}

const imageCache: Record<string, string | null> = {}

interface ProductImageProps {
  barcode:    string
  imageUrl?:  string          // ← ƯU TIÊN SỐ 1: từ Supabase Storage
  category?:  string
  name?:      string
  size?:      number
  className?: string
  style?:     React.CSSProperties
}

export default function ProductImage({
  barcode, imageUrl, category = 'Khác', name = '', size = 48, className, style,
}: ProductImageProps) {
  // Nếu có imageUrl từ database → dùng luôn, không cần fetch
  const [imgUrl,  setImgUrl]  = useState<string | null>(imageUrl || imageCache[barcode] || null)
  const [loading, setLoading] = useState(!imageUrl && imageCache[barcode] === undefined)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    // Có ảnh từ database → không fetch API
    if (imageUrl) { setImgUrl(imageUrl); setLoading(false); return }

    // Đã cache rồi
    if (imageCache[barcode] !== undefined) {
      setImgUrl(imageCache[barcode]); setLoading(false); return
    }

    // Barcode là SKU nội bộ (SP-XXXXX) → không fetch
    if (barcode.startsWith('SP-')) {
      imageCache[barcode] = null; setImgUrl(null); setLoading(false); return
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
  }, [barcode, imageUrl])

  const emoji = CATEGORY_EMOJI[category] || '📦'
  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: Math.round(size * 0.2),
    overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f8fafc', border: '1px solid #e2e8f0',
    fontSize: Math.round(size * 0.45), userSelect: 'none', ...style,
  }

  if (loading) return (
    <div className={className} style={{ ...box, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
  )
  if (!imgUrl || error) return (
    <div className={className} style={box} title={name}>{emoji}</div>
  )
  return (
    <div className={className} style={box}>
      <img src={imgUrl} alt={name} title={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setError(true)} />
    </div>
  )
}